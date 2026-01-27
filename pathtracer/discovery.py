"""Device discovery and inventory management."""

import yaml
import json
import logging
from typing import List, Optional, Dict
from pathlib import Path

from .models import NetworkDevice, DeviceNotFoundError
from .utils.ip_utils import ip_in_network


logger = logging.getLogger(__name__)


class DeviceInventory:
    """Manages network device inventory."""

    def __init__(self, inventory_file: str = None):
        """
        Initialize inventory.

        Args:
            inventory_file: Path to inventory file (YAML or JSON)
        """
        self.devices: List[NetworkDevice] = []
        self.subnet_map: Dict[str, NetworkDevice] = {}

        if inventory_file:
            self.load_from_file(inventory_file)

    def load_from_file(self, file_path: str):
        """
        Load inventory from YAML or JSON file.

        Args:
            file_path: Path to inventory file
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Inventory file not found: {file_path}")

        logger.info(f"Loading inventory from {file_path}")

        with open(file_path, 'r') as f:
            if file_path.endswith('.yaml') or file_path.endswith('.yml'):
                data = yaml.safe_load(f)
            else:
                data = json.load(f)

        # Parse devices
        devices_data = data.get('devices', [])
        for device_data in devices_data:
            device = NetworkDevice(
                hostname=device_data['hostname'],
                management_ip=device_data['management_ip'],
                vendor=device_data['vendor'],
                device_type=device_data.get('device_type', 'unknown'),
                credentials_ref=device_data.get('credentials_ref', 'default'),
                logical_contexts=device_data.get('logical_contexts', [device_data.get('default_vrf', 'global')]),
                subnets=device_data.get('subnets', []),
                default_context=device_data.get('default_vrf') or device_data.get('default_virtual_router', 'global'),
                metadata=device_data.get('metadata', {})
            )
            self.add_device(device)

        logger.info(f"Loaded {len(self.devices)} devices from inventory")

    def add_device(self, device: NetworkDevice):
        """
        Add device to inventory.

        Args:
            device: NetworkDevice to add
        """
        self.devices.append(device)

        # Map subnets to device for quick lookup
        for subnet in device.subnets:
            self.subnet_map[subnet] = device

    def find_device_by_ip(self, ip: str) -> Optional[NetworkDevice]:
        """
        Find device by management IP.

        Args:
            ip: Management IP address

        Returns:
            NetworkDevice or None
        """
        for device in self.devices:
            if device.management_ip == ip:
                return device
        return None

    def find_device_by_hostname(self, hostname: str) -> Optional[NetworkDevice]:
        """
        Find device by hostname.

        Args:
            hostname: Device hostname

        Returns:
            NetworkDevice or None
        """
        for device in self.devices:
            if device.hostname == hostname:
                return device
        return None

    def find_device_for_subnet(self, ip: str) -> Optional[NetworkDevice]:
        """
        Find device that owns the subnet containing the IP.

        Args:
            ip: IP address to search for

        Returns:
            NetworkDevice that owns the subnet, or None
        """
        # Check subnet map
        for subnet, device in self.subnet_map.items():
            if ip_in_network(ip, subnet):
                logger.debug(f"Found device {device.hostname} for IP {ip} in subnet {subnet}")
                return device

        return None

    def get_all_devices(self) -> List[NetworkDevice]:
        """Get all devices in inventory."""
        return self.devices

    def export_to_dict(self) -> Dict:
        """
        Export inventory to dictionary format.

        Returns:
            Dictionary representation of inventory
        """
        return {
            'devices': [
                {
                    'hostname': dev.hostname,
                    'management_ip': dev.management_ip,
                    'vendor': dev.vendor,
                    'device_type': dev.device_type,
                    'credentials_ref': dev.credentials_ref,
                    'logical_contexts': dev.logical_contexts,
                    'subnets': dev.subnets,
                    'default_context': dev.default_context,
                    'metadata': dev.metadata
                }
                for dev in self.devices
            ]
        }

    def save_to_file(self, file_path: str):
        """
        Save inventory to file.

        Args:
            file_path: Path to save inventory
        """
        data = self.export_to_dict()

        with open(file_path, 'w') as f:
            if file_path.endswith('.yaml') or file_path.endswith('.yml'):
                yaml.dump(data, f, default_flow_style=False)
            else:
                json.dump(data, f, indent=2)

        logger.info(f"Saved inventory to {file_path}")
