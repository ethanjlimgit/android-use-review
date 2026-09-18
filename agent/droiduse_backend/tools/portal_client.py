"""
Portal Client - Direct TCP communication layer for AndroidUse Portal app.

This module provides direct TCP HTTP communication with Portal without ADB.
"""

import base64
import json
import logging
from typing import Any, Dict, List

import httpx

from droiduse_backend.tools.device import Device

logger = logging.getLogger("androiduse")


class PortalClient:
    """
    Direct TCP client for AndroidUse Portal communication.

    Connects directly to Portal's HTTP server via device IP address.
    No ADB or content provider dependencies - pure TCP HTTP communication.

    Key features:
    - Direct TCP connection to Portal HTTP server
    - No ADB port forwarding required
    - No content provider fallback
    - Simple and fast
    """

    def __init__(self, device: Device, token: str):
        """
        Initialize Portal client.

        Args:
            device: Device instance with address and connection info
            token: Bearer token for authentication (required)

        Note:
            Call `await client.connect()` after initialization to establish connection.
        """
        self.device = device
        self.tcp_base_url = device.base_url
        self.tcp_available = False
        self._connected = False
        self.token = token

    async def connect(self) -> None:
        """
        Establish direct TCP connection to Portal.
        """
        if self._connected:
            return

        logger.debug(f"Connecting to Portal at {self.tcp_base_url}")

        if await self._test_connection():
            self.tcp_available = True
            logger.debug(f"✓ Connected to Portal: {self.tcp_base_url}")
        else:
            raise ConnectionError(f"Failed to connect to Portal at {self.tcp_base_url}")

        self._connected = True

    async def _ensure_connected(self) -> None:
        """Check if connected, raise error if not."""
        if not self._connected:
            await self.connect()

    def _get_headers(self) -> Dict[str, str]:
        """Get HTTP headers with Bearer token."""
        headers = {"Authorization": f"Bearer {self.token}"}
        return headers

    async def _test_connection(self) -> bool:
        """Test if TCP connection to Portal is working."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.tcp_base_url}/ping", headers=self._get_headers(), timeout=5
                )
                return response.status_code == 200
        except Exception as e:
            logger.debug(f"TCP connection test failed: {e}")
            return False

    async def get_state(self) -> Dict[str, Any]:
        """
        Get device state (accessibility tree + phone state).

        Returns:
            Dictionary containing 'a11y_tree' and 'phone_state' keys
        """
        await self._ensure_connected()
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.tcp_base_url}/state_full",
                    headers=self._get_headers(),
                    timeout=10,
                )
                if response.status_code == 200:
                    data = response.json()

                    # Handle nested "data" field
                    if isinstance(data, dict) and "result" in data:
                        if isinstance(data["result"], str):
                            return json.loads(data["result"])
                        else:
                            return data["result"]
                    return data
                else:
                    raise ConnectionError(f"Failed to get state: HTTP {response.status_code}")
        except Exception as e:
            logger.error(f"Failed to get state: {e}")
            raise

    async def input_text(self, text: str, clear: bool = False) -> bool:
        """
        Input text via keyboard.

        Args:
            text: Text to input
            clear: Whether to clear existing text first

        Returns:
            True if successful, False otherwise
        """
        await self._ensure_connected()
        try:
            encoded = base64.b64encode(text.encode()).decode()
            payload = {"base64_text": encoded, "clear": clear}
            headers = self._get_headers()
            headers["Content-Type"] = "application/json"
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.tcp_base_url}/keyboard/input",
                    json=payload,
                    headers=headers,
                    timeout=10,
                )
                if response.status_code == 200:
                    logger.debug("TCP input_text successful")
                    return True
                else:
                    logger.error(f"Input text failed: HTTP {response.status_code}")
                    return False
        except Exception as e:
            logger.error(f"Input text error: {e}")
            return False

    async def take_screenshot(self, hide_overlay: bool = True) -> bytes:
        """
        Take screenshot of device.

        Args:
            hide_overlay: Whether to hide Portal overlay during screenshot

        Returns:
            Screenshot image bytes (PNG format)
        """
        await self._ensure_connected()
        try:
            url = f"{self.tcp_base_url}/screenshot"
            if not hide_overlay:
                url += "?hideOverlay=false"

            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=self._get_headers(), timeout=10.0)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == "success" and "data" in data:
                        logger.debug("Screenshot taken via TCP")
                        return base64.b64decode(data["data"])
                    else:
                        raise ValueError("Invalid screenshot response format")
                else:
                    raise ConnectionError(f"Screenshot failed: HTTP {response.status_code}")
        except Exception as e:
            logger.error(f"Screenshot error: {e}")
            raise

    async def get_apps(self, include_system: bool = True) -> List[Dict[str, str]]:
        """
        Get installed apps with package name and label.

        Args:
            include_system: Whether to include system apps

        Returns:
            List of dicts with 'package' and 'label' keys
        """
        await self._ensure_connected()
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.tcp_base_url}/apps",
                    headers=self._get_headers(),
                    timeout=10.0,
                )
                if response.status_code == 200:
                    data = response.json()
                    apps = data.get("apps", []) if isinstance(data, dict) else data
                    if not include_system:
                        apps = [app for app in apps if not app.get("isSystemApp", False)]
                    return [
                        {
                            "package": app.get("packageName", ""),
                            "label": app.get("label", ""),
                        }
                        for app in apps
                    ]
                else:
                    raise ConnectionError(f"Failed to get apps: HTTP {response.status_code}")
        except Exception as e:
            logger.error(f"Error getting apps: {e}")
            raise

    async def get_version(self) -> str:
        """Get Portal app version."""
        await self._ensure_connected()
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.tcp_base_url}/version",
                    headers=self._get_headers(),
                    timeout=5.0,
                )
                if response.status_code == 200:
                    data = response.json()
                    if "data" in data:
                        return data["data"]
                    return data.get("status", "unknown")
                else:
                    return "unknown"
        except Exception:
            return "unknown"

    async def ping(self) -> Dict[str, Any]:
        """
        Test Portal connection.

        Returns:
            Dictionary with status and connection details
        """
        await self._ensure_connected()
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.tcp_base_url}/ping",
                    headers=self._get_headers(),
                    timeout=5.0,
                )
                if response.status_code == 200:
                    try:
                        tcp_response = response.json() if response.content else {}
                        return {
                            "status": "success",
                            "method": "tcp",
                            "url": self.tcp_base_url,
                            "response": tcp_response,
                        }
                    except json.JSONDecodeError:
                        return {
                            "status": "success",
                            "method": "tcp",
                            "url": self.tcp_base_url,
                            "response": response.text,
                        }
                else:
                    return {
                        "status": "error",
                        "method": "tcp",
                        "message": f"HTTP {response.status_code}: {response.text}",
                    }
        except Exception as e:
            return {"status": "error", "method": "tcp", "message": str(e)}

    async def click(self, x: int, y: int) -> bool:
        """
        Click at coordinates.

        Args:
            x: X coordinate
            y: Y coordinate

        Returns:
            True if successful, False otherwise
        """
        await self._ensure_connected()
        try:
            payload = {"x": x, "y": y}
            headers = self._get_headers()
            headers["Content-Type"] = "application/json"
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.tcp_base_url}/click",
                    json=payload,
                    headers=headers,
                    timeout=5.0,
                )
                if response.status_code == 200:
                    logger.debug(f"Click successful at ({x}, {y})")
                    return True
                else:
                    logger.error(f"Click failed: HTTP {response.status_code}")
                    return False
        except Exception as e:
            logger.error(f"Click error: {e}")
            return False

    async def swipe(
        self, start_x: int, start_y: int, end_x: int, end_y: int, duration: float = 1.0
    ) -> bool:
        """
        Swipe from start to end coordinates.

        Args:
            start_x: Start X coordinate
            start_y: Start Y coordinate
            end_x: End X coordinate
            end_y: End Y coordinate
            duration: Duration in seconds

        Returns:
            True if successful, False otherwise
        """
        await self._ensure_connected()
        try:
            payload = {
                "startX": start_x,
                "startY": start_y,
                "endX": end_x,
                "endY": end_y,
                "duration": duration,
            }
            headers = self._get_headers()
            headers["Content-Type"] = "application/json"
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.tcp_base_url}/swipe",
                    json=payload,
                    headers=headers,
                    timeout=10.0,
                )
                if response.status_code == 200:
                    logger.debug(
                        f"Swipe successful from ({start_x}, {start_y}) to ({end_x}, {end_y})"
                    )
                    return True
                else:
                    logger.error(f"Swipe failed: HTTP {response.status_code}")
                    return False
        except Exception as e:
            logger.error(f"Swipe error: {e}")
            return False

    async def keyevent(self, keycode: int) -> bool:
        """
        Press a key by keycode.

        Args:
            keycode: Android keycode (e.g., 4 for BACK, 3 for HOME)

        Returns:
            True if successful, False otherwise
        """
        await self._ensure_connected()
        try:
            payload = {"keycode": keycode}
            headers = self._get_headers()
            headers["Content-Type"] = "application/json"
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.tcp_base_url}/keyevent",
                    json=payload,
                    headers=headers,
                    timeout=5.0,
                )
                if response.status_code == 200:
                    logger.debug(f"Keyevent successful: {keycode}")
                    return True
                else:
                    logger.error(f"Keyevent failed: HTTP {response.status_code}")
                    return False
        except Exception as e:
            logger.error(f"Keyevent error: {e}")
            return False

    async def app_start(self, package: str, activity: str = "") -> bool:
        """
        Start an app.

        Args:
            package: Package name (e.g., "com.android.settings")
            activity: Activity name (optional)

        Returns:
            True if successful, False otherwise
        """
        await self._ensure_connected()
        try:
            payload = {"package": package}
            if activity:
                payload["activity"] = activity
            headers = self._get_headers()
            headers["Content-Type"] = "application/json"
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.tcp_base_url}/app/start",
                    json=payload,
                    headers=headers,
                    timeout=10.0,
                )
                if response.status_code == 200:
                    logger.debug(f"App start successful: {package}")
                    return True
                else:
                    logger.error(f"App start failed: HTTP {response.status_code}")
                    return False
        except Exception as e:
            logger.error(f"App start error: {e}")
            return False

    async def get_date(self) -> str:
        """
        Get device date/time.

        Returns:
            Date/time string or "unknown" if failed
        """
        await self._ensure_connected()
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.tcp_base_url}/date",
                    headers=self._get_headers(),
                    timeout=5.0,
                )
                if response.status_code == 200:
                    data = response.json()
                    if "data" in data:
                        return data["data"]
                    return data.get("status", "unknown")
                else:
                    return "unknown"
        except Exception:
            return "unknown"

    async def list_packages(self, include_system: bool = False) -> List[str]:
        """
        List installed packages.

        Args:
            include_system: Whether to include system packages

        Returns:
            List of package names
        """
        await self._ensure_connected()
        try:
            url = f"{self.tcp_base_url}/packages"
            if include_system:
                url += "?includeSystem=true"
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=self._get_headers(), timeout=10.0)
                if response.status_code == 200:
                    data = response.json()
                    packages = data.get("packages", []) if isinstance(data, dict) else data
                    return packages if isinstance(packages, list) else []
                else:
                    raise ConnectionError(f"Failed to list packages: HTTP {response.status_code}")
        except Exception as e:
            logger.error(f"Error listing packages: {e}")
            raise
