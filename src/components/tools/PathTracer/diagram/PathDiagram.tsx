import { useState, useMemo, useEffect } from 'react';
import { DeviceHop } from '../types';
import PathNode from './PathNode';
import PathConnector from './PathConnector';
import HopDetailPanel from './HopDetailPanel';

interface PathDiagramProps {
  hops: DeviceHop[];
  totalPathMs: number;
}

export default function PathDiagram({ hops, totalPathMs }: PathDiagramProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Clamp selectedIndex when hops array changes length
  useEffect(() => {
    if (selectedIndex >= hops.length && hops.length > 0) {
      setSelectedIndex(hops.length - 1);
    }
  }, [hops.length, selectedIndex]);

  const safeIndex = Math.min(selectedIndex, hops.length - 1);
  const selectedHop = hops[safeIndex];

  // Pre-compute cumulative latencies
  const cumulativeMs = useMemo(() => {
    const result: number[] = [];
    let sum = 0;
    for (const hop of hops) {
      sum += hop.lookup_time_ms;
      result.push(sum);
    }
    return result;
  }, [hops]);

  if (hops.length === 0) return null;

  return (
    <div className="flex gap-6">
      {/* Left column: Path view */}
      <div className="w-[340px] flex-shrink-0 space-y-0">
        {hops.map((hop, index) => (
          <div key={hop.sequence}>
            <PathNode
              hop={hop}
              isSelected={index === safeIndex}
              onClick={() => setSelectedIndex(index)}
            />
            {index < hops.length - 1 && (
              <PathConnector fromHop={hop} toHop={hops[index + 1]} />
            )}
          </div>
        ))}
      </div>

      {/* Right column: Detail panel */}
      <div className="flex-1 min-w-0">
        <div className="sticky top-4">
          {selectedHop && (
            <HopDetailPanel
              key={selectedHop.sequence}
              hop={selectedHop}
              cumulativeMs={cumulativeMs[safeIndex]}
              totalPathMs={totalPathMs}
            />
          )}
        </div>
      </div>
    </div>
  );
}
