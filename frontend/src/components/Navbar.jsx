import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import api from '../utils/api';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: '▦' },
  { path: '/upload',    label: 'Upload',    icon: '↑' },
  { path: '/incidents', label: 'Incidents', icon: '☰' },
  { path: '/reports',   label: 'Reports',   icon: '▤' },
];

const BORDER_COLOR = {
  BREACHED: 'border-l-red-500',
  CRITICAL: 'border-l-orange-500',
  AT_RISK:  'border-l-yellow-500',
};

function timeAgo(unixTs) {
  const diff = Math.floor(Date.now() / 1000) - unixTs;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Navbar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [open, setOpen]                   = useState(false);
  const dropdownRef                       = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unread_count ?? 0);
    } catch {
      // silently ignore — bell just stays at 0
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleMarkAllRead() {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  }

  async function handleNotificationClick(n) {
    if (!n.is_read) {
      try {
        await api.patch(`/notifications/${n.id}/read`);
        setNotifications(prev =>
          prev.map(x => x.id === n.id ? { ...x, is_read: 1 } : x)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch { /* ignore */ }
    }
    setOpen(false);
    if (n.incident_id) navigate(`/incidents/${n.incident_id}`);
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-[#FFCC00] flex flex-col z-30">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-[#e6b800]">
        <div className="flex items-center gap-2">
          <div className="bg-dhl-red px-2 py-1 rounded">
            <span className="text-white font-black text-lg tracking-tight">DHL</span>
          </div>
          <div>
            <p className="text-gray-900 text-xs font-semibold leading-tight">Incident</p>
            <p className="text-gray-700 text-xs leading-tight">Management</p>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ path, label, icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-dhl-red text-white'
                  : 'text-gray-800 hover:bg-[#e6b800] hover:text-gray-900'
              }`
            }
          >
            <span className="text-base">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Notification Bell */}
      <div className="px-3 pb-2 relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen(prev => !prev)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-gray-800 hover:bg-[#e6b800] transition-colors"
        >
          <span className="relative text-base">
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-dhl-red text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5 leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </span>
          <span>Notifications</span>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute left-full bottom-0 ml-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
            {/* Dropdown header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 bg-dhl-red text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-dhl-red hover:underline font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">
                  No new notifications
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 border-l-4 transition-colors ${
                      BORDER_COLOR[n.sla_state] || 'border-l-gray-200'
                    } ${!n.is_read ? 'bg-amber-50/50' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      {n.incident_ref && (
                        <p className="text-xs font-bold text-gray-900 font-mono">
                          {n.incident_ref}
                        </p>
                      )}
                      <p className="text-xs text-gray-700 mt-0.5 leading-snug">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-dhl-red shrink-0 mt-1.5" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-[#e6b800]">
        <div className="flex items-center gap-2 mb-3 px-2">
          <div className="w-8 h-8 rounded-full bg-dhl-red flex items-center justify-center text-white text-sm font-bold">
            {user.name?.charAt(0) || 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-gray-900 text-xs font-semibold truncate">{user.name || 'User'}</p>
            <p className="text-gray-700 text-xs truncate">{user.email || ''}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full text-left text-gray-700 hover:text-gray-900 text-xs px-2 py-1.5 rounded hover:bg-[#e6b800] transition-colors"
        >
          → Sign Out
        </button>
      </div>
    </aside>
  );
}
