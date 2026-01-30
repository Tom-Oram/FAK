#!/usr/bin/env python3
"""
Path Tracer API
Provides both ICMP traceroute and device-based path tracing with optional NetBox integration.
Requires: scapy, requests, flask, netmiko, pyyaml
"""

import os
import socket
import time
from datetime import datetime

from flask import Flask, request, jsonify
from flask_cors import CORS
from scapy.all import sr1, IP, ICMP, conf
import requests

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend access

# Disable Scapy verbosity
conf.verb = 0


# Import pathtracer modules
try:
    from pathtracer.orchestrator import PathTracer
    from pathtracer.discovery import DeviceInventory
    from pathtracer.credentials import CredentialManager
    from pathtracer.models import PathStatus
    DEVICE_TRACER_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Device-based path tracer not available: {e}")
    DEVICE_TRACER_AVAILABLE = False


def lookup_netbox_device(ip_address, netbox_url, netbox_token):
    """
    Look up device information from NetBox by IP address.

    Args:
        ip_address: IP to lookup
        netbox_url: NetBox instance URL
        netbox_token: NetBox API token

    Returns:
        dict with device info or None
    """
    if not netbox_url or not netbox_token:
        return None

    try:
        headers = {
            'Authorization': f'Token {netbox_token}',
            'Content-Type': 'application/json'
        }

        # Search for IP address in NetBox
        response = requests.get(
            f'{netbox_url}/api/ipam/ip-addresses/',
            params={'address': ip_address},
            headers=headers,
            timeout=5
        )

        if response.status_code == 200:
            results = response.json().get('results', [])
            if results and results[0].get('assigned_object'):
                assigned = results[0]['assigned_object']
                device = assigned.get('device')

                if device:
                    return {
                        'name': device.get('name'),
                        'site': device.get('site', {}).get('name') if device.get('site') else None,
                        'role': device.get('device_role', {}).get('name') if device.get('device_role') else None,
                        'platform': device.get('platform', {}).get('name') if device.get('platform') else None,
                        'status': device.get('status', {}).get('label') if device.get('status') else None,
                    }
    except Exception as e:
        print(f"NetBox lookup error for {ip_address}: {e}")

    return None


def get_hostname(ip_address):
    """Attempt to resolve PTR record for IP."""
    try:
        return socket.gethostbyaddr(ip_address)[0]
    except (socket.herror, socket.gaierror):
        return None


def _serialize_interface_detail(detail):
    """Serialize an InterfaceDetail to a dict, or None."""
    if detail is None:
        return None
    return {
        'name': detail.name,
        'description': detail.description,
        'status': detail.status,
        'speed': detail.speed,
        'utilisation_in_pct': detail.utilisation_in_pct,
        'utilisation_out_pct': detail.utilisation_out_pct,
        'errors_in': detail.errors_in,
        'errors_out': detail.errors_out,
        'discards_in': detail.discards_in,
        'discards_out': detail.discards_out,
    }


def _serialize_policy_result(policy):
    """Serialize a PolicyResult to a dict, or None."""
    if policy is None:
        return None
    return {
        'rule_name': policy.rule_name,
        'rule_position': policy.rule_position,
        'action': policy.action,
        'source_zone': policy.source_zone,
        'dest_zone': policy.dest_zone,
        'source_addresses': policy.source_addresses,
        'dest_addresses': policy.dest_addresses,
        'services': policy.services,
        'logging': policy.logging,
        'raw_output': policy.raw_output,
    }


def _serialize_nat_translation(t):
    """Serialize a NatTranslation to a dict, or None."""
    if t is None:
        return None
    return {
        'original_ip': t.original_ip,
        'original_port': t.original_port,
        'translated_ip': t.translated_ip,
        'translated_port': t.translated_port,
        'nat_rule_name': t.nat_rule_name,
    }


def _serialize_nat_result(nat):
    """Serialize a NatResult to a dict, or None."""
    if nat is None:
        return None
    return {
        'snat': _serialize_nat_translation(nat.snat),
        'dnat': _serialize_nat_translation(nat.dnat),
    }


