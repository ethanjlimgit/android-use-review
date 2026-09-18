"""
Admin FastAPI Server for DroidUse Backend.

Provides administrative endpoints for monitoring and managing backend services.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from droiduse_backend.config_manager import AndroidUseConfig

logger = logging.getLogger("droiduse-backend.admin")


# Pydantic models for request/response
class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    timestamp: str
    version: str
    websocket_server_running: bool


class DeviceInfo(BaseModel):
    """Information about a connected device."""

    device_id: Optional[str]
    user_id: Optional[str]
    connected_at: str
    client_address: str


class StatusResponse(BaseModel):
    """Server status response."""

    active_connections: int
    devices: List[DeviceInfo]
    websocket_server_running: bool


class ConfigUpdateRequest(BaseModel):
    """Request to update configuration."""

    path: str  # Dot-separated path like "agent.manager.vision"
    value: Any


class TaskRequest(BaseModel):
    """Request to send a task to a device."""

    device_id: str
    command: str
    config: Optional[Dict[str, Any]] = None


class AdminServer:
    """
    FastAPI admin server for monitoring and managing backend services.

    Provides endpoints for:
    - /health: Server health check
    - /status: Active WebSocket connections and devices
    - /config: Get/set configuration
    - /send_task: Execute task on connected device
    """

    def __init__(
        self, websocket_server: Optional[Any] = None, config: Optional[AndroidUseConfig] = None
    ):
        """
        Initialize admin server.

        Args:
            websocket_server: Optional WebSocketServer instance to monitor
            config: Optional AndroidUseConfig instance
        """
        self.app = FastAPI(title="DroidUse Admin API", version="0.5.0")
        self.websocket_server = websocket_server
        self.config = config or AndroidUseConfig()
        self.server = None
        self.start_time = datetime.now()

        # Setup CORS
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # Configure appropriately for production
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        # Register routes
        self._register_routes()

    def _register_routes(self):
        """Register all API routes."""

        @self.app.get("/health", response_model=HealthResponse)
        async def health_check():
            """
            Health check endpoint.

            Returns:
                HealthResponse with server status
            """
            return HealthResponse(
                status="healthy",
                timestamp=datetime.now().isoformat(),
                version="0.5.0",
                websocket_server_running=self.websocket_server.is_running()
                if self.websocket_server
                else False,
            )

        @self.app.get("/status", response_model=StatusResponse)
        async def get_status():
            """
            Get server status including active WebSocket connections.

            Returns:
                StatusResponse with connection info
            """
            # Get devices from WebSocketServer if available
            if self.websocket_server:
                device_metadata = self.websocket_server.get_device_metadata()
                devices = [
                    DeviceInfo(
                        device_id=meta.get("device_id"),
                        user_id=meta.get("user_id"),
                        connected_at=meta.get("connected_at", ""),
                        client_address=meta.get("client_address", "unknown"),
                    )
                    for meta in device_metadata.values()
                ]
                active_connections = len(devices)
            else:
                devices = []
                active_connections = 0

            return StatusResponse(
                active_connections=active_connections,
                devices=devices,
                websocket_server_running=self.websocket_server.is_running()
                if self.websocket_server
                else False,
            )

        @self.app.get("/config")
        async def get_config():
            """
            Get current configuration.

            Returns:
                Current configuration as JSON
            """
            return self.config.to_dict()

        @self.app.post("/config")
        async def update_config(update: ConfigUpdateRequest):
            """
            Update configuration value.

            Args:
                update: ConfigUpdateRequest with path and value

            Returns:
                Updated configuration value
            """
            try:
                # Parse dot-separated path
                path_parts = update.path.split(".")
                current = self.config

                # Navigate to the parent
                for part in path_parts[:-1]:
                    current = getattr(current, part)

                # Set the value
                setattr(current, path_parts[-1], update.value)

                logger.info(f"Configuration updated: {update.path} = {update.value}")

                return {
                    "success": True,
                    "path": update.path,
                    "value": update.value,
                }
            except Exception as e:
                logger.error(f"Failed to update config: {e}")
                raise HTTPException(
                    status_code=400, detail=f"Failed to update config: {str(e)}"
                ) from e

        @self.app.post("/send_task")
        async def send_task(task: TaskRequest):
            """
            Send a task to a connected device.

            Args:
                task: TaskRequest with device_id and command

            Returns:
                Task execution result
            """
            if not self.websocket_server:
                raise HTTPException(
                    status_code=503,
                    detail="WebSocket server not available",
                )

            try:
                # Send task to device via WebSocketServer
                result = await self.websocket_server.send_task_to_device(
                    device_id=task.device_id,
                    command=task.command,
                    config_dict=task.config,
                )

                return {
                    "success": True,
                    "device_id": task.device_id,
                    "result": result,
                }

            except ValueError as e:
                # Device not connected
                raise HTTPException(
                    status_code=404,
                    detail=str(e),
                ) from e

            except Exception as e:
                logger.error(f"Failed to send task to device {task.device_id}: {e}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to send task: {str(e)}",
                ) from e

    async def start(self, host: str = "0.0.0.0", port: int = 8000):
        """
        Start the admin server.

        Note: Default port changed to 8000 to match WebSocket server.
        The WebSocket server now handles admin API endpoints directly on the same port.

        Args:
            host: Host address to bind to
            port: Port to listen on (default: 8000, same as WebSocket server)
        """
        import uvicorn

        logger.info(f"Starting Admin API server on {host}:{port}")

        config = uvicorn.Config(
            self.app,
            host=host,
            port=port,
            log_level="info",
        )
        server = uvicorn.Server(config)
        await server.serve()

    async def stop(self):
        """Stop the admin server."""
        if self.server:
            self.server.should_exit = True
            logger.info("Admin API server stopped")
