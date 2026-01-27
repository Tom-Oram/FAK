import { useState, useCallback } from 'react';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { CommandStep } from '../types';

interface CommandOutputProps {
  steps: CommandStep[];
  title?: string;
}

export default function CommandOutput({ steps, title = 'Generated Commands' }: CommandOutputProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showFlags, setShowFlags] = useState<Set<number>>(new Set());

  const copyToClipboard = useCallback(async (text: string, index: number | 'all') => {
    await navigator.clipboard.writeText(text);
    if (index === 'all') {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } else {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  }, []);

  const toggleFlags = useCallback((index: number) => {
    setShowFlags((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const getAllCommands = useCallback(() => {
    return steps
      .map((step) => `# Step ${step.step}: ${step.title}\n${step.command}`)
      .join('\n\n');
  }, [steps]);

  if (steps.length === 0) {
    return (
      <div className="card">
        <div className="card-body text-center text-slate-500">
          Configure options above to generate commands
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
        <button
          onClick={() => copyToClipboard(getAllCommands(), 'all')}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          {copiedAll ? (
            <>
              <Check className="w-4 h-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy All
            </>
          )}
        </button>
      </div>
      <div className="card-body space-y-4">
        {steps.map((step, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Step {step.step}: {step.title}
              </span>
              <button
                onClick={() => copyToClipboard(step.command, index)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                title="Copy command"
              >
                {copiedIndex === index ? (
                  <Check className="w-4 h-4 text-success-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="bg-slate-900 rounded-lg p-3 font-mono text-sm text-slate-100 overflow-x-auto border border-slate-700">
              {step.command}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{step.explanation}</p>
            {step.flags && step.flags.length > 0 && (
              <div>
                <button
                  onClick={() => toggleFlags(index)}
                  className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                >
                  {showFlags.has(index) ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  Show what each flag does
                </button>
                {showFlags.has(index) && (
                  <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800 rounded text-xs space-y-1 border border-slate-200 dark:border-slate-700">
                    {step.flags.map((flag, i) => (
                      <div key={i} className="flex gap-2">
                        <code className="font-mono text-primary-600 dark:text-primary-400">{flag.flag}</code>
                        <span className="text-slate-600 dark:text-slate-400">→ {flag.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
