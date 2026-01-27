// src/components/tools/RegexBuilder/components/OptionsPanel.tsx
import type { RegexOptions } from '../types';

interface OptionsPanelProps {
  options: RegexOptions;
  onChange: (options: RegexOptions) => void;
}

export default function OptionsPanel({ options, onChange }: OptionsPanelProps) {
  const updateOption = <K extends keyof RegexOptions>(key: K, value: RegexOptions[K]) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-slate-900 dark:text-white">Options</h3>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.caseInsensitive}
              onChange={(e) => updateOption('caseInsensitive', e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-primary-600"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Case insensitive <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">i</code>
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.multiline}
              onChange={(e) => updateOption('multiline', e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-primary-600"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Multiline <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">m</code>
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.dotMatchesNewline}
              onChange={(e) => updateOption('dotMatchesNewline', e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-primary-600"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Dot matches newline <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">s</code>
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.matchWholeLine}
              onChange={(e) => updateOption('matchWholeLine', e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-primary-600"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Match whole line <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">^$</code>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
