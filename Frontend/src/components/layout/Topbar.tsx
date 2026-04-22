import { Menu, Moon, Sun, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface TopbarProps {
  title: string;
  onMenuClick: () => void;
  darkMode: boolean;
  onToggleDark: () => void;
}

export function Topbar({ title, onMenuClick, darkMode, onToggleDark }: TopbarProps) {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white dark:bg-surface-dark border-b border-border dark:border-white/10 flex items-center px-4 gap-4 flex-shrink-0 no-print">
      {/* Mobile menu button */}
      <button onClick={onMenuClick} className="btn-ghost p-2 rounded-sm lg:hidden">
        <Menu className="w-5 h-5" />
      </button>

      <h1 className="font-heading font-semibold text-gray-900 dark:text-white text-base flex-1 truncate">{title}</h1>

      <div className="flex items-center gap-2">
        {/* Dark mode toggle */}
        <button
          onClick={onToggleDark}
          className="btn-ghost p-2 rounded-sm"
          aria-label={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications placeholder */}
        <button className="btn-ghost p-2 rounded-sm relative" aria-label="Notifications">
          <Bell className="w-4 h-4" />
        </button>

        {/* Avatar */}
        {user && (
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary dark:text-blue-300 text-sm font-semibold overflow-hidden">
            {user.avatar_url
              ? <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
              : (user.name?.[0] ?? '?').toUpperCase()
            }
          </div>
        )}
      </div>
    </header>
  );
}
