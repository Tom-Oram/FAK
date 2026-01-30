"""Data models for network path tracer."""

from dataclasses import dataclass, field
from typing import List, Optional, Dict
from enum import Enum


class DeviceVendor(Enum):
    """Supported device vendors."""
    CISCO_IOS = "cisco_ios"
    CISCO_NXOS = "cisco_nxos"
    ARISTA_EOS = "arista_eos"
    JUNIPER_JUNOS = "juniper_junos"
    PALO_ALTO = "paloalto"
    ARUBA = "aruba"
    FORTINET = "fortinet"


class DeviceType(Enum):
    """Device types."""
    ROUTER = "router"
    FIREWALL = "firewall"
    L3_SWITCH = "l3_switch"
    UNKNOWN = "unknown"


class NextHopType(Enum):
    """Types of next hops in routing table."""
    IP = "ip"
    INTERFACE = "interface"
    LOCAL = "local"
    CONNECTED = "connected"
    NULL = "null"
    REJECT = "reject"


class PathStatus(Enum):
    """Status of path trace."""
    COMPLETE = "complete"
    INCOMPLETE = "incomplete"
    ERROR = "error"
    LOOP_DETECTED = "loop_detected"
    BLACKHOLED = "blackholed"
    MAX_HOPS_EXCEEDED = "max_hops_exceeded"
    NEEDS_INPUT = "needs_input"
    AMBIGUOUS_HOP = "ambiguous_hop"


class ResolveStatus(Enum):
    """Status of resolving an IP to a device."""
    RESOLVED = "resolved"
    RESOLVED_BY_SITE = "resolved_by_site"
    NOT_FOUND = "not_found"
    AMBIGUOUS = "ambiguous"


@dataclass
class NetworkDevice:
    """Represents a network device."""
    hostname: str
    management_ip: str
    vendor: str
    site: Optional[str] = None          # From inventory or NetBox
    device_type: str = "unknown"
    credentials_ref: str = "default"
    logical_contexts: List[str] = field(default_factory=lambda: ["global"])
    subnets: List[str] = field(default_factory=list)
    default_context: str = "global"
    metadata: Dict = field(default_factory=dict)

    def __hash__(self):
        return hash((self.hostname, self.management_ip))

    def __eq__(self, other):
        if not isinstance(other, NetworkDevice):
            return False
        return self.management_ip == other.management_ip


@dataclass
class RouteEntry:
    """Represents a routing table entry."""
    destination: str  # CIDR notation
    next_hop: str  # IP address or interface
    next_hop_type: str  # ip, interface, local, connected, null
    outgoing_interface: Optional[str] = None
    protocol: str = "unknown"
    logical_context: str = "global"
    metric: int = 0
    preference: int = 0  # administrative distance
    raw_output: str = ""

    def is_destination_reached(self, target_ip: str) -> bool:
        """Check if this route means we've reached the destination."""
        return self.next_hop_type in ["connected", "local"] or \
               self.next_hop == target_ip


@dataclass
class PathHop:
    """Represents one hop in the traced path."""
    sequence: int
    device: NetworkDevice
    ingress_interface: Optional[str] = None
    egress_interface: Optional[str] = None
    logical_context: str = "global"
    route_used: Optional[RouteEntry] = None
    lookup_time_ms: float = 0.0
    notes: str = ""

    def __str__(self):
        return (f"Hop {self.sequence}: {self.device.hostname} "
                f"({self.logical_context}) → {self.egress_interface}")


@dataclass
class TracePath:
    """Represents a complete traced path."""
    source_ip: str
    destination_ip: str
    hops: List[PathHop] = field(default_factory=list)
    status: PathStatus = PathStatus.INCOMPLETE
    error_message: Optional[str] = None
    total_time_ms: float = 0.0
    metadata: Dict = field(default_factory=dict)

    def add_hop(self, hop: PathHop):
        """Add a hop to the path."""
        self.hops.append(hop)

    def is_complete(self) -> bool:
        """Check if the path trace reached the destination."""
        return self.status == PathStatus.COMPLETE

    def hop_count(self) -> int:
        """Return the number of hops."""
        return len(self.hops)


@dataclass
class ResolveResult:
    """Result of resolving an IP to a device, with disambiguation status."""
    device: Optional[NetworkDevice]
    status: ResolveStatus
    candidates: List[NetworkDevice] = field(default_factory=list)


@dataclass
class ConnectionConfig:
    """Configuration for device connections."""
    ssh_timeout: int = 30
    command_timeout: int = 60
    max_retries: int = 3
    retry_delay: int = 5
    use_connection_pool: bool = True
    pool_size: int = 10
    jump_host: Optional[Dict] = None

    @classmethod
    def from_dict(cls, config: Dict) -> 'ConnectionConfig':
        """Create from dictionary."""
        return cls(**{k: v for k, v in config.items() if k in cls.__annotations__})


@dataclass
class CredentialSet:
    """Credentials for device access."""
    username: str
    password: Optional[str] = None
    secret: Optional[str] = None  # Enable secret for Cisco
    ssh_key_file: Optional[str] = None
    api_token: Optional[str] = None  # For API-based access

    def has_password(self) -> bool:
        """Check if password authentication is available."""
        return self.password is not None

    def has_key(self) -> bool:
        """Check if key authentication is available."""
        return self.ssh_key_file is not None


class PathTraceException(Exception):
    """Base exception for path tracer."""
    pass


class DeviceConnectionError(PathTraceException):
    """Failed to connect to device."""
    pass


class AuthenticationError(PathTraceException):
    """Authentication failed."""
    pass


class CommandError(PathTraceException):
    """Command execution failed."""
    pass


class ParseError(PathTraceException):
    """Failed to parse device output."""
    pass


class RoutingLoopDetected(PathTraceException):
    """Routing loop detected in path."""
    pass


class MaxHopsExceeded(PathTraceException):
    """Maximum hop count exceeded."""
    pass


class DeviceNotFoundError(PathTraceException):
    """Device not found in inventory."""
    pass
