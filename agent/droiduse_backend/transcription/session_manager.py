"""
Transcription session manager.

Manages multiple concurrent transcription sessions, routing audio from phones
to ElevenLabs and transcripts back to phones.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from typing import Any, Callable, Coroutine, Dict, Optional

from websockets.server import WebSocketServerProtocol

from droiduse_backend.config_manager import TranscriptionConfig
from droiduse_backend.transcription.elevenlabs_relay import ElevenLabsRelay

logger = logging.getLogger("droiduse-backend.transcription")


class TranscriptionSession:
    """Represents an active transcription session."""

    def __init__(
        self,
        session_id: str,
        phone_websocket: WebSocketServerProtocol,
        relay: ElevenLabsRelay,
        max_duration: int = 300,
    ):
        self.session_id = session_id
        self.phone_websocket = phone_websocket
        self.relay = relay
        self.max_duration = max_duration
        self.started_at = time.time()
        self._timeout_task: Optional[asyncio.Task] = None

    def start_timeout(self, on_timeout: asyncio.coroutines) -> None:
        """Start session timeout timer."""
        self._timeout_task = asyncio.create_task(self._timeout_loop(on_timeout))

    async def _timeout_loop(self, on_timeout) -> None:
        """Background task to enforce session timeout."""
        try:
            await asyncio.sleep(self.max_duration)
            logger.info(f"[{self.session_id}] Session timeout reached ({self.max_duration}s)")
            await on_timeout(self.session_id)
        except asyncio.CancelledError:
            pass

    def cancel_timeout(self) -> None:
        """Cancel the timeout timer."""
        if self._timeout_task:
            self._timeout_task.cancel()
            self._timeout_task = None

    @property
    def elapsed_time(self) -> float:
        """Get elapsed session time in seconds."""
        return time.time() - self.started_at


class TranscriptionSessionManager:
    """
    Manages multiple transcription sessions.

    Handles:
    - Session lifecycle (start, stop, cleanup)
    - Routing audio from phones to ElevenLabs relays
    - Routing transcripts from relays back to phones
    - Injecting committed transcripts into agent workflows
    """

    def __init__(
        self,
        config: TranscriptionConfig,
        on_committed_transcript: Optional[
            Callable[[str, str, bool], Coroutine[Any, Any, None]]
        ] = None,
    ):
        """
        Initialize the session manager.

        Args:
            config: Transcription configuration
            on_committed_transcript: Optional callback for committed transcripts (session_id, text, is_final)
                                    Use this to inject voice instructions into agent workflows.
        """
        self.config = config
        self._sessions: Dict[str, TranscriptionSession] = {}
        self._lock = asyncio.Lock()
        self._on_committed_transcript = on_committed_transcript

    async def start_session(
        self,
        phone_websocket: WebSocketServerProtocol,
        language: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> Optional[str]:
        """
        Start a new transcription session.

        Args:
            phone_websocket: WebSocket connection to the phone
            language: Language code for transcription (None for auto-detect)
            session_id: Optional session ID (generated if not provided)

        Returns:
            Session ID if started successfully, None otherwise
        """
        if not self.config.is_configured():
            logger.error("Transcription not configured")
            await self._send_error(phone_websocket, None, "Transcription not configured")
            return None

        session_id = session_id or str(uuid.uuid4())

        async with self._lock:
            # Check if session already exists
            if session_id in self._sessions:
                logger.warning(f"Session {session_id} already exists")
                await self._send_error(phone_websocket, session_id, "Session already exists")
                return None

            # Create relay with callbacks
            relay = ElevenLabsRelay(
                config=self.config,
                session_id=session_id,
                on_partial=self._on_partial_transcript,
                on_committed=self._on_committed_transcript_internal,
                on_error=self._on_error,
                on_status=self._on_status,
                language=language,
            )

            # Connect to ElevenLabs
            if not await relay.connect():
                return None

            # Create session
            session = TranscriptionSession(
                session_id=session_id,
                phone_websocket=phone_websocket,
                relay=relay,
                max_duration=self.config.max_session_duration,
            )

            # Start timeout timer
            session.start_timeout(self._on_session_timeout)

            self._sessions[session_id] = session

        logger.info(f"Started transcription session {session_id}")

        # Send status to phone
        await self._send_status(phone_websocket, session_id, "started")

        return session_id

    async def stop_session(self, session_id: str) -> bool:
        """
        Stop a transcription session.

        Args:
            session_id: Session ID to stop

        Returns:
            True if session was stopped, False if not found
        """
        async with self._lock:
            session = self._sessions.pop(session_id, None)

        if not session:
            logger.warning(f"Session {session_id} not found")
            return False

        # Cancel timeout
        session.cancel_timeout()

        # Disconnect relay
        await session.relay.disconnect()

        # Send status to phone
        try:
            await self._send_status(session.phone_websocket, session_id, "stopped")
        except Exception as e:
            logger.warning(f"[{session_id}] Error sending stop status: {e}")

        logger.info(f"Stopped transcription session {session_id}")
        return True

    async def forward_audio(self, session_id: str, audio_data: bytes) -> bool:
        """
        Forward audio data to ElevenLabs.

        Args:
            session_id: Session ID
            audio_data: PCM 16-bit audio data

        Returns:
            True if forwarded successfully, False otherwise
        """
        async with self._lock:
            session = self._sessions.get(session_id)

        if not session:
            # This can happen normally when audio packets arrive after a session ends
            logger.debug(f"Session {session_id} not found for audio forwarding")
            return False

        return await session.relay.send_audio(audio_data)

    async def cleanup_phone_sessions(self, phone_websocket: WebSocketServerProtocol) -> None:
        """
        Clean up all sessions for a disconnected phone.

        Args:
            phone_websocket: The disconnected phone's WebSocket
        """
        sessions_to_stop = []

        async with self._lock:
            for session_id, session in self._sessions.items():
                if session.phone_websocket == phone_websocket:
                    sessions_to_stop.append(session_id)

        for session_id in sessions_to_stop:
            await self.stop_session(session_id)

    def get_active_sessions(self) -> Dict[str, Dict[str, Any]]:
        """
        Get information about active sessions.

        Returns:
            Dictionary of session_id -> session info
        """
        result = {}
        for session_id, session in self._sessions.items():
            result[session_id] = {
                "session_id": session_id,
                "elapsed_time": session.elapsed_time,
                "max_duration": session.max_duration,
                "connected": session.relay.is_connected,
            }
        return result

    def has_session(self, session_id: str) -> bool:
        """
        Check if a session exists.

        Args:
            session_id: The session ID to check

        Returns:
            True if session exists, False otherwise
        """
        return session_id in self._sessions

    async def _on_session_timeout(self, session_id: str) -> None:
        """Handle session timeout."""
        session = self._sessions.get(session_id)
        if session:
            # Send timeout notification to phone
            try:
                await self._send_error(
                    session.phone_websocket,
                    session_id,
                    f"Session timeout ({self.config.max_session_duration}s)",
                )
            except Exception:
                pass

        await self.stop_session(session_id)

    async def _on_partial_transcript(self, session_id: str, text: str) -> None:
        """Handle partial transcript from ElevenLabs."""
        session = self._sessions.get(session_id)
        if not session:
            return

        message = {
            "type": "transcription_partial",
            "session_id": session_id,
            "text": text,
        }

        try:
            await session.phone_websocket.send(json.dumps(message))
        except Exception as e:
            logger.warning(f"[{session_id}] Error sending partial transcript: {e}")

    async def _on_committed_transcript_internal(
        self, session_id: str, text: str, is_final: bool
    ) -> None:
        """Handle committed transcript from ElevenLabs."""
        session = self._sessions.get(session_id)
        if not session:
            return

        message = {
            "type": "transcription_committed",
            "session_id": session_id,
            "text": text,
            "is_final": is_final,
        }

        try:
            await session.phone_websocket.send(json.dumps(message))
        except Exception as e:
            logger.warning(f"[{session_id}] Error sending committed transcript: {e}")

        # Call the external callback if provided (for agent injection)
        if self._on_committed_transcript and text:
            try:
                await self._on_committed_transcript(session_id, text, is_final)
            except Exception as e:
                logger.warning(f"[{session_id}] Error in committed transcript callback: {e}")

    async def _on_error(self, session_id: str, error_message: str) -> None:
        """Handle error from ElevenLabs."""
        session = self._sessions.get(session_id)
        if not session:
            return

        await self._send_error(session.phone_websocket, session_id, error_message)

    async def _on_status(self, session_id: str, status: str) -> None:
        """Handle status update from ElevenLabs."""
        session = self._sessions.get(session_id)
        if not session:
            return

        await self._send_status(session.phone_websocket, session_id, status)

    async def _send_error(
        self,
        websocket: WebSocketServerProtocol,
        session_id: Optional[str],
        error_message: str,
    ) -> None:
        """Send error message to phone."""
        message = {
            "type": "transcription_error",
            "session_id": session_id,
            "error": error_message,
        }

        try:
            await websocket.send(json.dumps(message))
        except Exception as e:
            logger.warning(f"Error sending transcription error: {e}")

    async def _send_status(
        self,
        websocket: WebSocketServerProtocol,
        session_id: str,
        status: str,
    ) -> None:
        """Send status message to phone."""
        message = {
            "type": "transcription_status",
            "session_id": session_id,
            "status": status,
        }

        try:
            await websocket.send(json.dumps(message))
        except Exception as e:
            logger.warning(f"[{session_id}] Error sending status: {e}")
