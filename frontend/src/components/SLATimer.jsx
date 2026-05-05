import { useState, useEffect } from 'react';

function formatRemaining(seconds) {
  if (seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function SLATimer({ sla_deadline, sla_state, is_overdue }) {
  const [remaining, setRemaining] = useState(
    sla_deadline - Math.floor(Date.now() / 1000)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(sla_deadline - Math.floor(Date.now() / 1000));
    }, 60000);
    return () => clearInterval(interval);
  }, [sla_deadline]);

  const state = sla_state || (is_overdue ? 'BREACHED' : 'ON_TRACK');

  if (state === 'COMPLETED') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
        Resolved
      </span>
    );
  }

  if (state === 'BREACHED' || remaining <= 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-300">
        OVERDUE
      </span>
    );
  }

  const colorClass =
    state === 'CRITICAL' ? 'text-red-600 font-semibold' :
    state === 'AT_RISK'  ? 'text-amber-600' :
    'text-green-600';

  return (
    <span className={`text-sm font-mono ${colorClass}`}>
      {formatRemaining(remaining) || '0h 0m'}
    </span>
  );
}
