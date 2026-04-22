import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';

// Pages (lazy-loaded for perf)
import { lazy, Suspense } from 'react';

const Login     = lazy(() => import('./pages/Login'));
const Register  = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Stations  = lazy(() => import('./pages/Stations'));
const Pump      = lazy(() => import('./pages/Pump'));
const Vehicles  = lazy(() => import('./pages/Vehicles'));
const History   = lazy(() => import('./pages/History'));
const Loyalty   = lazy(() => import('./pages/Loyalty'));
const Profile   = lazy(() => import('./pages/Profile'));
const Receipt   = lazy(() => import('./pages/Receipt'));
const Employee  = lazy(() => import('./pages/Employee'));
const Admin     = lazy(() => import('./pages/Admin'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Reports   = lazy(() => import('./pages/Reports'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full py-20">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function CatchAll() {
  const { user } = useAuth();
  return <Navigate to={roleHome(user?.role)} replace />;
}

function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function roleHome(role?: string) {
  if (role === 'admin')    return '/admin';
  if (role === 'employee') return '/employee';
  return '/dashboard';
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (user) return <Navigate to={roleHome(user.role)} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login"    element={<RequireGuest><Login /></RequireGuest>} />
        <Route path="/register" element={<RequireGuest><Register /></RequireGuest>} />

        {/* Protected routes inside app shell */}
        <Route path="/" element={<RequireAuth><AppLayout><Dashboard /></AppLayout></RequireAuth>} />
        <Route path="/dashboard"  element={<RequireAuth><AppLayout><Dashboard /></AppLayout></RequireAuth>} />
        <Route path="/stations"   element={<RequireAuth><AppLayout><Stations /></AppLayout></RequireAuth>} />
        <Route path="/pump"       element={<RequireAuth><AppLayout><Pump /></AppLayout></RequireAuth>} />
        <Route path="/vehicles"   element={<RequireAuth><AppLayout><Vehicles /></AppLayout></RequireAuth>} />
        <Route path="/history"    element={<RequireAuth><AppLayout><History /></AppLayout></RequireAuth>} />
        <Route path="/loyalty"    element={<RequireAuth><AppLayout><Loyalty /></AppLayout></RequireAuth>} />
        <Route path="/profile"    element={<RequireAuth><AppLayout><Profile /></AppLayout></RequireAuth>} />
        <Route path="/receipt"    element={<RequireAuth><AppLayout><Receipt /></AppLayout></RequireAuth>} />

        {/* Employee routes */}
        <Route path="/employee" element={
          <RequireAuth roles={['employee', 'admin']}>
            <AppLayout><Employee /></AppLayout>
          </RequireAuth>
        } />

        {/* Admin routes */}
        <Route path="/admin" element={
          <RequireAuth roles={['admin']}>
            <AppLayout><Admin /></AppLayout>
          </RequireAuth>
        } />
        <Route path="/analytics" element={
          <RequireAuth roles={['admin']}>
            <AppLayout><Analytics /></AppLayout>
          </RequireAuth>
        } />
        <Route path="/reports" element={
          <RequireAuth roles={['admin']}>
            <AppLayout><Reports /></AppLayout>
          </RequireAuth>
        } />

        {/* Catch-all */}
        <Route path="*" element={<CatchAll />} />
      </Routes>
    </Suspense>
  );
}
