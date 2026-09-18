"""
HTTP Server for App Knowledge.

Provides an HTTP endpoint for serving app knowledge from the database.
App knowledge has one-to-one mapping with knowledge entries.
This server is used by the ServerAppCardProvider to fetch app knowledge.
"""

import asyncio
import logging
import os
from typing import Optional

from aiohttp import web

from droiduse_backend.app_cards.providers.database_provider import (
    DatabaseAppCardProvider,
)

logger = logging.getLogger("droiduse-backend.app-card-server")


class AppCardServer:
    """
    HTTP server for serving app knowledge from the database.

    App knowledge has one-to-one mapping with knowledge entries.
    Provides POST /app-knowledge endpoint that returns app knowledge content
    for a given package name.
    """

    def __init__(self, database_url: Optional[str] = None):
        """
        Initialize app card server.

        Args:
            database_url: Optional database URL. If not provided, uses DATABASE_URL env var.
        """
        self.database_url = database_url or os.environ.get("DATABASE_URL")
        self.provider = DatabaseAppCardProvider(database_url=self.database_url)
        self.app = web.Application()
        self._setup_routes()
        self._runner: Optional[web.AppRunner] = None
        self._site: Optional[web.TCPSite] = None

    def _setup_routes(self) -> None:
        """Setup HTTP routes."""
        self.app.router.add_post("/app-knowledge", self._handle_app_knowledge)
        self.app.router.add_get("/health", self._handle_health)

    async def _handle_app_knowledge(self, request: web.Request) -> web.Response:
        """
        Handle POST /app-knowledge request.

        App knowledge has one-to-one mapping with knowledge entries.

        Expected request body:
        {
            "package_name": "com.google.android.gm",
            "instruction": "optional user instruction"
        }

        Returns:
        {
            "app_knowledge": "markdown content..."
        }
        or 404 if not found.
        """
        try:
            data = await request.json()
        except Exception as e:
            logger.warning(f"Invalid JSON in request: {e}")
            return web.json_response({"error": "Invalid JSON"}, status=400)

        package_name = data.get("package_name", "")
        instruction = data.get("instruction", "")

        if not package_name:
            return web.json_response({"error": "Missing required field: package_name"}, status=400)

        try:
            app_knowledge = await self.provider.load_app_card(
                package_name=package_name,
                instruction=instruction,
            )

            if not app_knowledge:
                return web.json_response({"error": "App knowledge not found"}, status=404)

            return web.json_response({"app_knowledge": app_knowledge})

        except Exception as e:
            logger.exception(f"Error fetching app knowledge: {e}")
            return web.json_response({"error": "Internal server error"}, status=500)

    async def _handle_health(self, request: web.Request) -> web.Response:
        """Handle GET /health request."""
        return web.json_response({"status": "ok"})

    async def start(self, host: str = "0.0.0.0", port: int = 8001) -> None:
        """
        Start the HTTP server.

        Args:
            host: Host address to bind to (default: 0.0.0.0)
            port: Port to listen on (default: 8001)
        """
        self._runner = web.AppRunner(self.app)
        await self._runner.setup()
        self._site = web.TCPSite(self._runner, host, port)
        await self._site.start()
        logger.info(f"App Knowledge HTTP server running on http://{host}:{port}")

    async def stop(self) -> None:
        """Stop the HTTP server and cleanup resources."""
        await self.provider.disconnect()
        if self._runner:
            await self._runner.cleanup()
        logger.info("App Knowledge HTTP server stopped")


async def run_app_card_server(
    host: str = "0.0.0.0",
    port: int = 8001,
    database_url: Optional[str] = None,
) -> None:
    """
    Run the app knowledge HTTP server standalone.

    Args:
        host: Host address to bind to
        port: Port to listen on
        database_url: Optional database URL
    """
    server = AppCardServer(database_url=database_url)
    await server.start(host=host, port=port)

    # Run forever
    try:
        await asyncio.Future()
    except asyncio.CancelledError:
        pass
    finally:
        await server.stop()


def main():
    """Main entry point for standalone app knowledge server."""
    import argparse

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    parser = argparse.ArgumentParser(description="DroidUse App Knowledge Server")
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Host address to bind to (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8001,
        help="Port to listen on (default: 8001)",
    )
    parser.add_argument(
        "--database-url",
        type=str,
        default=None,
        help="Database URL (default: uses DATABASE_URL env var)",
    )
    args = parser.parse_args()

    try:
        asyncio.run(
            run_app_card_server(
                host=args.host,
                port=args.port,
                database_url=args.database_url,
            )
        )
    except KeyboardInterrupt:
        logger.info("Server stopped by user")


if __name__ == "__main__":
    main()
