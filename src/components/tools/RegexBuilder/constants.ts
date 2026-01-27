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
