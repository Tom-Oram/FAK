"""Cisco FTD driver stub. Full implementation requires FMC REST API integration."""

from typing import List, Dict, Optional
from .base import NetworkDriver
from ..models import RouteEntry, NetworkDevice, CredentialSet

NOT_IMPLEMENTED_MSG = "Cisco FTD requires FMC API integration (not yet implemented)"


class CiscoFTDDriver(NetworkDriver):
    """Cisco FTD driver stub."""

    def connect(self) -> None:
        raise NotImplementedError(NOT_IMPLEMENTED_MSG)

    def disconnect(self) -> None:
        raise NotImplementedError(NOT_IMPLEMENTED_MSG)

    def get_route(self, destination: str, context: str = None) -> Optional[RouteEntry]:
        raise NotImplementedError(NOT_IMPLEMENTED_MSG)

    def get_routing_table(self, context: str = None) -> List[RouteEntry]:
        raise NotImplementedError(NOT_IMPLEMENTED_MSG)

    def list_logical_contexts(self) -> List[str]:
        raise NotImplementedError(NOT_IMPLEMENTED_MSG)

    def get_interface_to_context_mapping(self) -> Dict[str, str]:
        raise NotImplementedError(NOT_IMPLEMENTED_MSG)

    def detect_device_info(self) -> Dict:
        raise NotImplementedError(NOT_IMPLEMENTED_MSG)
