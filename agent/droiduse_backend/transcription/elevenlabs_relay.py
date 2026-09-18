"""
ElevenLabs Scribe v2 WebSocket relay client.

Handles connection to ElevenLabs real-time transcription API and forwards
transcripts back to the phone.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Callable, Coroutine, Optional

import websockets
from rich import print as rprint
from websockets.client import WebSocketClientProtocol

from droiduse_backend.config_manager import TranscriptionConfig

logger = logging.getLogger("droiduse-backend.transcription")

# ElevenLabs Scribe v2 WebSocket endpoint
ELEVENLABS_SCRIBE_URL = "wss://api.elevenlabs.io/v1/speech-to-text/realtime"


class ElevenLabsRelay:
    """
    Relay client for ElevenLabs Scribe v2 real-time transcription.

    This class:
    1. Connects to ElevenLabs WebSocket API
    2. Forwards audio chunks from the phone
    3. Parses transcription responses
    4. Invokes callbacks for partial and committed transcripts
    """

    def __init__(
        self,
        config: TranscriptionConfig,
        session_id: str,
        on_partial: Optional[Callable[[str, str], Coroutine[Any, Any, None]]] = None,
        on_committed: Optional[Callable[[str, str, bool], Coroutine[Any, Any, None]]] = None,
        on_error: Optional[Callable[[str, str], Coroutine[Any, Any, None]]] = None,
        on_status: Optional[Callable[[str, str], Coroutine[Any, Any, None]]] = None,
        language: Optional[str] = None,
    ):
        """
        Initialize the relay.

        Args:
            config: Transcription configuration
            session_id: Unique session identifier
            on_partial: Callback for partial transcripts (session_id, text)
            on_committed: Callback for committed transcripts (session_id, text, is_final)
            on_error: Callback for errors (session_id, error_message)
            on_status: Callback for status updates (session_id, status)
            language: Language code (e.g., "en") or None for auto-detect
        """
        self.config = config
        self.session_id = session_id
        self.on_partial = on_partial
        self.on_committed = on_committed
        self.on_error = on_error
        self.on_status = on_status
        self.language = language or config.default_language

        self._websocket: Optional[WebSocketClientProtocol] = None
        self._receive_task: Optional[asyncio.Task] = None
        self._connected = False
        self._stopping = False

    async def connect(self) -> bool:
        """
        Connect to ElevenLabs Scribe v2 API.

        Returns:
            True if connection successful, False otherwise
        """
        if self._connected:
            logger.warning(f"[{self.session_id}] Already connected to ElevenLabs")
            return True

        if not self.config.is_configured():
            logger.error(f"[{self.session_id}] Transcription not configured (missing API key)")
            if self.on_error:
                await self.on_error(self.session_id, "Transcription not configured")
            return False

        try:
            # Build connection URL with config as query params
            from urllib.parse import urlencode

            params = {
                "model_id": self.config.model_id,
                "audio_format": "pcm_16000",
                "commit_strategy": "vad",
                "vad_silence_threshold_secs": self.config.vad_silence_threshold,
            }

            if self.language:
                params["language_code"] = self.language

            url = f"{ELEVENLABS_SCRIBE_URL}?{urlencode(params)}"

            logger.info(f"[{self.session_id}] Connecting to ElevenLabs Scribe v2...")
            logger.debug(f"[{self.session_id}] URL params: {params}")

            # Connect with API key in header
            self._websocket = await websockets.connect(
                url,
                additional_headers={"xi-api-key": self.config.elevenlabs_api_key},
                ping_interval=20,
                ping_timeout=60,
                close_timeout=10,
            )

            # Wait for session_started message
            try:
                response = await asyncio.wait_for(self._websocket.recv(), timeout=10.0)
                data = json.loads(response)
                msg_type = data.get("type")

                if msg_type == "error":
                    error_msg = data.get("message", "Unknown error")
                    logger.error(f"[{self.session_id}] ElevenLabs error: {error_msg}")
                    if self.on_error:
                        await self.on_error(self.session_id, error_msg)
                    await self._websocket.close()
                    return False
                elif msg_type == "session_started":
                    logger.info(f"[{self.session_id}] ElevenLabs session started")
                else:
                    logger.debug(f"[{self.session_id}] First message type: {msg_type}")

            except asyncio.TimeoutError:
                logger.error(f"[{self.session_id}] Timeout waiting for session start")
                await self._websocket.close()
                return False
            except websockets.exceptions.ConnectionClosed as e:
                logger.error(
                    f"[{self.session_id}] ElevenLabs closed connection: "
                    f"code={e.code}, reason={e.reason or 'none'}"
                )
                if self.on_error:
                    await self.on_error(self.session_id, f"Connection closed: code={e.code}")
                return False

            self._connected = True
            self._stopping = False

            # Start background receive task
            self._receive_task = asyncio.create_task(self._receive_loop())

            if self.on_status:
                await self.on_status(self.session_id, "connected")

            logger.info(f"[{self.session_id}] Connected to ElevenLabs Scribe v2")
            return True

        except Exception as e:
            logger.error(f"[{self.session_id}] Failed to connect to ElevenLabs: {e}")
            if self.on_error:
                await self.on_error(self.session_id, f"Connection failed: {str(e)}")
            return False

    async def disconnect(self) -> None:
        """Disconnect from ElevenLabs API."""
        self._stopping = True

        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
            self._receive_task = None

        if self._websocket:
            try:
                await self._websocket.close()
            except Exception as e:
                logger.warning(f"[{self.session_id}] Error closing ElevenLabs connection: {e}")
            self._websocket = None

        self._connected = False

        if self.on_status:
            await self.on_status(self.session_id, "disconnected")

        logger.info(f"[{self.session_id}] Disconnected from ElevenLabs")

    async def send_audio(self, audio_data: bytes, commit: bool = False) -> bool:
        """
        Send audio data to ElevenLabs.

        Args:
            audio_data: PCM 16-bit audio data
            commit: If True, signal end of audio stream

        Returns:
            True if sent successfully, False otherwise
        """
        import base64

        if not self._connected or not self._websocket:
            logger.warning(f"[{self.session_id}] Not connected, cannot send audio")
            return False

        try:
            # Send audio as JSON with base64-encoded data
            # Format per ElevenLabs Scribe v2 API
            message = {
                "message_type": "input_audio_chunk",
                "audio_base_64": base64.b64encode(audio_data).decode("utf-8"),
                "commit": commit,
                "sample_rate": 16000,
            }
            await self._websocket.send(json.dumps(message))
            return True
        except Exception as e:
            logger.error(f"[{self.session_id}] Error sending audio: {e}")
            if self.on_error:
                await self.on_error(self.session_id, f"Send error: {str(e)}")
            return False

    async def _receive_loop(self) -> None:
        """Background task to receive and process transcription responses."""
        if not self._websocket:
            return

        try:
            async for message in self._websocket:
                if self._stopping:
                    break

                try:
                    data = json.loads(message)
                    await self._handle_message(data)
                except json.JSONDecodeError:
                    logger.warning(
                        f"[{self.session_id}] Invalid JSON from ElevenLabs: {message[:100]}"
                    )

        except websockets.exceptions.ConnectionClosed as e:
            if not self._stopping:
                logger.warning(f"[{self.session_id}] ElevenLabs connection closed: {e}")
                if self.on_error:
                    await self.on_error(self.session_id, f"Connection closed: {e.reason}")

        except asyncio.CancelledError:
            logger.debug(f"[{self.session_id}] Receive loop cancelled")

        except Exception as e:
            if not self._stopping:
                logger.error(f"[{self.session_id}] Error in receive loop: {e}")
                if self.on_error:
                    await self.on_error(self.session_id, f"Receive error: {str(e)}")

    async def _handle_message(self, data: dict) -> None:
        """
        Handle a message from ElevenLabs.

        Message types:
        - partial_transcript: Real-time ghost text
        - committed_transcript: Finalized transcript after VAD
        - error: Error message

        Args:
            data: Parsed JSON message
        """
        msg_type = data.get("message_type") or data.get("type")

        if msg_type == "partial_transcript":
            text = data.get("text", "")
            if text:
                rprint(f"[dim cyan]🎤 Partial:[/dim cyan] {text}")
                logger.debug(f"[{self.session_id}] Partial: {text}")
            if self.on_partial and text:
                await self.on_partial(self.session_id, text)

        elif msg_type == "committed_transcript":
            text = data.get("text", "")
            is_final = data.get("is_final", False)
            if text:
                final_marker = " [bold](final)[/bold]" if is_final else ""
                rprint(f"[bold green]🎤 Committed{final_marker}:[/bold green] {text}")
                logger.debug(f"[{self.session_id}] Committed: {text}")
            if self.on_committed and text:
                await self.on_committed(self.session_id, text, is_final)

        elif msg_type == "final_transcript":
            # Alternative format for final transcripts
            text = data.get("text", "")
            if text:
                rprint(f"[bold magenta]🎤 Final:[/bold magenta] {text}")
                logger.debug(f"[{self.session_id}] Final: {text}")
            if self.on_committed and text:
                await self.on_committed(self.session_id, text, is_final=True)

        elif msg_type == "error":
            error_msg = data.get("message", "Unknown error")
            logger.error(f"[{self.session_id}] ElevenLabs error: {error_msg}")
            if self.on_error:
                await self.on_error(self.session_id, error_msg)

        elif msg_type in ("config_ack", "session_started"):
            logger.debug(f"[{self.session_id}] ElevenLabs {msg_type}")

        else:
            logger.debug(f"[{self.session_id}] Message type: {msg_type}, data: {data}")

    @property
    def is_connected(self) -> bool:
        """Check if connected to ElevenLabs."""
        return self._connected and self._websocket is not None
