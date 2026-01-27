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
