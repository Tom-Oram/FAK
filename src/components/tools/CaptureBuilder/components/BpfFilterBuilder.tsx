import { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  FilterCondition,
  FilterConditionType,
  FilterDirection,
  FilterOperator,
  BpfFilterState,
} from '../types';
import { PROTOCOLS } from '../constants';

interface BpfFilterBuilderProps {
  value: BpfFilterState;
  onChange: (state: BpfFilterState) => void;
}

const CONDITION_TYPES: { value: FilterConditionType; label: string }[] = [
  { value: 'protocol', label: 'Protocol' },
  { value: 'host', label: 'Host' },
  { value: 'port', label: 'Port' },
  { value: 'net', label: 'Network' },
  { value: 'portrange', label: 'Port Range' },
];

const DIRECTIONS: { value: FilterDirection; label: string }[] = [
  { value: 'src or dst', label: 'src or dst' },
  { value: 'src', label: 'src' },
  { value: 'dst', label: 'dst' },
];

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function buildFilterString(conditions: FilterCondition[], operators: FilterOperator[]): string {
  const enabledConditions = conditions.filter((c) => c.enabled);
  if (enabledConditions.length === 0) return '';

  const parts: string[] = [];

  enabledConditions.forEach((condition, index) => {
    let part = '';

    if (condition.not) part += 'not ';

    switch (condition.type) {
      case 'protocol':
        if (condition.protocol) part += condition.protocol;
        break;
      case 'host':
        if (condition.host) {
          if (condition.direction && condition.direction !== 'src or dst') {
            part += `${condition.direction} host ${condition.host}`;
          } else {
            part += `host ${condition.host}`;
          }
        }
        break;
      case 'port':
        if (condition.port) {
          if (condition.direction && condition.direction !== 'src or dst') {
            part += `${condition.direction} port ${condition.port}`;
          } else {
            part += `port ${condition.port}`;
          }
        }
        break;
      case 'net':
        if (condition.net) {
          if (condition.direction && condition.direction !== 'src or dst') {
            part += `${condition.direction} net ${condition.net}`;
          } else {
            part += `net ${condition.net}`;
          }
        }
        break;
      case 'portrange':
        if (condition.port && condition.portEnd) {
          if (condition.direction && condition.direction !== 'src or dst') {
            part += `${condition.direction} portrange ${condition.port}-${condition.portEnd}`;
          } else {
            part += `portrange ${condition.port}-${condition.portEnd}`;
          }
        }
        break;
    }

    if (part && part !== 'not ') {
      if (index > 0 && parts.length > 0) {
        const opIndex = Math.min(index - 1, operators.length - 1);
        parts.push(operators[opIndex] || 'and');
      }
      parts.push(part.trim());
    }
  });

  return parts.join(' ');
}

