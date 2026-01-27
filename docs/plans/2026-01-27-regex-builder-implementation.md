# Regex Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a regex generator tool where users input sample text, patterns are auto-detected, users select interpretations, and a combined regex is generated with language-specific code snippets.

**Architecture:** React component with pattern recognition hook. Text input with highlight overlays shows detected patterns. Users click to select patterns, which are combined into final regex output. All processing is client-side.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons (matching existing FAK tools)

---

## Task 1: Create Types and Constants Files

**Files:**
- Create: `src/components/tools/RegexBuilder/types.ts`
- Create: `src/components/tools/RegexBuilder/constants.ts`

**Step 1: Create the types file**

```typescript
// src/components/tools/RegexBuilder/types.ts

export interface Recognizer {
  name: string;
  description: string;
  searchPattern: RegExp;
  outputPattern: string;
  priority: number;
}

export interface RecognizerMatch {
  id: string;
  recognizer: Recognizer;
  range: [number, number];
  matchedText: string;
}

export interface SelectedPattern {
  id: string;
  match: RecognizerMatch;
  outputPattern: string;
}

export interface RegexOptions {
  caseInsensitive: boolean;
  multiline: boolean;
  dotMatchesNewline: boolean;
  matchWholeLine: boolean;
}

export interface LanguageGenerator {
  name: string;
  generate: (pattern: string, flags: string) => string;
}
```

**Step 2: Create the constants file with recognizers**

```typescript
// src/components/tools/RegexBuilder/constants.ts
import type { Recognizer, LanguageGenerator } from './types';

let idCounter = 0;
const genId = () => `match-${++idCounter}`;
export { genId };

export const RECOGNIZERS: Recognizer[] = [
  // Network
  {
    name: 'IPv4 Address',
    description: 'Matches IP addresses like 192.168.1.1',
    searchPattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    outputPattern: '(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)',
    priority: 90,
  },
  {
    name: 'MAC Address',
    description: 'Matches MAC addresses like 00:1A:2B:3C:4D:5E',
    searchPattern: /\b[0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){5}\b/g,
    outputPattern: '[0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){5}',
    priority: 85,
  },
  {
    name: 'Email Address',
    description: 'Matches email addresses',
    searchPattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    outputPattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    priority: 80,
  },
  {
    name: 'URL',
    description: 'Matches HTTP/HTTPS URLs',
    searchPattern: /https?:\/\/[^\s<>"{}|\\^`[\]]+/g,
    outputPattern: 'https?:\\/\\/[^\\s<>"{}|\\\\^`[\\]]+',
    priority: 75,
  },
  // Time
  {
    name: 'ISO8601 Timestamp',
    description: 'Matches ISO8601 datetime like 2024-01-27T10:30:00Z',
    searchPattern: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g,
    outputPattern: '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:?\\d{2})?',
    priority: 70,
  },
  {
    name: 'Date (YYYY-MM-DD)',
    description: 'Matches dates like 2024-01-27',
    searchPattern: /\b\d{4}-\d{2}-\d{2}\b/g,
    outputPattern: '\\d{4}-\\d{2}-\\d{2}',
    priority: 65,
  },
  {
    name: 'Time (HH:MM:SS)',
    description: 'Matches time like 10:30:00',
    searchPattern: /\b\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/g,
    outputPattern: '\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?',
    priority: 60,
  },
  // Identifiers
  {
    name: 'UUID',
    description: 'Matches UUIDs like 550e8400-e29b-41d4-a716-446655440000',
    searchPattern: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g,
    outputPattern: '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
    priority: 70,
  },
  {
    name: 'Hex Color',
    description: 'Matches hex colors like #FF5733 or #F00',
    searchPattern: /#(?:[0-9a-fA-F]{3}){1,2}\b/g,
    outputPattern: '#(?:[0-9a-fA-F]{3}){1,2}',
    priority: 55,
  },
  // Log-specific
  {
    name: 'Log Level',
    description: 'Matches log levels like INFO, ERROR, WARN',
    searchPattern: /\b(TRACE|DEBUG|INFO|NOTICE|WARN|WARNING|ERROR|SEVERE|FATAL|CRITICAL)\b/g,
    outputPattern: '(?:TRACE|DEBUG|INFO|NOTICE|WARN|WARNING|ERROR|SEVERE|FATAL|CRITICAL)',
    priority: 50,
  },
  {
    name: 'HTTP Method',
    description: 'Matches HTTP methods like GET, POST, PUT',
    searchPattern: /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\b/g,
    outputPattern: '(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)',
    priority: 50,
  },
  {
    name: 'HTTP Status Code',
    description: 'Matches 3-digit HTTP status codes',
    searchPattern: /\b[1-5][0-9]{2}\b/g,
    outputPattern: '[1-5][0-9]{2}',
    priority: 30,
  },
  // Basic patterns
  {
    name: 'Number',
    description: 'Matches integers like 42 or 1234',
    searchPattern: /\b\d+\b/g,
    outputPattern: '\\d+',
    priority: 20,
  },
  {
    name: 'Decimal Number',
    description: 'Matches decimals like 3.14 or 0.5',
    searchPattern: /\b\d+\.\d+\b/g,
    outputPattern: '\\d+\\.\\d+',
    priority: 25,
  },
  {
    name: 'Word',
    description: 'Matches word characters',
    searchPattern: /\b[a-zA-Z]+\b/g,
    outputPattern: '[a-zA-Z]+',
    priority: 15,
  },
  {
    name: 'Alphanumeric',
    description: 'Matches letters and numbers',
    searchPattern: /\b[a-zA-Z0-9]+\b/g,
    outputPattern: '[a-zA-Z0-9]+',
    priority: 10,
  },
  {
    name: 'Whitespace',
    description: 'Matches one or more whitespace characters',
    searchPattern: /\s+/g,
    outputPattern: '\\s+',
    priority: 5,
  },
  // Delimited
  {
    name: 'Double-Quoted String',
    description: 'Matches "quoted strings"',
    searchPattern: /"[^"]*"/g,
    outputPattern: '"[^"]*"',
    priority: 45,
  },
  {
    name: 'Single-Quoted String',
    description: "Matches 'quoted strings'",
    searchPattern: /'[^']*'/g,
    outputPattern: "'[^']*'",
    priority: 45,
  },
  {
    name: 'Parentheses Content',
    description: 'Matches (content in parentheses)',
    searchPattern: /\([^)]*\)/g,
    outputPattern: '\\([^)]*\\)',
    priority: 40,
  },
  {
    name: 'Brackets Content',
    description: 'Matches [content in brackets]',
    searchPattern: /\[[^\]]*\]/g,
    outputPattern: '\\[[^\\]]*\\]',
    priority: 40,
  },
  {
    name: 'Braces Content',
    description: 'Matches {content in braces}',
    searchPattern: /\{[^}]*\}/g,
    outputPattern: '\\{[^}]*\\}',
    priority: 40,
  },
];

