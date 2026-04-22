import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, MapPin, Fuel, History, User, Zap, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { clsx } from '../../utils/clsx';

const CUSTOMER_NAV = [
  { to: '/dashboard', label: 'Home',     icon: <LayoutDashboard className="w-5 h-5" /> },
  { to: '/stations',  label: 'Stations', icon: <MapPin  className="w-5 h-5" /> },
  { to: '/pump',      label: 'Pay',      icon: <Fuel    className="w-5 h-5" /> },
  { to: '/history',   label: 'History',  icon: <History className="w-5 h-5" /> },
  { to: '/profile',   label: 'Profile',  icon: <User    className="w-5 h-5" /> },
];

const EMPLOYEE_NAV = [
  { to: '/employee',  label: 'Station',  icon: <Zap     className="w-5 h-5" /> },
  { to: '/profile',   label: 'Profile',  icon: <User    className="w-5 h-5" /> },
];

const ADMIN_NAV = [
  { to: '/admin',     label: 'Admin',    icon: <Users   className="w-5 h-5" /> },
  { to: '/profile',   label: 'Profile',  icon: <User    className="w-5 h-5" /> },
];

export function BottomNav() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const nav = user?.role === 'employee' ? EMPLOYEE_NAV
            : user?.role === 'admin'    ? ADMIN_NAV
            : CUSTOMER_NAV;

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-surface-dark border-t border-border dark:border-white/10 flex z-30 no-print">
      {nav.map(n => (
        <Link
          key={n.to}
          to={n.to}
          className={clsx(
            'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors',
            pathname.startsWith(n.to)
              ? 'text-primary dark:text-blue-300 font-medium'
              : 'text-gray-500 dark:text-gray-400',
          )}
        >
          {n.icon}
          <span>{n.label}</span>
        </Link>
      ))}
    </nav>
  );
}
