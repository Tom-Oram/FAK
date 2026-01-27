# Regex Builder Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a regex generator tool where users input sample text, auto-detect patterns, select interpretations, and generate combined regex with language-specific code snippets.

**Architecture:** React component with pattern recognition hook. Users see highlighted matches in their input text, click to select pattern interpretations, and the tool combines selections into a final regex. All processing client-side.

**Tech Stack:** React, TypeScript, Tailwind CSS (matching existing FAK tools)

---

## User Flow

1. User enters sample text in textarea (limit: 2000 characters)
2. Auto-detection runs (debounced 200ms) - recognizers scan text for patterns
3. Matched regions highlighted with colored backgrounds
4. User clicks highlighted portion - dropdown shows pattern options for that position
5. User selects desired pattern - added to "Selected Patterns" list
6. Tool combines selections (in position order) into final regex
7. User toggles flags (case-insensitive, multiline, etc.)
8. User copies regex or language-specific code snippet

## File Structure

```
src/components/tools/RegexBuilder/
├── index.tsx                 # Main component, state management
├── types.ts                  # TypeScript interfaces
├── constants.ts              # Recognizer definitions
├── components/
│   ├── TextInput.tsx         # Sample text input with highlight overlays
│   ├── PatternMatches.tsx    # Shows matches at cursor position
│   ├── SelectedPatterns.tsx  # List of user-selected patterns
│   ├── RegexOutput.tsx       # Generated regex with copy button
│   ├── OptionsPanel.tsx      # Flags toggles
│   └── CodeSnippets.tsx      # Language-specific code (collapsible)
└── hooks/
    └── usePatternRecognition.ts  # Core matching logic
```

## Core Types

```typescript
interface Recognizer {
  name: string;           // Display name: "IPv4 Address"
  searchPattern: RegExp;  // Pattern to find matches in input
  outputPattern: string;  // Regex pattern for final output
  priority: number;       // Higher = shown first when multiple match same position
}

interface RecognizerMatch {
  recognizer: Recognizer;
  range: [number, number];  // Start and end position in input text
  matchedText: string;      // The actual text that matched
}

interface SelectedPattern {
  id: string;               // Unique ID for React keys
  match: RecognizerMatch;
  outputPattern: string;    // May be customized by user
}

interface RegexOptions {
  caseInsensitive: boolean;
  multiline: boolean;
  dotMatchesNewline: boolean;
  matchWholeLine: boolean;
  generateLowercase: boolean;
}
```

## State Management

State lives in index.tsx:

```typescript
interface RegexBuilderState {
  inputText: string;
  matches: RecognizerMatch[];          // All detected matches
  selectedPatterns: SelectedPattern[]; // User's chosen patterns (ordered by position)
  activePosition: number | null;       // Cursor position for showing match options
  options: RegexOptions;               // Flags
}
```

Data flow:
1. `inputText` changes → `usePatternRecognition` hook runs recognizers → updates `matches`
2. User clicks position in text → sets `activePosition` → `PatternMatches` shows options
3. User selects a pattern → adds to `selectedPatterns` (sorted by position)
4. `selectedPatterns` + `options` → generates final regex → displayed in `RegexOutput`

## Text Input with Highlighting

Overlay technique for showing highlights on editable text:

```
┌─────────────────────────────────────────────┐
│ <div class="relative">                      │
│   <div class="highlights-layer">            │  ← Colored backgrounds (pointer-events: none)
│     <span class="bg-blue-200">192...</span> │
│   </div>                                    │
│   <textarea class="transparent-bg">         │  ← Actual editable text on top
│     192.168.1.1 - user@example.com          │
│   </textarea>                               │
│ </div>                                      │
└─────────────────────────────────────────────┘
```

- Container div with `position: relative`
- Background layer mirrors textarea content with `<span>` highlights
- Textarea on top with transparent background
- Both layers use identical font, padding, line-height
- Click handling via `onSelect`/`onClick` to track cursor position

Color coding:
- Unselected matches: `bg-slate-200 dark:bg-slate-700`
- Selected patterns: `bg-primary-200 dark:bg-primary-800`
- Overlapping matches: darker shade to indicate multiple options

## Recognizer Set

| Category | Patterns |
|----------|----------|
| Basic | Character, Whitespace(s), Digit, Number, Decimal number |
| Text | Letters, Alphanumeric, Word characters |
| Network | IPv4 address, Email, URL, MAC address |
| Time | Date (YYYY-MM-DD), Time (HH:MM:SS), ISO8601 timestamp |
| Identifiers | UUID, Hashtag, Hex color |
| Delimited | Quoted string (single/double), Parentheses, Brackets, Braces |
| Log-specific | Log level (INFO/WARN/ERROR), HTTP method, HTTP status code |
| Fallback | Exact match (escapes literal text) |

## Regex Building Logic

```typescript
function buildRegex(input: string, selections: SelectedPattern[]): string {
  const sorted = [...selections].sort((a, b) => a.match.range[0] - b.match.range[0]);

  let regex = '';
  let lastEnd = 0;

  for (const sel of sorted) {
    const [start, end] = sel.match.range;

    // Handle gap between last selection and this one
    if (start > lastEnd) {
      const gap = input.slice(lastEnd, start);
      regex += escapeRegex(gap);  // Literal text in gaps
    }

    regex += sel.outputPattern;
    lastEnd = end;
  }

  // Handle trailing text after last selection
  if (lastEnd < input.length) {
    regex += escapeRegex(input.slice(lastEnd));
  }

  return regex;
}
```

## Options Panel

| Option | Flag | Effect |
|--------|------|--------|
| Case insensitive | `i` | Ignore case |
| Multiline | `m` | `^` and `$` match line boundaries |
| Dot matches newline | `s` | `.` matches `\n` |
| Match whole line | - | Wraps output in `^...$` |
| Generate lowercase | - | Simplifies `[A-Za-z]` to `[a-z]` when `i` flag set |

## Language Code Snippets

Collapsible accordion showing usage in different languages:

| Language | Example Format |
|----------|----------------|
| JavaScript | `const regex = /pattern/i;` |
| Python | `pattern = re.compile(r'pattern', re.IGNORECASE)` |
| Go | `re := regexp.MustCompile(\`pattern\`)` |
| grep | `grep -E 'pattern' file.txt` |
| sed | `sed -n '/pattern/p' file.txt` |
| PowerShell | `Select-String -Pattern 'pattern'` |

## Test Area

Simple input field where users paste text to validate their regex:
- Shows match/no-match indicator
- Highlights matched portions
- Quick validation before copying

## Scope

### v1 (Included)
- ~25 recognizers (basic, network, time, delimited, log-specific)
- Text highlighting with click-to-select
- Pattern selection and ordering
- Regex flags (i, m, s)
- 6 language snippets (JS, Python, Go, grep, sed, PowerShell)
- Test area for validation

### Deferred
- Repetition detection (patterns that repeat with separators)
- Regex explanation (breakdown of what each part does)
- Shareable URLs
- Custom recognizer creation
- Capture group naming

## Technical Notes

- No external dependencies beyond existing FAK stack
- All processing client-side
- Input limited to 2000 characters
- Debounce pattern recognition at 200ms
- Follows existing FAK patterns (card layout, dark mode, copy buttons)
