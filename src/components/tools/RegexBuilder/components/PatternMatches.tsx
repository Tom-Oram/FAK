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
