import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/games', label: 'Games', icon: '🎮' },
  { path: '/leaderboard', label: 'Rank', icon: '🏆' },
  { path: '/rewards', label: 'Rewards', icon: '🎁' },
  { path: '/profile', label: 'Profile', icon: '👤' },
];

export function Navigation() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-base/95 backdrop-blur-xl border-t border-surface-border/50"
         style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="max-w-lg mx-auto flex items-center justify-around h-16">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-fast ${
                isActive
                  ? 'text-accent-400 bg-accent-500/10'
                  : 'text-txt-tertiary hover:text-txt-secondary'
              }`
            }
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="text-[10px] font-semibold leading-none">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
