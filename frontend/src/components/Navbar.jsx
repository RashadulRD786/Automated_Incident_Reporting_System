import { NavLink, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: '▦' },
  { path: '/upload',    label: 'Upload',    icon: '↑' },
  { path: '/incidents', label: 'Incidents', icon: '☰' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

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
