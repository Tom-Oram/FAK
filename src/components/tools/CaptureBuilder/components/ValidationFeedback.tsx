import { AlertCircle, AlertTriangle } from 'lucide-react';
import { ValidationMessage } from '../types';

interface ValidationFeedbackProps {
  messages: ValidationMessage[];
}

export default function ValidationFeedback({ messages }: ValidationFeedbackProps) {
  if (messages.length === 0) return null;

  const errors = messages.filter((m) => m.severity === 'error');
  const warnings = messages.filter((m) => m.severity === 'warning');

  return (
    <div className="space-y-2">
      {errors.map((msg, i) => (
        <div
          key={`error-${i}`}
          className="flex items-start gap-2 p-2 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg"
        >
          <AlertCircle className="w-4 h-4 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger-800 dark:text-danger-300">{msg.message}</p>
        </div>
      ))}
      {warnings.map((msg, i) => (
        <div
          key={`warning-${i}`}
          className="flex items-start gap-2 p-2 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg"
        >
          <AlertTriangle className="w-4 h-4 text-warning-600 dark:text-warning-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-warning-800 dark:text-warning-300">{msg.message}</p>
        </div>
      ))}
    </div>
  );
}
