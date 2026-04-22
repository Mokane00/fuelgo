import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, MapPin, Fuel, Car, History,
  Gift, User, BarChart3, FileText, Users, X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { clsx } from '../../utils/clsx';

interface NavItem { to: string; label: string; icon: React.ReactNode; roles?: string[] }

const NAV: NavItem[] = [
  // Customer
  { to: '/dashboard',  label: 'Dashboard',    icon: <LayoutDashboard className="w-5 h-5" />, roles: ['customer'] },
  { to: '/stations',   label: 'Stations',     icon: <MapPin className="w-5 h-5" />,          roles: ['customer'] },
  { to: '/pump',       label: 'Pay for Fuel', icon: <Fuel className="w-5 h-5" />,            roles: ['customer'] },
  { to: '/vehicles',   label: 'My Vehicles',  icon: <Car className="w-5 h-5" />,             roles: ['customer'] },
  { to: '/history',    label: 'History',      icon: <History className="w-5 h-5" />,         roles: ['customer'] },
  { to: '/loyalty',    label: 'Loyalty',      icon: <Gift className="w-5 h-5" />,            roles: ['customer'] },
  // Employee
  { to: '/employee',   label: 'My Station',   icon: <Zap className="w-5 h-5" />,            roles: ['employee'] },
  // Admin
  { to: '/admin',      label: 'Admin',        icon: <Users className="w-5 h-5" />,           roles: ['admin'] },
  { to: '/analytics',  label: 'Analytics',    icon: <BarChart3 className="w-5 h-5" />,       roles: ['admin'] },
  { to: '/reports',    label: 'Reports',      icon: <FileText className="w-5 h-5" />,        roles: ['admin'] },
  // Shared — visible to all roles
  { to: '/profile',    label: 'Profile',      icon: <User className="w-5 h-5" /> },
];

interface SidebarProps { mobile?: boolean; onClose?: () => void }

export function Sidebar({ mobile, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  const filtered = NAV.filter(n => !n.roles || (user && n.roles.includes(user.role)));

  return (
    <aside className={clsx(
      'flex flex-col h-full bg-white dark:bg-surface-dark border-r border-border dark:border-white/10',
      mobile ? 'w-72' : 'w-60',
    )}>
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-sm bg-gradient-primary flex items-center justify-center">
            <Fuel className="w-4 h-4 text-white" />
          </div>
          <span className="font-heading font-bold text-primary dark:text-white text-lg">FuelGO</span>
        </div>
        {mobile && onClose && (
          <button onClick={onClose} className="btn-ghost p-1 rounded-sm">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {filtered.map(n => (
          <Link
            key={n.to}
            to={n.to}
            onClick={onClose}
            className={clsx('sidebar-link', pathname.startsWith(n.to) && 'active')}
          >
            {n.icon}
            {n.label}
          </Link>
        ))}
      </nav>

      {/* User footer */}
      {user && (
        <div className="px-3 py-4 border-t border-border dark:border-white/10">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary dark:text-blue-300 text-sm font-semibold overflow-hidden flex-shrink-0">
              {user.avatar_url
                ? <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                : (user.name?.[0] ?? '?').toUpperCase()
              }
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate capitalize">{user.role}</p>
            </div>
          </div>
          <button onClick={logout} className="btn-outline w-full btn-sm">
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
