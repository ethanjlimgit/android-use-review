"""
Transcription module for real-time speech-to-text using ElevenLabs Scribe v2.

This module provides a Stream Relay architecture where the Python backend acts as a
proxy between the Android app and ElevenLabs Scribe v2 API, protecting API keys and
enabling LLM processing of transcripts.
"""

from droiduse_backend.config_manager import TranscriptionConfig
from droiduse_backend.transcription.audio_player import (
    AudioPlayer,
    get_audio_player,
    play_audio,
    play_audio_async,
)
from droiduse_backend.transcription.elevenlabs_relay import ElevenLabsRelay
from droiduse_backend.transcription.session_manager import TranscriptionSessionManager

__all__ = [
    "TranscriptionConfig",
    "ElevenLabsRelay",
    "TranscriptionSessionManager",
    "AudioPlayer",
    "get_audio_player",
    "play_audio",
    "play_audio_async",
]
