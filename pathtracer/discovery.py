"""Device discovery and inventory management."""

import yaml
import json
import logging
from typing import List, Optional, Dict
from pathlib import Path

from .models import NetworkDevice, DeviceNotFoundError
from .utils.ip_utils import ip_in_network, get_prefix_length


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
        self.subnet_map: Dict[str, List[NetworkDevice]] = {}
        self._load_warnings: List[str] = []

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
                site=device_data.get('site'),
                device_type=device_data.get('device_type', 'unknown'),
                credentials_ref=device_data.get('credentials_ref', 'default'),
                logical_contexts=device_data.get('logical_contexts', [device_data.get('default_vrf', 'global')]),
                subnets=device_data.get('subnets', []),
                default_context=device_data.get('default_vrf') or device_data.get('default_virtual_router', 'global'),
                metadata=device_data.get('metadata', {})
            )
            self.add_device(device)

        logger.info(f"Loaded {len(self.devices)} devices from inventory")

    def add_device(self, device: NetworkDevice) -> None:
        """
        Add device to inventory.

        Args:
            device: NetworkDevice to add
        """
        # Detect duplicate management IPs
        for existing in self.devices:
            if device.management_ip and existing.management_ip == device.management_ip and existing.hostname != device.hostname:
                warning = f"Duplicate management IP {device.management_ip}: {existing.hostname} and {device.hostname}"
                self._load_warnings.append(warning)
                logger.warning(warning)

        self.devices.append(device)

        for subnet in device.subnets:
            if subnet not in self.subnet_map:
                self.subnet_map[subnet] = []
            else:
                # Check for same-site overlap
                existing_devices = self.subnet_map[subnet]
                for existing in existing_devices:
                    if existing.site and device.site and existing.site == device.site:
                        warning = f"Overlapping subnet {subnet} at site {device.site}: {existing.hostname} and {device.hostname}"
                        self._load_warnings.append(warning)
                        logger.warning(warning)
            self.subnet_map[subnet].append(device)

    def find_device_by_ip(self, ip: str) -> List[NetworkDevice]:
        """Find all devices with this management IP."""
        return [d for d in self.devices if d.management_ip == ip]

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

    def find_device_for_subnet(self, ip: str) -> List[NetworkDevice]:
        """Find all devices owning a subnet that contains this IP, using longest prefix match."""
        matches: List[tuple] = []  # (prefix_length, device)
        for subnet, devices in self.subnet_map.items():
            if ip_in_network(ip, subnet):
                prefix_len = get_prefix_length(subnet)
                for device in devices:
                    matches.append((prefix_len, device))

        if not matches:
            return []

        # Find the longest prefix length
        longest = max(m[0] for m in matches)
        # Return only devices at the longest prefix length
        return [d for plen, d in matches if plen == longest]

    def get_all_devices(self) -> List[NetworkDevice]:
        """Get all devices in inventory."""
        return self.devices

    def get_warnings(self) -> List[str]:
        """Return any warnings generated during inventory loading."""
        return list(self._load_warnings)

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
                    'site': dev.site,
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
