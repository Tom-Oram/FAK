import { ArrowRight } from 'lucide-react';
import { NatTranslation } from '../types';

interface NatBlockProps {
  translation: NatTranslation;
  label: string; // "Source NAT" or "Destination NAT"
}

export default function NatBlock({ translation, label }: NatBlockProps) {
  const originalPort = translation.original_port;
  const translatedPort = translation.translated_port;

  const ipChanged = translation.original_ip !== translation.translated_ip;
  const portChanged = originalPort !== translatedPort && translatedPort !== null;

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{label}</span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          ({translation.nat_rule_name})
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Original */}
        <div className="flex-1 text-right">
          <span className={`text-sm font-mono ${ipChanged ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
            {translation.original_ip}
          </span>
          {originalPort && (
            <span className={`text-xs font-mono ${portChanged ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
              :{originalPort}
            </span>
          )}
        </div>

        {/* Arrow */}
        <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />

        {/* Translated */}
        <div className="flex-1">
          <span className={`text-sm font-mono font-semibold ${ipChanged ? 'text-primary-600 dark:text-primary-400' : 'text-slate-700 dark:text-slate-300'}`}>
            {translation.translated_ip}
          </span>
          {translatedPort && (
            <span className={`text-xs font-mono font-semibold ${portChanged ? 'text-primary-600 dark:text-primary-400' : 'text-slate-700 dark:text-slate-300'}`}>
              :{translatedPort}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
