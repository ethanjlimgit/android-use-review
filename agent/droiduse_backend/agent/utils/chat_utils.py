"""
Chat message utilities.

Provides helper functions for working with message dictionaries,
code extraction, and message history management.
"""

import logging
import re
from collections import Counter
from io import BytesIO
from pathlib import Path
from typing import Optional, Tuple, Union

from PIL import Image

logger = logging.getLogger("androiduse")


# ============================================================================
# REPETITION DETECTION
# ============================================================================


def detect_repetition(
    text: str,
    min_phrase_length: int = 15,
    max_repeats: int = 3,
    similarity_threshold: float = 0.8,
) -> Tuple[bool, Optional[str], int]:
    """
    Detect if text contains repetitive loops (e.g., LLM stuck in a loop).

    This catches patterns like:
    - "Wait, I'll use the click action." repeated 100+ times
    - Same sentence/phrase appearing many times consecutively

    Args:
        text: Text to analyze
        min_phrase_length: Minimum phrase length to consider (chars)
        max_repeats: Maximum allowed repeats before flagging
        similarity_threshold: How similar phrases must be (0.0-1.0)

    Returns:
        Tuple of (is_repetitive, repeated_phrase, repeat_count)
    """
    if not text or len(text) < min_phrase_length * 2:
        return False, None, 0

    # Split into lines and normalize
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    if len(lines) < max_repeats:
        return False, None, 0

    # Count exact line duplicates
    line_counts = Counter(lines)
    for line, count in line_counts.most_common(5):
        if count > max_repeats and len(line) >= min_phrase_length:
            return True, line, count

    # Check for consecutive similar phrases (handles slight variations)
    consecutive_similar = 1
    last_line = None
    for line in lines:
        if last_line and len(line) >= min_phrase_length:
            # Simple similarity: shared words ratio
            words1 = set(line.lower().split())
            words2 = set(last_line.lower().split())
            if words1 and words2:
                intersection = len(words1 & words2)
                union = len(words1 | words2)
                similarity = intersection / union if union > 0 else 0

                if similarity >= similarity_threshold:
                    consecutive_similar += 1
                    if consecutive_similar > max_repeats:
                        return True, line, consecutive_similar
                else:
                    consecutive_similar = 1
        last_line = line

    # Check for repeated short patterns (like "Wait, I'll")
    pattern = re.compile(r"((?:\S+\s+){3,6})\1{3,}", re.IGNORECASE)
    match = pattern.search(text)
    if match:
        repeated = match.group(1).strip()
        count = text.count(repeated)
        if count > max_repeats:
            return True, repeated, count

    return False, None, 0


def sanitize_repetitive_response(
    text: str,
    max_length: int = 8000,
    max_repeats: int = 3,
) -> Tuple[str, bool]:
    """
    Sanitize LLM response by removing repetitive content.

    Args:
        text: Raw LLM response
        max_length: Maximum response length to allow
        max_repeats: Max times a phrase can repeat

    Returns:
        Tuple of (sanitized_text, was_modified)
    """
    is_repetitive, phrase, count = detect_repetition(text, max_repeats=max_repeats)

    if not is_repetitive:
        # Just truncate if too long
        if len(text) > max_length:
            return text[:max_length] + "\n[Response truncated due to length]", True
        return text, False

    logger.warning(f"Detected repetitive LLM output: '{phrase[:50]}...' repeated {count} times")

    # Remove repetitions, keep first few occurrences
    if phrase:
        lines = text.split("\n")
        seen_count = 0
        filtered_lines = []

        for line in lines:
            if phrase in line or (len(line.strip()) > 10 and line.strip() == phrase):
                seen_count += 1
                if seen_count <= max_repeats:
                    filtered_lines.append(line)
                elif seen_count == max_repeats + 1:
                    filtered_lines.append(
                        f"[Repetitive content removed: '{phrase[:30]}...' x{count}]"
                    )
            else:
                filtered_lines.append(line)

        sanitized = "\n".join(filtered_lines)
    else:
        # Fallback: just truncate
        sanitized = text[:max_length]

    return sanitized, True


