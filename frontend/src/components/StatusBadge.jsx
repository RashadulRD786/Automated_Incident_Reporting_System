const STATUS_STYLES = {
  'New':         'bg-gray-100 text-gray-800',
  'Assigned':    'bg-blue-100 text-blue-800',
  'In Progress': 'bg-purple-100 text-purple-800',
  'Pending':     'bg-amber-100 text-amber-800',
  'Resolved':    'bg-teal-100 text-teal-800',
  'Closed':      'bg-gray-300 text-gray-700',
  'Cancelled':   'bg-red-50 text-red-400',
};

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}