export const LANGUAGE_GENERATORS: LanguageGenerator[] = [
  {
    name: 'JavaScript',
    generate: (pattern, flags) => {
      const escaped = pattern.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
      return `const regex = new RegExp(\`${escaped}\`, '${flags}');\nconst matches = text.match(regex);`;
    },
  },
  {
    name: 'Python',
    generate: (pattern, flags) => {
      const pyFlags = [];
      if (flags.includes('i')) pyFlags.push('re.IGNORECASE');
      if (flags.includes('m')) pyFlags.push('re.MULTILINE');
      if (flags.includes('s')) pyFlags.push('re.DOTALL');
      const flagStr = pyFlags.length > 0 ? `, ${pyFlags.join(' | ')}` : '';
      return `import re\n\npattern = re.compile(r'${pattern}'${flagStr})\nmatches = pattern.findall(text)`;
    },
  },
  {
    name: 'Go',
    generate: (pattern) => {
      return `import "regexp"\n\nre := regexp.MustCompile(\`${pattern}\`)\nmatches := re.FindAllString(text, -1)`;
    },
  },
  {
    name: 'grep',
    generate: (pattern, flags) => {
      const grepFlags = ['-E'];
      if (flags.includes('i')) grepFlags.push('-i');
      return `grep ${grepFlags.join(' ')} '${pattern}' file.txt`;
    },
  },
  {
    name: 'sed',
    generate: (pattern, flags) => {
      const sedFlags = flags.includes('i') ? 'I' : '';
      return `sed -n '/${pattern}/${sedFlags}p' file.txt`;
    },
  },
  {
    name: 'PowerShell',
    generate: (pattern, flags) => {
      const psFlags = flags.includes('i') ? ' -CaseSensitive:$false' : '';
      return `Select-String -Pattern '${pattern}'${psFlags} -Path file.txt`;
    },
  },
];

