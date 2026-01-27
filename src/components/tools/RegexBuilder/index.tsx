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
