"""
Heartbeat Server for DroidUse Backend.

Periodically sends server status updates to a control plane API endpoint.
"""

import asyncio
import logging
import socket
from typing import Callable, Optional

import httpx

from droiduse_backend.config_manager import HeartbeatServerConfig

logger = logging.getLogger("droiduse-backend.heartbeat")


class HeartbeatServer:
    """
    Heartbeat server that periodically reports server status to control plane.

    Sends POST requests to configured API endpoint with server metadata and status.
    Uses callback pattern to get server state without direct dependencies.
    """

    def __init__(
        self,
        config: HeartbeatServerConfig,
        server_port: int = 8000,
        public_ip_address: str = "",
        server_name: str = "",
        server_region: str = "unknown",
        server_capacity: int = 10,
        get_active_connections: Optional[Callable[[], int]] = None,
        is_server_running: Optional[Callable[[], bool]] = None,
    ):
        """
        Initialize heartbeat server.

        Args:
            config: HeartbeatServerConfig instance
            server_port: Port the WebSocket server is running on
            public_ip_address: Public IP address from WebSocket server config
            server_name: Server name identifier (e.g., "agent-prod-1")
            server_region: Server region (e.g., "us-east")
            server_capacity: Maximum concurrent connections/tasks
            get_active_connections: Callback function to get active connection count
            is_server_running: Callback function to check if server is running
        """
        self.config = config
        self.server_port = server_port
        self.public_ip_address = public_ip_address
        self.server_name = server_name
        self.server_region = server_region
        self.server_capacity = server_capacity
        self._get_active_connections = get_active_connections or (lambda: 0)
        self._is_server_running = is_server_running or (lambda: False)
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._http_client: Optional[httpx.AsyncClient] = None
        self._private_ip_address = self._get_private_ip()

    def _get_private_ip(self) -> str:
        """Get private IP address of the server."""
        try:
            # Create a socket to find local IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            # Doesn't need to be reachable
            s.connect(("10.255.255.255", 1))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"

    async def _fetch_public_ip_if_needed(self):
        """Fetch public IP address using an external service if not already configured."""
        if self.public_ip_address:
            return  # Already configured

        try:
            if self._http_client:
                response = await self._http_client.get(
                    "https://api.ipify.org?format=json", timeout=5.0
                )
                if response.status_code == 200:
                    data = response.json()
                    self.public_ip_address = data.get("ip", "")
                    if self.public_ip_address:
                        logger.info(f"Detected public IP: {self.public_ip_address}")
        except Exception as e:
            logger.debug(f"Failed to fetch public IP: {e}")

    def _get_heartbeat_payload(self) -> dict:
        """
        Build heartbeat payload with current server status.

        Returns:
            Dictionary with server metadata and status
        """
        # Get active connections via callback
        active_connections = self._get_active_connections()

        # Determine status based on heartbeat server running state and main server state
        if self._running and self._is_server_running():
            status = "online"
        elif self._running:
            status = "starting"
        else:
            status = "offline"

        return {
            "name": self.server_name,
            "ipAddress": self.public_ip_address,
            "privateIpAddress": self._private_ip_address,
            "port": self.server_port,
            "region": self.server_region,
            "capacity": self.server_capacity,
            "activeConnections": active_connections,
            "status": status,
        }

    async def _send_heartbeat(self):
        """Send heartbeat to control plane API."""
        if not self.config.heartbeat_api_url:
            logger.warning("Heartbeat API URL not configured, skipping heartbeat")
            return

        if not self._http_client:
            logger.error("HTTP client not initialized")
            return

        try:
            url = f"{self.config.heartbeat_api_url.rstrip('/')}/api/agent-servers/heartbeat"
            payload = self._get_heartbeat_payload()

            logger.debug(f"Sending heartbeat to {url}: {payload}")

            response = await self._http_client.post(
                url,
                json=payload,
                timeout=10.0,
            )

            if response.status_code == 200:
                logger.debug("Heartbeat sent successfully")
            else:
                logger.warning(
                    f"Heartbeat failed with status {response.status_code}: {response.text}"
                )

        except httpx.TimeoutException:
            logger.warning("Heartbeat request timed out")
        except httpx.ConnectError:
            logger.warning(f"Failed to connect to heartbeat API: {self.config.heartbeat_api_url}")
        except Exception as e:
            logger.error(f"Error sending heartbeat: {e}")

    async def _heartbeat_loop(self):
        """Main heartbeat loop that runs periodically."""
        logger.info(
            f"Heartbeat server started (interval: {self.config.heartbeat_interval}s, "
            f"target: {self.config.heartbeat_api_url})"
        )

        # Try to fetch public IP if not configured
        await self._fetch_public_ip_if_needed()

        while self._running:
            try:
                await self._send_heartbeat()
            except Exception as e:
                logger.error(f"Unexpected error in heartbeat loop: {e}")

            # Wait for next heartbeat interval
            await asyncio.sleep(self.config.heartbeat_interval)

    async def start(self):
        """Start the heartbeat server."""
        if not self.config.enabled:
            logger.info("Heartbeat server disabled in config")
            return

        if self._running:
            logger.warning("Heartbeat server already running")
            return

        self._running = True

        # Initialize HTTP client
        self._http_client = httpx.AsyncClient()

        # Start heartbeat loop
        self._task = asyncio.create_task(self._heartbeat_loop())

        logger.info(
            f"Heartbeat server initialized (name: {self.server_name}, "
            f"region: {self.server_region})"
        )

    async def stop(self):
        """Stop the heartbeat server."""
        if not self._running:
            return

        logger.info("Stopping heartbeat server...")
        self._running = False

        # Cancel heartbeat task
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        # Close HTTP client
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None

        logger.info("Heartbeat server stopped")

    def is_running(self) -> bool:
        """Check if heartbeat server is running."""
        return self._running