export const MAX_INPUT_LENGTH = 2000;
export const DEBOUNCE_MS = 200;
```

**Step 3: Commit**

```bash
git add src/components/tools/RegexBuilder/types.ts src/components/tools/RegexBuilder/constants.ts
git commit -m "feat(regex-builder): add types and recognizer constants"
```

---

## Task 2: Create Pattern Recognition Hook

**Files:**
- Create: `src/components/tools/RegexBuilder/hooks/usePatternRecognition.ts`

**Step 1: Create the hook**

```typescript
// src/components/tools/RegexBuilder/hooks/usePatternRecognition.ts
import { useMemo } from 'react';
import type { RecognizerMatch } from '../types';
import { RECOGNIZERS, genId } from '../constants';

export function usePatternRecognition(inputText: string): RecognizerMatch[] {
  return useMemo(() => {
    if (!inputText) return [];

    const matches: RecognizerMatch[] = [];

    for (const recognizer of RECOGNIZERS) {
      // Reset regex lastIndex for global patterns
      recognizer.searchPattern.lastIndex = 0;

      let match;
      while ((match = recognizer.searchPattern.exec(inputText)) !== null) {
        matches.push({
          id: genId(),
          recognizer,
          range: [match.index, match.index + match[0].length],
          matchedText: match[0],
        });
      }
    }

    // Sort by position, then by priority (higher priority first for same position)
    return matches.sort((a, b) => {
      if (a.range[0] !== b.range[0]) {
        return a.range[0] - b.range[0];
      }
      return b.recognizer.priority - a.recognizer.priority;
    });
  }, [inputText]);
}
```

**Step 2: Create hooks index**

```typescript
// src/components/tools/RegexBuilder/hooks/index.ts
export { usePatternRecognition } from './usePatternRecognition';
```

**Step 3: Commit**

```bash
git add src/components/tools/RegexBuilder/hooks/
git commit -m "feat(regex-builder): add pattern recognition hook"
```

---

## Task 3: Create TextInput Component with Highlighting

**Files:**
- Create: `src/components/tools/RegexBuilder/components/TextInput.tsx`

**Step 1: Create the TextInput component**

```typescript
// src/components/tools/RegexBuilder/components/TextInput.tsx
import { useRef, useCallback } from 'react';
import type { RecognizerMatch, SelectedPattern } from '../types';
import { MAX_INPUT_LENGTH } from '../constants';

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  matches: RecognizerMatch[];
  selectedPatterns: SelectedPattern[];
  onPositionClick: (position: number) => void;
}

