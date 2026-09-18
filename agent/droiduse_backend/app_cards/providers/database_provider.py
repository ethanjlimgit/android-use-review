"""
HTTP-based app card provider.

Fetches app cards from the Next.js API instead of directly from PostgreSQL.
"""

import logging
from typing import Dict, Optional

from droiduse_backend.app_cards.app_card_provider import AppCardProvider
from droiduse_backend.db.http_client import get_app_knowledge

logger = logging.getLogger("androiduse")


class DatabaseAppCardProvider(AppCardProvider):
    """Load app cards from Next.js API with in-memory caching."""

    def __init__(self, database_url: Optional[str] = None):
        """
        Initialize HTTP-based provider.

        Args:
            database_url: Unused parameter kept for backward compatibility.
        """
        self._content_cache: Dict[tuple[str, str], str] = {}

    async def load_app_card(self, package_name: str, instruction: str = "") -> str:
        """
        Load app card via HTTP API.

        Queries the Next.js API for app knowledge entries associated with the given package name.
        Returns formatted markdown content from knowledge entries.

        Args:
            package_name: Android package name (e.g., "com.google.android.gm")
            instruction: User instruction/goal (optional, enables RAG-based filtering)

        Returns:
            App card content or empty string if not found or on error
        """
        if not package_name:
            return ""

        # Check content cache first
        cache_key = (package_name, instruction)
        if cache_key in self._content_cache:
            return self._content_cache[cache_key]

        try:
            # Fetch app knowledge via HTTP API
            app_card = await get_app_knowledge(package_name, instruction)

            # Cache the result
            self._content_cache[cache_key] = app_card

            if app_card:
                logger.debug(
                    f"Loaded app card from API for {package_name}"
                    + (f" with instruction: {instruction}" if instruction else "")
                )
            else:
                logger.debug(f"No app card found for package: {package_name}")

            return app_card

        except Exception as e:
            logger.warning(f"Error loading app card from API: {e}")
            self._content_cache[cache_key] = ""
            return ""

    def clear_cache(self) -> None:
        """Clear content cache."""
        self._content_cache.clear()
        logger.debug("Database app card cache cleared")

    def get_cache_stats(self) -> Dict[str, int]:
        """
        Get cache statistics.

        Returns:
            Dict with cache stats
        """
        return {
            "content_entries": len(self._content_cache),
        }

    async def disconnect(self) -> None:
        """Disconnect (no-op for HTTP provider)."""
        logger.debug("Database app card provider disconnected")
