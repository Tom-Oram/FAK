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