export default function TextInput({
  value,
  onChange,
  matches,
  selectedPatterns,
  onPositionClick,
}: TextInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget;
      const position = textarea.selectionStart;
      onPositionClick(position);
    },
    [onPositionClick]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value.slice(0, MAX_INPUT_LENGTH);
      onChange(newValue);
    },
    [onChange]
  );

  // Build highlighted segments
  const buildHighlightedText = useCallback(() => {
    if (!value) return null;

    const selectedRanges = new Set(
      selectedPatterns.map((sp) => `${sp.match.range[0]}-${sp.match.range[1]}`)
    );

    // Create segments with highlight info
    const segments: { text: string; isMatch: boolean; isSelected: boolean; matchCount: number }[] = [];
    let lastEnd = 0;

    // Get unique ranges sorted by start position
    const uniqueRanges = new Map<string, { start: number; end: number; count: number; isSelected: boolean }>();

    for (const match of matches) {
      const key = `${match.range[0]}-${match.range[1]}`;
      const existing = uniqueRanges.get(key);
      const isSelected = selectedRanges.has(key);

      if (existing) {
        existing.count++;
        if (isSelected) existing.isSelected = true;
      } else {
        uniqueRanges.set(key, {
          start: match.range[0],
          end: match.range[1],
          count: 1,
          isSelected,
        });
      }
    }

    const sortedRanges = Array.from(uniqueRanges.values()).sort((a, b) => a.start - b.start);

    for (const range of sortedRanges) {
      // Add non-highlighted text before this match
      if (range.start > lastEnd) {
        segments.push({
          text: value.slice(lastEnd, range.start),
          isMatch: false,
          isSelected: false,
          matchCount: 0,
        });
      }

      // Add highlighted match (skip if overlapping with previous)
      if (range.start >= lastEnd) {
        segments.push({
          text: value.slice(range.start, range.end),
          isMatch: true,
          isSelected: range.isSelected,
          matchCount: range.count,
        });
        lastEnd = range.end;
      }
    }

    // Add remaining text
    if (lastEnd < value.length) {
      segments.push({
        text: value.slice(lastEnd),
        isMatch: false,
        isSelected: false,
        matchCount: 0,
      });
    }

    return segments;
  }, [value, matches, selectedPatterns]);

  const segments = buildHighlightedText();

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        Sample Text
      </label>
      <div className="relative">
        {/* Highlight layer */}
        <div
          className="absolute inset-0 p-3 font-mono text-sm whitespace-pre-wrap break-words pointer-events-none overflow-hidden rounded-lg"
          aria-hidden="true"
        >
          {segments?.map((segment, i) => (
            <span
              key={i}
              className={
                segment.isMatch
                  ? segment.isSelected
                    ? 'bg-primary-200 dark:bg-primary-800 rounded'
                    : segment.matchCount > 1
                    ? 'bg-amber-200 dark:bg-amber-800/50 rounded'
                    : 'bg-slate-200 dark:bg-slate-700 rounded'
                  : ''
              }
            >
              {segment.text}
            </span>
          ))}
        </div>

        {/* Actual textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onClick={handleClick}
          placeholder="Paste your sample text here... (e.g., a log line, CSV row, or any text you want to match)"
          rows={6}
          className="relative w-full p-3 font-mono text-sm bg-transparent border border-slate-300 dark:border-slate-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 caret-slate-900 dark:caret-white"
          style={{ caretColor: 'currentColor' }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>Click on highlighted text to see pattern options</span>
        <span>{value.length}/{MAX_INPUT_LENGTH}</span>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tools/RegexBuilder/components/TextInput.tsx
git commit -m "feat(regex-builder): add TextInput component with highlighting"
```

---

## Task 4: Create PatternMatches Component

**Files:**
- Create: `src/components/tools/RegexBuilder/components/PatternMatches.tsx`

**Step 1: Create the component**

```typescript
// src/components/tools/RegexBuilder/components/PatternMatches.tsx
import { useMemo } from 'react';
import { Plus, Check } from 'lucide-react';
import type { RecognizerMatch, SelectedPattern } from '../types';

interface PatternMatchesProps {
  matches: RecognizerMatch[];
  activePosition: number | null;
  selectedPatterns: SelectedPattern[];
  onSelectPattern: (match: RecognizerMatch) => void;
  onDeselectPattern: (id: string) => void;
}

export default function PatternMatches({
  matches,
  activePosition,
  selectedPatterns,
  onSelectPattern,
  onDeselectPattern,
}: PatternMatchesProps) {
  // Find matches at the active position
  const matchesAtPosition = useMemo(() => {
    if (activePosition === null) return [];

    return matches.filter(
      (m) => activePosition >= m.range[0] && activePosition < m.range[1]
    ).sort((a, b) => b.recognizer.priority - a.recognizer.priority);
  }, [matches, activePosition]);

  const selectedIds = useMemo(
    () => new Set(selectedPatterns.map((sp) => sp.match.id)),
    [selectedPatterns]
  );

  // Also check if same range is already selected (different match object but same position)
  const selectedRanges = useMemo(
    () => new Set(selectedPatterns.map((sp) => `${sp.match.range[0]}-${sp.match.range[1]}`)),
    [selectedPatterns]
  );

  if (matchesAtPosition.length === 0) {
    return (
      <div className="card">
        <div className="card-body">
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
            {activePosition === null
              ? 'Click on highlighted text to see available patterns'
              : 'No patterns detected at this position'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-slate-900 dark:text-white">
          Patterns at Position
        </h3>
      </div>
      <div className="card-body space-y-2">
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
          Matched: <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-sm">{matchesAtPosition[0]?.matchedText}</code>
        </p>
        {matchesAtPosition.map((match) => {
          const rangeKey = `${match.range[0]}-${match.range[1]}`;
          const isSelected = selectedIds.has(match.id) || selectedRanges.has(rangeKey);

          // Find the selected pattern for this range to get its ID for deselection
          const selectedPattern = selectedPatterns.find(
            (sp) => `${sp.match.range[0]}-${sp.match.range[1]}` === rangeKey
          );

          return (
            <button
              key={match.id}
              onClick={() =>
                isSelected && selectedPattern
                  ? onDeselectPattern(selectedPattern.id)
                  : onSelectPattern(match)
              }
              className={`w-full p-3 rounded-lg border text-left transition-colors ${
                isSelected
                  ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {match.recognizer.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {match.recognizer.description}
                  </p>
                </div>
                {isSelected ? (
                  <Check className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                ) : (
                  <Plus className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <code className="block mt-2 text-xs text-slate-600 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-900 p-1.5 rounded overflow-x-auto">
                {match.recognizer.outputPattern}
              </code>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tools/RegexBuilder/components/PatternMatches.tsx
git commit -m "feat(regex-builder): add PatternMatches component"
```

---

## Task 5: Create SelectedPatterns Component

**Files:**
- Create: `src/components/tools/RegexBuilder/components/SelectedPatterns.tsx`

**Step 1: Create the component**

```typescript
// src/components/tools/RegexBuilder/components/SelectedPatterns.tsx
import { X, GripVertical } from 'lucide-react';
import type { SelectedPattern } from '../types';

interface SelectedPatternsProps {
  patterns: SelectedPattern[];
  onRemove: (id: string) => void;
}

export default function SelectedPatterns({ patterns, onRemove }: SelectedPatternsProps) {
  if (patterns.length === 0) {
    return (
      <div className="card">
        <div className="card-body">
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
            No patterns selected yet. Click on highlighted text and select patterns to build your regex.
          </p>
        </div>
      </div>
    );
  }

  // Sort by position in the original text
  const sortedPatterns = [...patterns].sort(
    (a, b) => a.match.range[0] - b.match.range[0]
  );

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-slate-900 dark:text-white">
          Selected Patterns ({patterns.length})
        </h3>
      </div>
      <div className="card-body space-y-2">
        {sortedPatterns.map((pattern, index) => (
          <div
            key={pattern.id}
            className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg group"
          >
            <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="w-6 h-6 flex items-center justify-center bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded text-xs font-medium flex-shrink-0">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                {pattern.match.recognizer.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                "{pattern.match.matchedText}"
              </p>
            </div>
            <button
              onClick={() => onRemove(pattern.id)}
              className="p-1 text-slate-400 hover:text-danger-600 dark:hover:text-danger-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove pattern"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tools/RegexBuilder/components/SelectedPatterns.tsx
git commit -m "feat(regex-builder): add SelectedPatterns component"
```

---

## Task 6: Create OptionsPanel Component

**Files:**
- Create: `src/components/tools/RegexBuilder/components/OptionsPanel.tsx`

**Step 1: Create the component**

```typescript
// src/components/tools/RegexBuilder/components/OptionsPanel.tsx
import type { RegexOptions } from '../types';

interface OptionsPanelProps {
  options: RegexOptions;
  onChange: (options: RegexOptions) => void;
}

export default function OptionsPanel({ options, onChange }: OptionsPanelProps) {
  const updateOption = <K extends keyof RegexOptions>(key: K, value: RegexOptions[K]) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-slate-900 dark:text-white">Options</h3>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.caseInsensitive}
              onChange={(e) => updateOption('caseInsensitive', e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-primary-600"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Case insensitive <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">i</code>
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.multiline}
              onChange={(e) => updateOption('multiline', e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-primary-600"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Multiline <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">m</code>
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.dotMatchesNewline}
              onChange={(e) => updateOption('dotMatchesNewline', e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-primary-600"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Dot matches newline <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">s</code>
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.matchWholeLine}
              onChange={(e) => updateOption('matchWholeLine', e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-primary-600"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Match whole line <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">^$</code>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tools/RegexBuilder/components/OptionsPanel.tsx
git commit -m "feat(regex-builder): add OptionsPanel component"
```

---

## Task 7: Create RegexOutput Component

**Files:**
- Create: `src/components/tools/RegexBuilder/components/RegexOutput.tsx`

**Step 1: Create the component**

```typescript
// src/components/tools/RegexBuilder/components/RegexOutput.tsx
import { useState, useMemo, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import type { SelectedPattern, RegexOptions } from '../types';

interface RegexOutputProps {
  inputText: string;
  selectedPatterns: SelectedPattern[];
  options: RegexOptions;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default function RegexOutput({
  inputText,
  selectedPatterns,
  options,
}: RegexOutputProps) {
  const [copied, setCopied] = useState(false);

  const regex = useMemo(() => {
    if (selectedPatterns.length === 0) return '';

    const sorted = [...selectedPatterns].sort(
      (a, b) => a.match.range[0] - b.match.range[0]
    );

    let result = '';
    let lastEnd = 0;

    for (const pattern of sorted) {
      const [start, end] = pattern.match.range;

      // Handle gap between last selection and this one
      if (start > lastEnd) {
        const gap = inputText.slice(lastEnd, start);
        result += escapeRegex(gap);
      }

      result += pattern.outputPattern;
      lastEnd = end;
    }

    // Handle trailing text after last selection
    if (lastEnd < inputText.length) {
      result += escapeRegex(inputText.slice(lastEnd));
    }

    // Apply options
    if (options.matchWholeLine) {
      result = `^${result}$`;
    }

    return result;
  }, [inputText, selectedPatterns, options.matchWholeLine]);

  const flags = useMemo(() => {
    let f = '';
    if (options.caseInsensitive) f += 'i';
    if (options.multiline) f += 'm';
    if (options.dotMatchesNewline) f += 's';
    return f;
  }, [options]);

  const copyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(regex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [regex]);

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white">
          Generated Regex
        </h3>
        {regex && (
          <button
            onClick={copyToClipboard}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </button>
        )}
      </div>
      <div className="card-body">
        {regex ? (
          <>
            <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-slate-100 overflow-x-auto border border-slate-700">
              <span className="text-slate-500">/</span>
              {regex}
              <span className="text-slate-500">/</span>
              <span className="text-primary-400">{flags}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {regex.length} characters
              {flags && ` • Flags: ${flags}`}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
            Select patterns from your sample text to generate a regex
          </p>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tools/RegexBuilder/components/RegexOutput.tsx
git commit -m "feat(regex-builder): add RegexOutput component"
```

---

## Task 8: Create CodeSnippets Component

**Files:**
- Create: `src/components/tools/RegexBuilder/components/CodeSnippets.tsx`

**Step 1: Create the component**

```typescript
// src/components/tools/RegexBuilder/components/CodeSnippets.tsx
import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import type { RegexOptions } from '../types';
import { LANGUAGE_GENERATORS } from '../constants';

interface CodeSnippetsProps {
  regex: string;
  options: RegexOptions;
}

export default function CodeSnippets({ regex, options }: CodeSnippetsProps) {
  const [expandedLang, setExpandedLang] = useState<string | null>(null);
  const [copiedLang, setCopiedLang] = useState<string | null>(null);

  const flags = useMemo(() => {
    let f = '';
    if (options.caseInsensitive) f += 'i';
    if (options.multiline) f += 'm';
    if (options.dotMatchesNewline) f += 's';
    return f;
  }, [options]);

  const copySnippet = useCallback(async (lang: string, code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedLang(lang);
    setTimeout(() => setCopiedLang(null), 2000);
  }, []);

  if (!regex) {
    return null;
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-slate-900 dark:text-white">
          Code Snippets
        </h3>
      </div>
      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {LANGUAGE_GENERATORS.map((lang) => {
          const code = lang.generate(regex, flags);
          const isExpanded = expandedLang === lang.name;

          return (
            <div key={lang.name}>
              <button
                onClick={() => setExpandedLang(isExpanded ? null : lang.name)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {lang.name}
                </span>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4">
                  <div className="relative">
                    <pre className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-slate-100 overflow-x-auto border border-slate-700">
                      {code}
                    </pre>
                    <button
                      onClick={() => copySnippet(lang.name, code)}
                      className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                      title="Copy code"
                    >
                      {copiedLang === lang.name ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tools/RegexBuilder/components/CodeSnippets.tsx
git commit -m "feat(regex-builder): add CodeSnippets component"
```

---

## Task 9: Create TestArea Component

**Files:**
- Create: `src/components/tools/RegexBuilder/components/TestArea.tsx`

**Step 1: Create the component**

```typescript
// src/components/tools/RegexBuilder/components/TestArea.tsx
import { useState, useMemo } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import type { RegexOptions } from '../types';

interface TestAreaProps {
  regex: string;
  options: RegexOptions;
}

export default function TestArea({ regex, options }: TestAreaProps) {
  const [testText, setTestText] = useState('');

  const result = useMemo(() => {
    if (!regex || !testText) return null;

    try {
      let flags = 'g';
      if (options.caseInsensitive) flags += 'i';
      if (options.multiline) flags += 'm';
      if (options.dotMatchesNewline) flags += 's';

      const re = new RegExp(regex, flags);
      const matches = testText.match(re);

      return {
        isMatch: matches !== null && matches.length > 0,
        matches: matches || [],
        error: null,
      };
    } catch (e) {
      return {
        isMatch: false,
        matches: [],
        error: (e as Error).message,
      };
    }
  }, [regex, testText, options]);

  if (!regex) {
    return null;
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-slate-900 dark:text-white">
          Test Regex
        </h3>
      </div>
      <div className="card-body space-y-3">
        <textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="Paste text here to test your regex..."
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />

        {result && testText && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg ${
              result.error
                ? 'bg-danger-50 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300'
                : result.isMatch
                ? 'bg-success-50 dark:bg-success-900/30 text-success-700 dark:text-success-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {result.error ? (
              <>
                <XCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">Error: {result.error}</span>
              </>
            ) : result.isMatch ? (
              <>
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">
                  {result.matches.length} match{result.matches.length !== 1 ? 'es' : ''} found
                </span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">No matches found</span>
              </>
            )}
          </div>
        )}

        {result?.isMatch && result.matches.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Matches:</p>
            <div className="flex flex-wrap gap-1">
              {result.matches.slice(0, 10).map((match, i) => (
                <code
                  key={i}
                  className="px-2 py-1 bg-success-100 dark:bg-success-900/50 text-success-800 dark:text-success-200 rounded text-xs font-mono"
                >
                  {match}
                </code>
              ))}
              {result.matches.length > 10 && (
                <span className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400">
                  +{result.matches.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tools/RegexBuilder/components/TestArea.tsx
git commit -m "feat(regex-builder): add TestArea component"
```

---

## Task 10: Create Components Index and Main Component

**Files:**
- Create: `src/components/tools/RegexBuilder/components/index.ts`
- Create: `src/components/tools/RegexBuilder/index.tsx`

**Step 1: Create components index**

```typescript
// src/components/tools/RegexBuilder/components/index.ts
export { default as TextInput } from './TextInput';
export { default as PatternMatches } from './PatternMatches';
export { default as SelectedPatterns } from './SelectedPatterns';
export { default as OptionsPanel } from './OptionsPanel';
export { default as RegexOutput } from './RegexOutput';
export { default as CodeSnippets } from './CodeSnippets';
export { default as TestArea } from './TestArea';
```

**Step 2: Create main component**

```typescript
// src/components/tools/RegexBuilder/index.tsx
import { useState, useCallback, useMemo } from 'react';
import { Regex } from 'lucide-react';
import {
  TextInput,
  PatternMatches,
  SelectedPatterns,
  OptionsPanel,
  RegexOutput,
  CodeSnippets,
  TestArea,
} from './components';
import { usePatternRecognition } from './hooks';
import type { SelectedPattern, RegexOptions, RecognizerMatch } from './types';
import { genId } from './constants';

const DEFAULT_OPTIONS: RegexOptions = {
  caseInsensitive: false,
  multiline: false,
  dotMatchesNewline: false,
  matchWholeLine: false,
};

export default function RegexBuilder() {
  const [inputText, setInputText] = useState('');
  const [selectedPatterns, setSelectedPatterns] = useState<SelectedPattern[]>([]);
  const [activePosition, setActivePosition] = useState<number | null>(null);
  const [options, setOptions] = useState<RegexOptions>(DEFAULT_OPTIONS);

  const matches = usePatternRecognition(inputText);

  const handleSelectPattern = useCallback((match: RecognizerMatch) => {
    setSelectedPatterns((prev) => [
      ...prev,
      {
        id: genId(),
        match,
        outputPattern: match.recognizer.outputPattern,
      },
    ]);
  }, []);

  const handleDeselectPattern = useCallback((id: string) => {
    setSelectedPatterns((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleInputChange = useCallback((value: string) => {
    setInputText(value);
    // Clear selections when input changes significantly
    setSelectedPatterns([]);
    setActivePosition(null);
  }, []);

  // Compute the final regex for passing to child components
  const finalRegex = useMemo(() => {
    if (selectedPatterns.length === 0) return '';

    const sorted = [...selectedPatterns].sort(
      (a, b) => a.match.range[0] - b.match.range[0]
    );

    let result = '';
    let lastEnd = 0;

    const escapeRegex = (str: string): string =>
      str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    for (const pattern of sorted) {
      const [start, end] = pattern.match.range;

      if (start > lastEnd) {
        const gap = inputText.slice(lastEnd, start);
        result += escapeRegex(gap);
      }

      result += pattern.outputPattern;
      lastEnd = end;
    }

    if (lastEnd < inputText.length) {
      result += escapeRegex(inputText.slice(lastEnd));
    }

    if (options.matchWholeLine) {
      result = `^${result}$`;
    }

    return result;
  }, [inputText, selectedPatterns, options.matchWholeLine]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Regex className="w-7 h-7" />
          Regex Builder
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Build regular expressions by selecting patterns from sample text
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Input and Pattern Selection */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-body">
              <TextInput
                value={inputText}
                onChange={handleInputChange}
                matches={matches}
                selectedPatterns={selectedPatterns}
                onPositionClick={setActivePosition}
              />
            </div>
          </div>

          <RegexOutput
            inputText={inputText}
            selectedPatterns={selectedPatterns}
            options={options}
          />

          <TestArea regex={finalRegex} options={options} />

          <CodeSnippets regex={finalRegex} options={options} />
        </div>

        {/* Right column: Pattern options and selections */}
        <div className="space-y-6">
          <PatternMatches
            matches={matches}
            activePosition={activePosition}
            selectedPatterns={selectedPatterns}
            onSelectPattern={handleSelectPattern}
            onDeselectPattern={handleDeselectPattern}
          />

          <SelectedPatterns
            patterns={selectedPatterns}
            onRemove={handleDeselectPattern}
          />

          <OptionsPanel options={options} onChange={setOptions} />
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/tools/RegexBuilder/components/index.ts src/components/tools/RegexBuilder/index.tsx
git commit -m "feat(regex-builder): add main RegexBuilder component"
```

---

## Task 11: Wire Up Routes and Dashboard

**Files:**
- Modify: `src/components/tools/index.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Dashboard.tsx`

**Step 1: Export RegexBuilder from tools index**

Add to `src/components/tools/index.ts`:

```typescript
export { default as RegexBuilder } from './RegexBuilder'
```

**Step 2: Add route in App.tsx**

Add import and route in `src/App.tsx`:

```typescript
// Add to imports
import {
  PcapAnalyzer,
  DnsLookup,
  SslChecker,
  PathTracer,
  CaptureBuilder,
  IperfServer,
  RegexBuilder,  // Add this
} from './components/tools'

// Add route inside <Routes>
<Route path="regex-builder" element={<RegexBuilder />} />
```

**Step 3: Add to Dashboard**

Add to the tools array in `src/components/layout/Dashboard.tsx`:

```typescript
// Add import
import { Regex } from 'lucide-react'  // Add Regex to existing import

// Add to tools array
{
  name: 'Regex Builder',
  description: 'Build regular expressions by selecting patterns from sample text.',
  href: '/regex-builder',
  icon: Regex,
  subtitle: 'Pattern detection • Multi-language',
  color: 'from-violet-500 to-violet-600',
},
```

**Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

**Step 5: Commit**

```bash
git add src/components/tools/index.ts src/App.tsx src/components/layout/Dashboard.tsx
git commit -m "feat(regex-builder): wire up routes and dashboard"
```

---

## Task 12: Final Testing and Cleanup

**Step 1: Run dev server and test manually**

```bash
npm run dev
```

Test the following:
1. Navigate to /regex-builder
2. Paste sample text: `192.168.1.1 - user@example.com [2024-01-27T10:30:00Z] "GET /api/users" 200`
3. Verify patterns are highlighted
4. Click on highlighted text and see pattern options
5. Select patterns and verify regex builds correctly
6. Test the regex in the test area
7. Expand code snippets and verify they look correct
8. Toggle options and verify they affect output
9. Test dark mode

**Step 2: Fix any issues found during testing**

**Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(regex-builder): polish and fixes from manual testing"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Types and constants | types.ts, constants.ts |
| 2 | Pattern recognition hook | hooks/usePatternRecognition.ts |
| 3 | TextInput with highlighting | components/TextInput.tsx |
| 4 | PatternMatches component | components/PatternMatches.tsx |
| 5 | SelectedPatterns component | components/SelectedPatterns.tsx |
| 6 | OptionsPanel component | components/OptionsPanel.tsx |
| 7 | RegexOutput component | components/RegexOutput.tsx |
| 8 | CodeSnippets component | components/CodeSnippets.tsx |
| 9 | TestArea component | components/TestArea.tsx |
| 10 | Components index + main | components/index.ts, index.tsx |
| 11 | Routes and dashboard | tools/index.ts, App.tsx, Dashboard.tsx |
| 12 | Final testing | Manual verification |
