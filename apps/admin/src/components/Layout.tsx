/**
 * GTX Rush — Admin Command Center Layout
 *
 * Provides the main layout with sidebar navigation, header, and content area.
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getAdminToken, adminLogout } from '../lib/api';

// ============================================================
// Navigation Items
// ============================================================

interface NavItem {
  label: string;
  path: string;
  icon: string;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: '📊', section: 'OVERVIEW' },
  { label: 'Users', path: '/users', icon: '👥', section: 'OPERATIONS' },
  { label: 'Games', path: '/games', icon: '🎮', section: 'OPERATIONS' },
  { label: 'Events', path: '/events', icon: '🏆', section: 'OPERATIONS' },
  { label: 'Leaderboards', path: '/leaderboards', icon: '🥇', section: 'OPERATIONS' },
  { label: 'Fraud Center', path: '/fraud', icon: '🚨', section: 'TRUST & SAFETY' },
  { label: 'Moderation', path: '/moderation', icon: '🛡', section: 'TRUST & SAFETY' },
  { label: 'Economy', path: '/economy', icon: '💰', section: 'FINANCE' },
  { label: 'Payments', path: '/payments', icon: '💳', section: 'FINANCE' },
  { label: 'Analytics', path: '/analytics', icon: '📈', section: 'INSIGHTS' },
  { label: 'Experiments', path: '/experiments', icon: '🧪', section: 'INSIGHTS' },
  { label: 'Feature Flags', path: '/features', icon: '🚩', section: 'INSIGHTS' },
  { label: '🤖 AI Center', path: '/ai-center', icon: '🤖', section: 'AI INTELLIGENCE' },
  { label: 'Emergency', path: '/emergency', icon: '⚡', section: 'SYSTEM' },
  { label: 'Alerts', path: '/alerts', icon: '🔔', section: 'SYSTEM' },
  { label: 'Audit Log', path: '/audit', icon: '📋', section: 'SYSTEM' },
];

// ============================================================
// Layout Component
// ============================================================

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    try {
      await adminLogout();
    } catch {
      // Ignore errors
    }
    navigate('/login');
  };

  const token = getAdminToken();

  // Group nav items by section
  const sections = NAV_ITEMS.reduce<Record<string, NavItem[]>>((acc, item) => {
    const section = item.section ?? 'OTHER';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-200`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-400 hover:text-white"
            >
              {sidebarOpen ? '☰' : '☰'}
            </button>
            {sidebarOpen && (
              <div>
                <div className="font-bold text-white text-sm">GTX RUSH</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Command Center</div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2">
          {Object.entries(sections).map(([section, items]) => (
            <div key={section} className="mb-2">
              {sidebarOpen && (
                <div className="px-4 py-1 text-[10px] text-gray-600 uppercase tracking-wider font-semibold">
                  {section}
                </div>
              )}
              {items.map((item) => {
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                      isActive
                        ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-400'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                    title={item.label}
                  >
                    <span className="text-base">{item.icon}</span>
                    {sidebarOpen && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Logout */}
        {token && (
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-red-400 rounded-lg transition-colors"
            >
              <span>🚪</span>
              {sidebarOpen && <span>Logout</span>}
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-white">GTX RUSH COMMAND CENTER</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">
              {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
