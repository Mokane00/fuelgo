import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/stations': 'Find Stations',
  '/pump': 'Pay for Fuel',
  '/vehicles': 'My Vehicles',
  '/history': 'Transaction History',
  '/loyalty': 'Loyalty Rewards',
  '/profile': 'Profile',
  '/receipt': 'Receipt',
  '/employee': 'My Station',
  '/admin': 'Admin Panel',
  '/analytics': 'Analytics',
  '/reports': 'Reports',
};

interface AppLayoutProps { children: React.ReactNode }

export function AppLayout({ children }: AppLayoutProps) {
  const { pathname } = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('fg_dark');
    if (saved !== null) return saved === '1';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('fg_dark', darkMode ? '1' : '0');
  }, [darkMode]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  const title = PAGE_TITLES[pathname] ?? 'FuelGO';

  return (
    <div className="flex h-full min-h-screen bg-surface-alt dark:bg-bg">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col flex-shrink-0 no-print">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex animate-fade-in no-print">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative z-10 animate-slide-up">
            <Sidebar mobile onClose={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar
          title={title}
          onMenuClick={() => setMobileSidebarOpen(true)}
          darkMode={darkMode}
          onToggleDark={() => setDarkMode(d => !d)}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 lg:pb-6 animate-fade-in">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