def _serialize_hop(hop):
    """Serialize a PathHop to a dict for API response."""
    hop_data = {
        'sequence': hop.sequence,
        'device': {
            'hostname': hop.device.hostname,
            'management_ip': hop.device.management_ip,
            'vendor': hop.device.vendor,
            'device_type': hop.device.device_type,
            'site': hop.device.site,
        },
        'ingress_interface': hop.ingress_interface,
        'egress_interface': hop.egress_interface,
        'logical_context': hop.logical_context,
        'lookup_time_ms': hop.lookup_time_ms,
        'resolve_status': hop.resolve_status,
        'ingress_detail': _serialize_interface_detail(hop.ingress_detail),
        'egress_detail': _serialize_interface_detail(hop.egress_detail),
        'policy_result': _serialize_policy_result(hop.policy_result),
        'nat_result': _serialize_nat_result(hop.nat_result),
    }

    # Add route information if available
    if hop.route_used:
        hop_data['route'] = {
            'destination': hop.route_used.destination,
            'next_hop': hop.route_used.next_hop,
            'next_hop_type': hop.route_used.next_hop_type,
            'protocol': hop.route_used.protocol,
            'metric': hop.route_used.metric,
            'preference': hop.route_used.preference,
        }

    return hop_data


def perform_traceroute(source_ip, destination_ip, netbox_url=None, netbox_token=None, max_hops=30):
    """
    Perform layer 3 traceroute from source to destination.

    Args:
        source_ip: Source IP address
        destination_ip: Destination IP address
        netbox_url: Optional NetBox URL
        netbox_token: Optional NetBox API token
        max_hops: Maximum number of hops (default 30)

    Returns:
        List of hops with timing and device information
    """
    hops = []

    for ttl in range(1, max_hops + 1):
        # Create ICMP packet with specific TTL
        pkt = IP(src=source_ip, dst=destination_ip, ttl=ttl) / ICMP()

        # Send packet and wait for reply
        start_time = time.time()
        reply = sr1(pkt, timeout=2, verbose=0)
        rtt = (time.time() - start_time) * 1000  # Convert to milliseconds

        if reply is None:
            # No response - possibly filtered
            hops.append({
                'ttl': ttl,
                'ip': '*',
                'hostname': None,
                'rtt': 0,
                'timeout': True
            })
            continue

        # Build hop information
        hop_ip = reply.src
        hop = {
            'ttl': ttl,
            'ip': hop_ip,
            'hostname': get_hostname(hop_ip),
            'rtt': round(rtt, 2),
            'timeout': False
        }

        # Look up device in NetBox (if configured)
        netbox_device = lookup_netbox_device(hop_ip, netbox_url, netbox_token)
        if netbox_device:
            hop['device'] = netbox_device

        hops.append(hop)

        # Check if we reached destination
        if reply.src == destination_ip:
            break

    return hops


def perform_device_trace(source_ip, destination_ip, inventory_file=None, start_device=None,
                         source_context=None, netbox_url=None, netbox_token=None,
                         protocol="tcp", destination_port=443):
    """
    Perform device-based path trace by querying routing tables.

    Args:
        source_ip: Source IP address
        destination_ip: Destination IP address
        inventory_file: Path to inventory YAML file
        start_device: Optional starting device hostname
        source_context: Optional starting VRF/context
        netbox_url: Optional NetBox URL for enrichment
        netbox_token: Optional NetBox API token
        protocol: Protocol for firewall policy lookup (default: tcp)
        destination_port: Destination port for firewall policy lookup (default: 443)

    Returns:
        Dictionary with trace results
    """
    if not DEVICE_TRACER_AVAILABLE:
        raise Exception("Device-based path tracer not available. Install pathtracer dependencies.")

    # Use default inventory if not specified
    if not inventory_file:
        inventory_file = os.getenv('PATHTRACE_INVENTORY', 'inventory.yaml')
        # Try pathtracer directory if not found
        if not os.path.exists(inventory_file):
            inventory_file = os.path.join(os.path.dirname(__file__), 'pathtracer', 'inventory.yaml')

    if not os.path.exists(inventory_file):
        raise FileNotFoundError(f"Inventory file not found: {inventory_file}")

    # Load inventory
    inventory = DeviceInventory(inventory_file)
    inventory.load_from_file()

    # Load credentials
    credentials = CredentialManager()
    # Try environment variables first
    if os.getenv('PATHTRACE_USER'):
        credentials.add_credential('default', {
            'username': os.getenv('PATHTRACE_USER'),
            'password': os.getenv('PATHTRACE_PASS'),
            'enable_secret': os.getenv('PATHTRACE_SECRET')
        })
    else:
        # Try credentials file
        creds_file = os.getenv('PATHTRACE_CREDENTIALS', 'credentials.yaml')
        if not os.path.exists(creds_file):
            creds_file = os.path.join(os.path.dirname(__file__), 'pathtracer', 'credentials.yaml')
        if os.path.exists(creds_file):
            credentials.load_from_file(creds_file)

    # Create tracer
    tracer = PathTracer(inventory, credentials)

    # Perform trace
    trace_path = tracer.trace_path(
        source_ip=source_ip,
        destination_ip=destination_ip,
        initial_context=source_context,
        start_device=start_device,
        protocol=protocol,
        destination_port=destination_port
    )

    # Convert to API response format
    hops = []
    for hop in trace_path.hops:
        hop_data = _serialize_hop(hop)

        # Optionally enrich with NetBox data
        if netbox_url and netbox_token:
            netbox_device = lookup_netbox_device(hop.device.management_ip, netbox_url, netbox_token)
            if netbox_device:
                hop_data['device']['netbox'] = netbox_device

        hops.append(hop_data)

    return {
        'source_ip': trace_path.source_ip,
        'destination_ip': trace_path.destination_ip,
        'status': trace_path.status.value,
        'hops': hops,
        'hop_count': trace_path.hop_count(),
        'total_time_ms': trace_path.total_time_ms,
        'error_message': trace_path.error_message,
        'candidates': trace_path.metadata.get('candidates', []),
        'ambiguous_hop_sequence': trace_path.metadata.get('ambiguous_hop_sequence'),
        'inventory_warnings': inventory.get_warnings(),
    }


