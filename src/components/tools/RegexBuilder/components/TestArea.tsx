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
