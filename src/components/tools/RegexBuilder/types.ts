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
