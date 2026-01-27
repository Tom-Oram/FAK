"""Base driver interface for network devices."""

from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from ..models import RouteEntry, NetworkDevice, CredentialSet


class NetworkDriver(ABC):
    """Abstract base class for network device drivers."""

    def __init__(self, device: NetworkDevice, credentials: CredentialSet, config: Dict = None):
        """
        Initialize driver.

        Args:
            device: NetworkDevice instance
            credentials: CredentialSet for authentication
            config: Optional configuration dictionary
        """
        self.device = device
        self.credentials = credentials
        self.config = config or {}
        self.connection = None
        self._connected = False

    @abstractmethod
    def connect(self) -> None:
        """
        Establish connection to device.

        Raises:
            DeviceConnectionError: If connection fails
            AuthenticationError: If authentication fails
        """
        pass

    @abstractmethod
    def disconnect(self) -> None:
        """Close connection to device."""
        pass

    @abstractmethod
    def get_route(self, destination: str, context: str = None) -> Optional[RouteEntry]:
        """
        Query routing table for specific destination.

        Args:
            destination: Destination IP address
            context: Logical context (VRF, routing instance, etc.)

        Returns:
            RouteEntry for the destination, or None if no route found

        Raises:
            CommandError: If command execution fails
            ParseError: If output parsing fails
        """
        pass

    @abstractmethod
    def get_routing_table(self, context: str = None) -> List[RouteEntry]:
        """
        Get full routing table.

        Args:
            context: Logical context (VRF, routing instance, etc.)

        Returns:
            List of RouteEntry objects

        Raises:
            CommandError: If command execution fails
            ParseError: If output parsing fails
        """
        pass

    @abstractmethod
    def list_logical_contexts(self) -> List[str]:
        """
        List all VRFs/routing-instances/virtual-routers.

        Returns:
            List of context names

        Raises:
            CommandError: If command execution fails
        """
        pass

    @abstractmethod
    def get_interface_to_context_mapping(self) -> Dict[str, str]:
        """
        Map interfaces to their logical contexts.

        Returns:
            Dictionary mapping interface name to context name

        Raises:
            CommandError: If command execution fails
        """
        pass

    @abstractmethod
    def detect_device_info(self) -> Dict:
        """
        Return device hostname, version, model.

        Returns:
            Dictionary with keys: hostname, version, model, serial

        Raises:
            CommandError: If command execution fails
        """
        pass

    def is_connected(self) -> bool:
        """Check if connected to device."""
        return self._connected

    def __enter__(self):
        """Context manager entry."""
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.disconnect()
        return False

    def _normalize_ip(self, ip: str) -> str:
        """
        Normalize IP address format.

        Args:
            ip: IP address string

        Returns:
            Normalized IP address
        """
        return ip.strip()

    def _find_best_route(self, routes: List[RouteEntry], destination: str) -> Optional[RouteEntry]:
        """
        Find best matching route for destination from a list of routes.
        Uses longest prefix match.

        Args:
            routes: List of RouteEntry objects
            destination: Destination IP address

        Returns:
            Best matching RouteEntry or None
        """
        import ipaddress

        try:
            dest_ip = ipaddress.ip_address(destination)
        except ValueError:
            return None

        best_match = None
        best_prefix_len = -1

        for route in routes:
            try:
                network = ipaddress.ip_network(route.destination, strict=False)
                if dest_ip in network:
                    if network.prefixlen > best_prefix_len:
                        best_match = route
                        best_prefix_len = network.prefixlen
            except (ValueError, AttributeError):
                continue

        return best_match