@app.route('/traceroute', methods=['POST'])
def traceroute():
    """
    API endpoint for ICMP traceroute.
    Public path: /pathtrace/api/traceroute (nginx strips /pathtrace/api/ prefix).

    Expects JSON body:
    {
        "source": "192.168.1.1",
        "destination": "8.8.8.8",
        "netboxUrl": "https://netbox.example.com",  // optional
        "netboxToken": "your-token-here"             // optional
    }
    """
    try:
        data = request.get_json()

        source_ip = data.get('source')
        destination_ip = data.get('destination')
        netbox_url = data.get('netboxUrl')
        netbox_token = data.get('netboxToken')

        if not source_ip or not destination_ip:
            return jsonify({'error': 'Source and destination IPs required'}), 400

        # Validate IP addresses
        try:
            socket.inet_aton(source_ip)
            socket.inet_aton(destination_ip)
        except socket.error:
            return jsonify({'error': 'Invalid IP address format'}), 400

        start_time = datetime.utcnow()

        # Perform ICMP traceroute
        hops = perform_traceroute(
            source_ip,
            destination_ip,
            netbox_url,
            netbox_token
        )

        end_time = datetime.utcnow()

        return jsonify({
            'mode': 'icmp',
            'hops': hops,
            'startTime': start_time.isoformat() + 'Z',
            'endTime': end_time.isoformat() + 'Z',
            'hopCount': len(hops)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/traceroute/device-based', methods=['POST'])
def device_based_traceroute():
    """
    API endpoint for device-based path tracing.
    Public path: /pathtrace/api/traceroute/device-based (nginx strips /pathtrace/api/ prefix).

    Expects JSON body:
    {
        "source": "192.168.1.1",
        "destination": "8.8.8.8",
        "inventoryFile": "inventory.yaml",          // optional
        "startDevice": "core-rtr-01",               // optional
        "sourceContext": "VRF_CORP",                // optional
        "protocol": "tcp",                          // optional, default tcp
        "destinationPort": 443,                     // optional, default 443
        "netboxUrl": "https://netbox.example.com",  // optional
        "netboxToken": "your-token-here"            // optional
    }
    """
    try:
        data = request.get_json()

        source_ip = data.get('source')
        destination_ip = data.get('destination')
        inventory_file = data.get('inventoryFile')
        start_device = data.get('startDevice')
        source_context = data.get('sourceContext')
        protocol = data.get('protocol', 'tcp')
        destination_port = data.get('destinationPort', 443)
        netbox_url = data.get('netboxUrl')
        netbox_token = data.get('netboxToken')

        if not source_ip or not destination_ip:
            return jsonify({'error': 'Source and destination IPs required'}), 400

        # Validate IP addresses
        try:
            socket.inet_aton(source_ip)
            socket.inet_aton(destination_ip)
        except socket.error:
            return jsonify({'error': 'Invalid IP address format'}), 400

        start_time = datetime.utcnow()

        # Perform device-based trace
        result = perform_device_trace(
            source_ip=source_ip,
            destination_ip=destination_ip,
            inventory_file=inventory_file,
            start_device=start_device,
            source_context=source_context,
            netbox_url=netbox_url,
            netbox_token=netbox_token,
            protocol=protocol,
            destination_port=destination_port
        )

        end_time = datetime.utcnow()

        # Add timing metadata
        result['mode'] = 'device-based'
        result['startTime'] = start_time.isoformat() + 'Z'
        result['endTime'] = end_time.isoformat() + 'Z'

        return jsonify(result)

    except FileNotFoundError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'ok', 'service': 'pathtrace-api'})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=os.getenv('FLASK_DEBUG', 'false').lower() == 'true')
