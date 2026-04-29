export default function MetricCard({ title, value, trend, variant = 'default' }) {
  const isDanger = variant === 'danger';
  const isSuccess = variant === 'success';

  const trendPositive = isSuccess ? trend < 0 : trend > 0;
  const trendNegative = isSuccess ? trend > 0 : trend < 0;

  return (
    <div className={`rounded-lg p-5 shadow-sm border ${isDanger ? 'bg-red-600 border-red-700 text-white' : 'bg-white border-gray-200'}`}>
      <p className={`text-sm font-medium mb-1 ${isDanger ? 'text-red-100' : 'text-gray-500'}`}>
        {title}
      </p>
      <p className={`text-4xl font-bold mb-2 ${isDanger ? 'text-white' : 'text-gray-900'}`}>
        {value}
      </p>
      {trend !== undefined && (
        <div className={`flex items-center text-xs font-medium ${isDanger ? 'text-red-100' : ''}`}>
          {trend > 0 && (
            <span className={isDanger ? 'text-red-200' : trendPositive ? 'text-red-500' : 'text-green-500'}>
              ↑ {Math.abs(trend)}% vs yesterday
            </span>
          )}
          {trend < 0 && (
            <span className={isDanger ? 'text-red-200' : trendNegative ? 'text-green-500' : 'text-red-500'}>
              ↓ {Math.abs(trend)}% vs yesterday
            </span>
          )}
          {trend === 0 && (
            <span className={isDanger ? 'text-red-200' : 'text-gray-400'}>
              No change vs yesterday
            </span>
          )}
        </div>
      )}
    </div>
  );
}
