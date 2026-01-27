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
