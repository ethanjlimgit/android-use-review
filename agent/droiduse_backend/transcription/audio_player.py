"""
Audio playback module for playing received voice audio.

Uses sounddevice for cross-platform audio playback.
This module is designed to be non-breaking - if sounddevice is not installed
or audio playback fails, it will gracefully degrade without affecting the server.
"""

from __future__ import annotations

import asyncio
import logging
import queue
import threading
from typing import Optional

logger = logging.getLogger("droiduse-backend.audio")

# Audio format constants (matching ElevenLabs config)
SAMPLE_RATE = 16000  # 16kHz
CHANNELS = 1  # Mono

# Try to import numpy, but don't fail if not available
try:
    import numpy as np

    NUMPY_AVAILABLE = True
    DTYPE = np.int16  # 16-bit PCM
except ImportError:
    NUMPY_AVAILABLE = False
    DTYPE = None
    logger.debug("numpy not installed, audio playback disabled")


class AudioPlayer:
    """
    Asynchronous audio player for streaming PCM audio.

    Buffers audio chunks and plays them continuously via sounddevice.
    Thread-safe and non-blocking.
    """

    def __init__(self, sample_rate: int = SAMPLE_RATE, enabled: bool = True):
        """
        Initialize the audio player.

        Args:
            sample_rate: Audio sample rate in Hz (default: 16000)
            enabled: Whether playback is enabled (default: True)
        """
        self.sample_rate = sample_rate
        self.enabled = enabled
        self._queue: queue.Queue[Optional[bytes]] = queue.Queue()
        self._stream = None
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._sd = None  # sounddevice module, imported lazily

    def _ensure_sounddevice(self) -> bool:
        """Lazily import sounddevice to avoid import errors if not installed."""
        if self._sd is not None:
            return True

        if not NUMPY_AVAILABLE:
            logger.debug("numpy not available, cannot use audio playback")
            return False

        try:
            import sounddevice as sd

            self._sd = sd
            return True
        except ImportError:
            logger.info("sounddevice not installed. Install with: pip install sounddevice")
            return False
        except Exception as e:
            logger.warning(f"Failed to import sounddevice: {e}")
            return False

    def start(self) -> bool:
        """
        Start the audio playback thread.

        This method will never raise exceptions - it gracefully handles failures.

        Returns:
            True if started successfully, False otherwise
        """
        if not self.enabled:
            logger.debug("Audio playback disabled")
            return False

        if not self._ensure_sounddevice():
            return False

        if self._running:
            logger.debug("Audio player already running")
            return True

        try:
            self._running = True
            self._thread = threading.Thread(target=self._playback_loop, daemon=True)
            self._thread.start()
            logger.info(f"Audio player started (sample_rate={self.sample_rate}Hz)")
            return True
        except Exception as e:
            logger.warning(f"Failed to start audio playback thread: {e}")
            self._running = False
            return False

    def stop(self) -> None:
        """
        Stop the audio playback thread.

        This method will never raise exceptions - it gracefully handles failures.
        """
        if not self._running:
            return

        self._running = False

        try:
            # Send sentinel to unblock the queue
            self._queue.put_nowait(None)
        except Exception:
            pass

        try:
            if self._thread:
                self._thread.join(timeout=2.0)
                self._thread = None
        except Exception:
            pass

        try:
            if self._stream:
                self._stream.stop()
                self._stream.close()
                self._stream = None
        except Exception:
            pass

        logger.debug("Audio player stopped")

    def play(self, audio_data: bytes) -> None:
        """
        Queue audio data for playback.

        This method is non-blocking and will never raise exceptions.

        Args:
            audio_data: Raw PCM 16-bit audio data
        """
        if not self.enabled or not self._running:
            return

        try:
            self._queue.put_nowait(audio_data)
        except Exception:
            pass  # Ignore queue errors

    async def play_async(self, audio_data: bytes) -> None:
        """
        Async wrapper for play().

        This method will never raise exceptions.

        Args:
            audio_data: Raw PCM 16-bit audio data
        """
        try:
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self.play, audio_data)
        except Exception:
            pass  # Ignore async playback errors

    def _playback_loop(self) -> None:
        """Background thread that plays queued audio."""
        try:
            # Open output stream
            self._stream = self._sd.OutputStream(
                samplerate=self.sample_rate,
                channels=CHANNELS,
                dtype=DTYPE,
            )
            self._stream.start()

            while self._running:
                try:
                    # Get audio data from queue with timeout
                    audio_data = self._queue.get(timeout=0.1)

                    if audio_data is None:
                        # Sentinel received, exit
                        break

                    # Convert bytes to numpy array
                    audio_array = np.frombuffer(audio_data, dtype=DTYPE)

                    # Play audio
                    self._stream.write(audio_array)

                except queue.Empty:
                    continue
                except Exception as e:
                    # Log but don't crash - audio playback is optional
                    logger.debug(f"Error playing audio chunk: {e}")

        except Exception as e:
            # Log but don't crash - audio playback is optional
            logger.warning(f"Error in playback loop: {e}")
            self._running = False
        finally:
            try:
                if self._stream:
                    self._stream.stop()
                    self._stream.close()
            except Exception:
                pass
            self._stream = None


# Global audio player instance
_audio_player: Optional[AudioPlayer] = None
_audio_player_lock = threading.Lock()


def get_audio_player(enabled: bool = True) -> Optional[AudioPlayer]:
    """
    Get or create the global audio player instance.

    This function will never raise exceptions.

    Args:
        enabled: Whether playback is enabled

    Returns:
        AudioPlayer instance or None if creation fails
    """
    global _audio_player
    try:
        with _audio_player_lock:
            if _audio_player is None:
                _audio_player = AudioPlayer(enabled=enabled)
            return _audio_player
    except Exception as e:
        logger.warning(f"Failed to create audio player: {e}")
        return None


def play_audio(audio_data: bytes) -> None:
    """
    Play audio data using the global audio player.

    This function will never raise exceptions.

    Args:
        audio_data: Raw PCM 16-bit audio data
    """
    try:
        player = get_audio_player()
        if player and player._running:
            player.play(audio_data)
    except Exception:
        pass


async def play_audio_async(audio_data: bytes) -> None:
    """
    Async version of play_audio.

    This function will never raise exceptions.

    Args:
        audio_data: Raw PCM 16-bit audio data
    """
    try:
        player = get_audio_player()
        if player and player._running:
            await player.play_async(audio_data)
    except Exception:
        pass
