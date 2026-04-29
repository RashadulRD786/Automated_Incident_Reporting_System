import { useState, useEffect } from 'react';

function formatRemaining(seconds) {
  if (seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function SLATimer({ sla_deadline, is_overdue, sla_hours }) {
  const [remaining, setRemaining] = useState(
    sla_deadline - Math.floor(Date.now() / 1000)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(sla_deadline - Math.floor(Date.now() / 1000));
    }, 60000);
    return () => clearInterval(interval);
  }, [sla_deadline]);

  if (is_overdue || remaining <= 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-300">
        OVERDUE
      </span>
    );
  }

  const totalSeconds = (sla_hours || 48) * 3600;
  const pct = (remaining / totalSeconds) * 100;

  let colorClass = 'text-green-600';
  if (pct < 20) colorClass = 'text-red-600 font-semibold';
  else if (pct < 50) colorClass = 'text-amber-600';

  return (
    <span className={`text-sm font-mono ${colorClass}`}>
      {formatRemaining(remaining) || '0h 0m'}
    </span>
  );
}
