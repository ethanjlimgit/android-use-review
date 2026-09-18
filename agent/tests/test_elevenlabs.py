#!/usr/bin/env python3
"""
Test script to verify ElevenLabs Scribe v2 transcription works.

Usage:
    python test_elevenlabs.py

Requirements:
    - ELEVENLABS_API_KEY environment variable set
    - Microphone access (or use a test audio file)
"""

import asyncio
import os
import sys

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from droiduse_backend.config_manager import TranscriptionConfig
from droiduse_backend.transcription.elevenlabs_relay import ElevenLabsRelay


async def on_partial(session_id: str, text: str) -> None:
    print(f"[PARTIAL] {text}")


async def on_committed(session_id: str, text: str, is_final: bool) -> None:
    print(f"[COMMITTED] (final={is_final}): {text}")


async def on_error(session_id: str, error: str) -> None:
    print(f"[ERROR] {error}")


async def on_status(session_id: str, status: str) -> None:
    print(f"[STATUS] {status}")


def load_api_key() -> str:
    """Load API key from environment or config.yaml."""
    # First try environment variable
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if api_key:
        return api_key

    # Try loading from config.yaml
    config_paths = [
        os.path.join(os.path.dirname(__file__), "..", "droiduse_backend", "config.yaml"),
        os.path.join(os.path.dirname(__file__), "..", "config.yaml"),
    ]
    for config_path in config_paths:
        if os.path.exists(config_path):
            try:
                import yaml

                with open(config_path) as f:
                    cfg = yaml.safe_load(f)
                    key = cfg.get("transcription", {}).get("elevenlabs_api_key", "")
                    if key:
                        return key
            except Exception:
                pass
    return ""


async def test_with_audio_file(audio_path: str):
    """Test with an audio file (must be PCM 16-bit 16kHz mono)."""
    api_key = load_api_key()
    if not api_key:
        print("ERROR: Set ELEVENLABS_API_KEY environment variable or add to config.yaml")
        return False

    config = TranscriptionConfig(
        enabled=True,
        elevenlabs_api_key=api_key,
    )

    relay = ElevenLabsRelay(
        config=config,
        session_id="test-session",
        on_partial=on_partial,
        on_committed=on_committed,
        on_error=on_error,
        on_status=on_status,
    )

    print("Connecting to ElevenLabs...")
    connected = await relay.connect()
    if not connected:
        print("Failed to connect!")
        return False

    print(f"Connected! Sending audio from: {audio_path}")

    # Read and send audio in chunks
    chunk_size = 32000  # 1 second of 16kHz audio (16000 samples * 2 bytes)
    chunks_sent = 0
    try:
        with open(audio_path, "rb") as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                await relay.send_audio(chunk, commit=False)
                chunks_sent += 1
                await asyncio.sleep(0.5)  # Delay between chunks

        # Send final commit
        await asyncio.sleep(0.5)
        await relay.send_audio(b"", commit=True)

        print(f"Audio sent ({chunks_sent} chunks). Waiting for transcription...")
        # Wait for transcription to complete
        for i in range(5):
            await asyncio.sleep(1)
            print(f"  Waiting... {i+1}s")

    finally:
        await relay.disconnect()

    return True


async def test_connection_only():
    """Just test that connection to ElevenLabs works."""
    api_key = load_api_key()
    if not api_key:
        print("ERROR: Set ELEVENLABS_API_KEY environment variable or add to config.yaml")
        return False

    print(f"API Key: {api_key[:8]}...{api_key[-4:]}")

    config = TranscriptionConfig(
        enabled=True,
        elevenlabs_api_key=api_key,
    )

    relay = ElevenLabsRelay(
        config=config,
        session_id="test-session",
        on_partial=on_partial,
        on_committed=on_committed,
        on_error=on_error,
        on_status=on_status,
    )

    print("Connecting to ElevenLabs Scribe v2...")
    connected = await relay.connect()

    if connected:
        print("SUCCESS: Connected to ElevenLabs!")
        print("Disconnecting...")
        await relay.disconnect()
        return True
    else:
        print("FAILED: Could not connect to ElevenLabs")
        return False


async def main():
    print("=" * 50)
    print("ElevenLabs Scribe v2 Transcription Test")
    print("=" * 50)

    if len(sys.argv) > 1:
        audio_path = sys.argv[1]
        success = await test_with_audio_file(audio_path)
    else:
        print("\nTesting connection only...")
        print("(Pass an audio file path to test transcription)")
        print()
        success = await test_connection_only()

    print()
    if success:
        print("TEST PASSED")
    else:
        print("TEST FAILED")

    return success


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
