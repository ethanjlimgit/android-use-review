"""
Device information class for Portal TCP connections.

Represents a device that can be accessed via Portal TCP without ADB.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class Device:
    """
    Device information for Portal TCP connection.

    This class represents a device that can be accessed directly via Portal's
    HTTP server without requiring ADB. All communication goes through TCP.
    """

    address: str
    """Device IP address and port (e.g., '192.168.1.100:8080' or '192.168.1.100')"""

    name: Optional[str] = None
    """Optional device name/identifier"""

    portal_port: int = 8080
    """Portal HTTP server port (default: 8080)"""

    def __post_init__(self):
        """Parse address and ensure it includes port."""
        # If address doesn't include port, add default portal port
        if ":" not in self.address:
            self.address = f"{self.address}:{self.portal_port}"

    @property
    def ip(self) -> str:
        """Get device IP address without port."""
        return self.address.split(":")[0]

    @property
    def port(self) -> int:
        """Get device port number."""
        if ":" in self.address:
            return int(self.address.split(":")[1])
        return self.portal_port

    @property
    def base_url(self) -> str:
        """Get Portal HTTP base URL."""
        return f"http://{self.address}"

    def __str__(self) -> str:
        """String representation."""
        if self.name:
            return f"{self.name} ({self.address})"
        return self.address