# ============================================================================
# IMAGE UTILITIES
# ============================================================================


def ensure_image_bytes(image_source: Union[str, Path, Image.Image, bytes]) -> bytes:
    """
    Convert image to PNG bytes.

    Args:
        image_source: Image as bytes, file path, or PIL Image

    Returns:
        PNG-encoded bytes
    """
    if isinstance(image_source, bytes):
        return image_source
    if isinstance(image_source, (str, Path)):
        image = Image.open(image_source)
    elif isinstance(image_source, Image.Image):
        image = image_source
    else:
        raise ValueError(f"Unsupported image type: {type(image_source)}")

    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


# ============================================================================
# CODE EXTRACTION
# ============================================================================


def extract_code_and_thought(response_text: str) -> Tuple[Optional[str], str]:
    """
    Extract code from Markdown blocks (```python ... ```) and the surrounding text (thought).

    Args:
        response_text: LLM response text that may contain code blocks

    Returns:
        Tuple of (extracted_code, thought_text) where extracted_code is None if no code found
    """
    first_backticks = response_text.find("```")
    if first_backticks == -1:
        return None, response_text.strip()

    last_backticks = response_text.rfind("```")
    if first_backticks == last_backticks:
        return None, response_text.strip()

    code_block = response_text[first_backticks : last_backticks + 3]

    if code_block.startswith("```python"):
        code_content = code_block[9:]
    elif code_block.startswith("```py"):
        code_content = code_block[5:]
    else:
        code_content = code_block[3:]

    if code_content.endswith("```"):
        code_content = code_content[:-3]

    extracted_code = code_content.strip()

    thought_before = response_text[:first_backticks].strip()
    thought_after = response_text[last_backticks + 3 :].strip()
    thought_text = (thought_before + " " + thought_after).strip()

    return extracted_code, thought_text


# ============================================================================
# MESSAGE UTILITIES
# ============================================================================


def has_content(message: dict) -> bool:
    """
    Check if a message dict has non-empty content.

    Args:
        message: Message dict with 'content' list

    Returns:
        True if message has text or image content
    """
    for item in message.get("content", []):
        if "text" in item and item["text"].strip():
            return True
        if "image" in item and item["image"]:
            return True
    return False


def filter_empty_messages(messages: list[dict]) -> list[dict]:
    """
    Filter out messages with no content.

    Args:
        messages: List of message dicts

    Returns:
        List with empty messages removed
    """
    return [msg for msg in messages if has_content(msg)]


def limit_history(
    messages: list[dict], max_messages: int, preserve_first: bool = True
) -> list[dict]:
    """
    Limit message history to max_messages, optionally preserving the first message.

    Args:
        messages: List of message dicts
        max_messages: Maximum number of messages to keep
        preserve_first: If True, always include the first message (system prompt)

    Returns:
        Truncated list of messages
    """
    if len(messages) <= max_messages:
        return messages

    if preserve_first and messages:
        first = messages[0]
        tail = messages[-max_messages + 1 :]
        if first not in tail:
            return [first] + tail
        return tail

    return messages[-max_messages:]


def get_text_content(message: dict) -> str:
    """
    Extract all text content from a message dict.

    Args:
        message: Message dict with 'content' list

    Returns:
        Concatenated text content
    """
    texts = []
    for item in message.get("content", []):
        if "text" in item:
            texts.append(item["text"])
    return "\n".join(texts)


def create_message(role: str, text: str, image: Optional[bytes] = None) -> dict:
    """
    Create a message dict with optional image.

    Args:
        role: Message role ("system", "user", "assistant")
        text: Text content
        image: Optional image bytes

    Returns:
        Message dict ready for LLM call
    """
    content = [{"text": text}]
    if image:
        content.append({"image": image})
    return {"role": role, "content": content}
