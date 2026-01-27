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
