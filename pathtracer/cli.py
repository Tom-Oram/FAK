#!/usr/bin/env python3
"""Command-line interface for path tracer."""

import sys
import argparse
import logging
from pathlib import Path

from . import PathTracer, DeviceInventory, CredentialManager
from .models import PathStatus


def setup_logging(verbose: int):
    """Setup logging based on verbosity level."""
    if verbose >= 2:
        level = logging.DEBUG
    elif verbose == 1:
        level = logging.INFO
    else:
        level = logging.WARNING

    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )


def print_path_table(path):
    """Print path in table format."""
    print(f"\nPath Trace: {path.source_ip} → {path.destination_ip}")
    print("=" * 100)

    if path.hop_count() == 0:
        print("No hops recorded")
        return

    # Print header
    print(f"{'Hop':<5} {'Device':<20} {'Context':<15} {'Egress Interface':<20} {'Next Hop':<20} {'Protocol':<10}")
    print("-" * 100)

    # Print hops
    for hop in path.hops:
        device_name = hop.device.hostname
        context = hop.logical_context
        interface = hop.egress_interface or "-"

        if hop.route_used:
            next_hop = hop.route_used.next_hop
            protocol = hop.route_used.protocol
        else:
            next_hop = "-"
            protocol = "-"

        print(f"{hop.sequence:<5} {device_name:<20} {context:<15} {interface:<20} {next_hop:<20} {protocol:<10}")

    # Print summary
    print("-" * 100)
    print(f"Status: {path.status.value.upper()}")
    if path.error_message:
        print(f"Error: {path.error_message}")
    print(f"Total hops: {path.hop_count()}")
    print(f"Trace time: {path.total_time_ms / 1000:.2f} seconds")
    print()


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description='Multi-vendor network path tracer',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument('--source', '-s', required=True,
                       help='Source IP address')
    parser.add_argument('--dest', '-d', required=True,
                       help='Destination IP address')
    parser.add_argument('--inventory', '-i', default='inventory.yaml',
                       help='Path to inventory file (default: inventory.yaml)')
    parser.add_argument('--credentials', '-c',
                       help='Path to credentials file (optional, falls back to env vars)')
    parser.add_argument('--start-device',
                       help='Hostname of device to start from (optional)')
    parser.add_argument('--source-context',
                       help='Source VRF/context (optional)')
    parser.add_argument('--max-hops', type=int, default=30,
                       help='Maximum number of hops (default: 30)')
    parser.add_argument('--verbose', '-v', action='count', default=0,
                       help='Increase verbosity (-v, -vv, -vvv)')
    parser.add_argument('--output', choices=['table', 'json'], default='table',
                       help='Output format (default: table)')

    args = parser.parse_args()

    # Setup logging
    setup_logging(args.verbose)

    # Check inventory file
    if not Path(args.inventory).exists():
        print(f"Error: Inventory file not found: {args.inventory}", file=sys.stderr)
        print(f"Create one using example-inventory.yaml as a template", file=sys.stderr)
        return 1

    try:
        # Load inventory
        inventory = DeviceInventory(args.inventory)

        # Load credentials
        credentials = CredentialManager(args.credentials)

        # Create tracer
        config = {
            'max_hops': args.max_hops,
            'connection': {
                'ssh_timeout': 30,
                'command_timeout': 60,
            }
        }
        tracer = PathTracer(inventory, credentials, config)

        # Perform trace
        path = tracer.trace_path(
            source_ip=args.source,
            destination_ip=args.dest,
            initial_context=args.source_context,
            start_device=args.start_device
        )

        # Output results
        if args.output == 'json':
            import json
            # Convert to dict for JSON output
            result = {
                'source_ip': path.source_ip,
                'destination_ip': path.destination_ip,
                'status': path.status.value,
                'error_message': path.error_message,
                'total_time_ms': path.total_time_ms,
                'hop_count': path.hop_count(),
                'hops': [
                    {
                        'sequence': hop.sequence,
                        'device': hop.device.hostname,
                        'context': hop.logical_context,
                        'egress_interface': hop.egress_interface,
                        'next_hop': hop.route_used.next_hop if hop.route_used else None,
                        'protocol': hop.route_used.protocol if hop.route_used else None,
                        'lookup_time_ms': hop.lookup_time_ms,
                    }
                    for hop in path.hops
                ]
            }
            print(json.dumps(result, indent=2))
        else:
            print_path_table(path)

        # Return appropriate exit code
        if path.status == PathStatus.COMPLETE:
            return 0
        else:
            return 1

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        if args.verbose >= 2:
            import traceback
            traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