export default function BpfFilterBuilder({ value, onChange }: BpfFilterBuilderProps) {
  const [localRaw, setLocalRaw] = useState(value.rawFilter);

  useEffect(() => {
    if (!value.rawMode) {
      const generated = buildFilterString(value.conditions, value.operators);
      setLocalRaw(generated);
    }
  }, [value.conditions, value.operators, value.rawMode]);

  const addCondition = useCallback(() => {
    const newCondition: FilterCondition = {
      id: generateId(),
      enabled: true,
      not: false,
      type: 'host',
      direction: 'src or dst',
    };
    const newOperators = value.conditions.length > 0 ? [...value.operators, 'and' as FilterOperator] : value.operators;
    onChange({
      ...value,
      conditions: [...value.conditions, newCondition],
      operators: newOperators,
    });
  }, [value, onChange]);

  const updateCondition = useCallback(
    (id: string, updates: Partial<FilterCondition>) => {
      onChange({
        ...value,
        conditions: value.conditions.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      });
    },
    [value, onChange]
  );

  const removeCondition = useCallback(
    (id: string) => {
      const index = value.conditions.findIndex((c) => c.id === id);
      const newConditions = value.conditions.filter((c) => c.id !== id);
      const newOperators = [...value.operators];
      if (index > 0) {
        newOperators.splice(index - 1, 1);
      } else if (newOperators.length > 0) {
        newOperators.splice(0, 1);
      }
      onChange({
        ...value,
        conditions: newConditions,
        operators: newOperators,
      });
    },
    [value, onChange]
  );

  const updateOperator = useCallback(
    (index: number, operator: FilterOperator) => {
      const newOperators = [...value.operators];
      newOperators[index] = operator;
      onChange({ ...value, operators: newOperators });
    },
    [value, onChange]
  );

  const toggleRawMode = useCallback(() => {
    if (!value.rawMode) {
      const generated = buildFilterString(value.conditions, value.operators);
      onChange({ ...value, rawMode: true, rawFilter: generated });
      setLocalRaw(generated);
    } else {
      onChange({ ...value, rawMode: false });
    }
  }, [value, onChange]);

  const handleRawChange = useCallback(
    (raw: string) => {
      setLocalRaw(raw);
      onChange({ ...value, rawFilter: raw, isValid: true });
    },
    [value, onChange]
  );

  const filterString = value.rawMode ? localRaw : buildFilterString(value.conditions, value.operators);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700">BPF Filter</label>
        <button
          onClick={toggleRawMode}
          className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
        >
          {value.rawMode ? (
            <>
              <ToggleRight className="w-4 h-4" />
              Switch to Visual
            </>
          ) : (
            <>
              <ToggleLeft className="w-4 h-4" />
              Switch to Raw
            </>
          )}
        </button>
      </div>

      {value.rawMode ? (
        <div>
          <textarea
            value={localRaw}
            onChange={(e) => handleRawChange(e.target.value)}
            placeholder="e.g., tcp port 443 and host 192.168.1.1"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            rows={2}
          />
          {!value.isValid && value.parseError && (
            <p className="mt-1 text-xs text-danger-600">{value.parseError}</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {value.conditions.map((condition, index) => (
            <div key={condition.id}>
              {index > 0 && (
                <div className="flex justify-center my-2">
                  <select
                    value={value.operators[index - 1] || 'and'}
                    onChange={(e) => updateOperator(index - 1, e.target.value as FilterOperator)}
                    className="px-2 py-1 text-xs border border-slate-300 rounded bg-slate-50 font-medium"
                  >
                    <option value="and">AND</option>
                    <option value="or">OR</option>
                  </select>
                </div>
              )}
              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={condition.enabled}
                  onChange={(e) => updateCondition(condition.id, { enabled: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <select
                  value={condition.not ? 'not' : ''}
                  onChange={(e) => updateCondition(condition.id, { not: e.target.value === 'not' })}
                  className="px-2 py-1 text-sm border border-slate-300 rounded"
                >
                  <option value="">—</option>
                  <option value="not">NOT</option>
                </select>
                <select
                  value={condition.type}
                  onChange={(e) =>
                    updateCondition(condition.id, { type: e.target.value as FilterConditionType })
                  }
                  className="px-2 py-1 text-sm border border-slate-300 rounded"
                >
                  {CONDITION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>

                {condition.type === 'protocol' && (
                  <select
                    value={condition.protocol || ''}
                    onChange={(e) => updateCondition(condition.id, { protocol: e.target.value })}
                    className="px-2 py-1 text-sm border border-slate-300 rounded flex-1"
                  >
                    <option value="">Select...</option>
                    {PROTOCOLS.filter((p) => p.value).map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                )}

                {(condition.type === 'host' || condition.type === 'net') && (
                  <>
                    <select
                      value={condition.direction || 'src or dst'}
                      onChange={(e) =>
                        updateCondition(condition.id, { direction: e.target.value as FilterDirection })
                      }
                      className="px-2 py-1 text-sm border border-slate-300 rounded"
                    >
                      {DIRECTIONS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={condition.type === 'host' ? condition.host || '' : condition.net || ''}
                      onChange={(e) =>
                        updateCondition(condition.id, {
                          [condition.type === 'host' ? 'host' : 'net']: e.target.value,
                        })
                      }
                      placeholder={condition.type === 'host' ? '192.168.1.1' : '192.168.1.0/24'}
                      className="px-2 py-1 text-sm border border-slate-300 rounded flex-1"
                    />
                  </>
                )}

                {condition.type === 'port' && (
                  <>
                    <select
                      value={condition.direction || 'src or dst'}
                      onChange={(e) =>
                        updateCondition(condition.id, { direction: e.target.value as FilterDirection })
                      }
                      className="px-2 py-1 text-sm border border-slate-300 rounded"
                    >
                      {DIRECTIONS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={condition.port || ''}
                      onChange={(e) =>
                        updateCondition(condition.id, { port: parseInt(e.target.value) || undefined })
                      }
                      placeholder="443"
                      className="px-2 py-1 text-sm border border-slate-300 rounded w-24"
                    />
                  </>
                )}

                {condition.type === 'portrange' && (
                  <>
                    <select
                      value={condition.direction || 'src or dst'}
                      onChange={(e) =>
                        updateCondition(condition.id, { direction: e.target.value as FilterDirection })
                      }
                      className="px-2 py-1 text-sm border border-slate-300 rounded"
                    >
                      {DIRECTIONS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={condition.port || ''}
                      onChange={(e) =>
                        updateCondition(condition.id, { port: parseInt(e.target.value) || undefined })
                      }
                      placeholder="80"
                      className="px-2 py-1 text-sm border border-slate-300 rounded w-20"
                    />
                    <span className="text-slate-500">-</span>
                    <input
                      type="number"
                      value={condition.portEnd || ''}
                      onChange={(e) =>
                        updateCondition(condition.id, { portEnd: parseInt(e.target.value) || undefined })
                      }
                      placeholder="443"
                      className="px-2 py-1 text-sm border border-slate-300 rounded w-20"
                    />
                  </>
                )}

                <button
                  onClick={() => removeCondition(condition.id)}
                  className="p-1 text-slate-400 hover:text-danger-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={addCondition}
            className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
          >
            <Plus className="w-4 h-4" />
            Add Condition
          </button>
        </div>
      )}

      {filterString && (
        <div className="p-2 bg-slate-100 rounded font-mono text-sm text-slate-700">
          Filter: <span className="text-primary-600">{filterString}</span>
        </div>
      )}
    </div>
  );
}
