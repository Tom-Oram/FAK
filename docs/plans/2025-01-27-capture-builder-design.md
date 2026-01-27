# Capture Builder Design

**Date:** 2025-01-27
**Status:** Approved

## Overview

A tcpdump syntax builder tool for the First Aid Kit (FAK) application, inspired by tcpdump101.com. Provides visual command generation for packet captures across multiple platforms.

## Supported Platforms

- Linux tcpdump
- Fortinet (`diagnose sniffer packet`, `diagnose debug flow`)
- Palo Alto (`debug dataplane packet-diag`, counters, sessions)
- Cisco ASA (`capture`, `show conn`, `packet-tracer`)

## Component Structure

```
src/components/tools/CaptureBuilder/
├── index.tsx                 # Main component with tab navigation
├── tabs/
│   ├── TcpdumpTab.tsx       # Linux tcpdump builder
│   ├── FortinetTab.tsx      # Fortinet diagnose commands
│   ├── PaloAltoTab.tsx      # Palo Alto debug/capture commands
│   └── CiscoAsaTab.tsx      # Cisco ASA capture commands
├── components/
│   ├── BpfFilterBuilder.tsx  # Visual filter builder with raw toggle
│   ├── CommandOutput.tsx     # Multi-step workflow display with copy
│   ├── CheatSheet.tsx        # Collapsible quick reference
│   └── ValidationFeedback.tsx # Error/warning display
├── types.ts                  # Shared TypeScript interfaces
└── constants.ts              # Options, defaults, warning rules
```

## Tcpdump Tab

### Options (organized in collapsible sections)

**Interface & Basic Options**
- Interface dropdown + custom text input
- Packet count (`-c`)
- Snaplen (`-s`) with "0 = full packet" hint
- Name resolution checkboxes: `-n` (hosts), `-nn` (hosts + ports)

**Verbosity & Display**
- Verbosity radio: normal / `-v` / `-vv` / `-vvv`
- Hex output radio: none / `-x` / `-X` / `-xx` / `-XX`
- Line buffered (`-l`) checkbox
- Print while writing (`-U`) checkbox

**Timestamp Format**
- Radio group: default / `-t` / `-tt` / `-ttt` / `-tttt` / `-ttttt`

**Output & File Options**
- Write to file (`-w`)
- Read from file (`-r`)
- File rotation: size (`-C`), seconds (`-G`), count (`-W`)

**BPF Filter**
- Hybrid visual/raw filter builder

## BPF Filter Builder

### Visual Mode (default)

Structured list of conditions with AND/OR logic:

- Each condition row has:
  - Enable/disable checkbox
  - Optional NOT modifier
  - Type dropdown: Protocol, Host, Port, Net, Port Range
  - Type-specific inputs
  - Direction (src/dst/src or dst) where applicable
  - Delete button
- Conditions join with AND/OR dropdown between them
- "+ Add Condition" button

### Raw Mode

- Single text input with generated filter
- Fully editable
- Syntax highlighting when valid
- Red underline on parse error
- Syncs back to visual when parseable
- Shows "Complex filter - visual editing disabled" when not parseable

## Fortinet Tab

### Packet Sniffer Section

- Interface dropdown (any, port1, port2, wan1, wan2, internal) + custom input
- Verbosity: 1-6 radio
- Packet count (0 = unlimited)
- Absolute timestamp checkbox
- BPF filter (shared component)

### Debug Flow Section

- Enable/disable toggle
- Function filter (all vs specific)
- Address filter
- Verbose checkbox

### Generated Commands

1. `diagnose sniffer packet <interface> '<filter>' <verbosity> <count> <timestamp>`
2. Debug flow commands (if enabled)
3. Stop commands

## Palo Alto Tab

### Capture Filter Section

- Filter name (required)
- Source/Destination IP + Zone
- Source/Destination port
- Protocol dropdown
- Non-IP filter option

### Capture Stage Section

- Checkboxes: receive, transmit, drop, firewall

### Capture Settings

- Packet count
- Byte count (snaplen)
- File name

### Troubleshooting Commands

- Toggle: `show counter global filter packet-filter yes`
- Toggle: `show session all filter`

### GUI Steps

Toggle "Show GUI steps" displays:
1. Navigate to Monitor > Packet Capture
2. Click Add
3. Configure filter criteria
4. Select capture stages
5. Start/Stop/Export instructions

### Generated Commands

1. Set filter
2. Set capture
3. Start capture
4. Stop capture
5. Export/view capture
6. Optional counter/session commands

## Cisco ASA Tab

### Capture Settings

- Capture name (required)
- Interface dropdown + custom input
- Capture type: raw-data / asp-drop / isakmp / webvpn
- Direction: both / ingress / egress

### Filter Options

- Access-list name input (for pre-defined ACLs)
- Inline match using adapted filter builder

### Capture Limits

- Buffer size
- Packet length (snaplen)
- Circular buffer checkbox
- Packet count

### Troubleshooting Commands

- Toggle: `show capture <name>`
- Toggle: `show conn` with filter
- Toggle: `packet-tracer` builder

### Generated Commands

1. ACL creation (if needed)
2. `capture` command
3. `show capture` (view)
4. `copy /pcap` (export)
5. `no capture` (cleanup)

## Command Output Component

Displayed at bottom of each tab, always visible:

- Real-time generation as options change
- Multi-step workflow format
- Each step shows:
  - Step number and description
  - Command in monospace with syntax highlighting
  - Individual copy button
  - Brief explanation
- "Copy All" button (includes step comments)
- Expandable "Show what each flag does" breakdown

### Copy Behavior

Individual copy: single command only

Copy All format:
```
# Step 1: Start capture
tcpdump -i eth0 ...

# Step 2: Stop capture
Ctrl+C
```

## Cheat Sheet

Collapsible panel via header button, organized by platform:

### Tcpdump Section
- Common filters: host, net, port, portrange, src/dst, protocols
- Logical operators: and, or, not, parentheses
- Protocol-specific: tcp flags, icmp types, VLAN, MPLS
- Example one-liners with "Use this" button

### Vendor Sections
- Quick reference for syntax
- Common gotchas and tips

## Validation & Warnings

### Warnings (yellow, advisory)
- "No packet limit set - capture may run indefinitely"
- "Capturing on 'any' may impact device performance"
- "No filter specified - capturing all traffic"
- "Buffer size over 32MB may impact memory" (vendor-specific)
- "Snaplen 0 captures full packets - large file sizes expected"

### Errors (red, blocking)
- "Invalid IP address format"
- "Port must be between 1-65535"
- "Capture name is required"

## Integration Points

- Add route `/capture-builder` in `App.tsx`
- Export from `src/components/tools/index.ts`
- Add to Dashboard tool grid

## Future Considerations

- Additional vendors (Juniper, Aruba, etc.)
- Save/load capture configurations
- Integration with PCAP analyzer tool
- Command history
