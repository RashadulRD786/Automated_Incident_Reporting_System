const SEVERITY_STYLES = {
  Critical: 'bg-red-100 text-red-800',
  High:     'bg-orange-100 text-orange-800',
  Medium:   'bg-yellow-100 text-yellow-800',
  Low:      'bg-green-100 text-green-800',
};

export default function SeverityBadge({ severity }) {
  const style = SEVERITY_STYLES[severity] || 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${style}`}>
      {severity}
    </span>
  );
}
