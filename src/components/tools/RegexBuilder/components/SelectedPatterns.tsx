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
