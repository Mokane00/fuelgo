import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Fuel, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authApi } from '../api/api';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotPw, setForgotPw] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'code'>('email');
  const [forgotLoading, setForgotLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err: unknown) {
      toast('error', (err as Error).message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotSend() {
    setForgotLoading(true);
    try {
      await authApi.forgotPassword(forgotEmail);
      toast('success', 'Reset code sent — check your email');
      setForgotStep('code');
    } catch (err: unknown) {
      toast('error', (err as Error).message || 'Failed to send code');
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleForgotReset() {
    setForgotLoading(true);
    try {
      await authApi.resetPassword(forgotEmail, forgotCode, forgotPw);
      toast('success', 'Password reset — please log in');
      setForgotOpen(false);
      setForgotStep('email');
    } catch (err: unknown) {
      toast('error', (err as Error).message || 'Reset failed');
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-dark via-primary to-primary-light p-4">
      <div className="w-full max-w-md animate-scale-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center mb-3">
            <Fuel className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-white">FuelGO</h1>
          <p className="text-blue-200 text-sm mt-1">Digital fuel payments for Lesotho</p>
        </div>

        <div className="card">
          <h2 className="text-xl font-heading font-semibold text-gray-900 dark:text-white mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email" required
                  id="email" name="email"
                  autoComplete="email"
                  className="input pl-9"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPw ? 'text' : 'password'} required
                  id="password" name="password"
                  autoComplete="current-password"
                  className="input pl-9 pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
                <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" onClick={() => setForgotOpen(true)} className="text-xs text-primary dark:text-blue-300 hover:underline">
                Forgot password?
              </button>
            </div>

            <button type="submit" className="btn-primary w-full btn-lg" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-4 relative flex items-center gap-3">
            <div className="flex-1 h-px bg-border dark:bg-white/10" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-border dark:bg-white/10" />
          </div>

          <a href="/api/auth/google" className="btn-outline w-full mt-4 flex items-center justify-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </a>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-5">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary dark:text-blue-300 hover:underline font-medium">Sign up</Link>
          </p>
        </div>
      </div>

      {/* Forgot password modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/50" onClick={() => setForgotOpen(false)} />
          <div className="relative card w-full max-w-sm animate-scale-in">
            <h3 className="font-heading font-semibold text-gray-900 dark:text-white mb-4">Reset Password</h3>
            {forgotStep === 'email' ? (
              <div className="space-y-4">
                <input type="email" className="input" placeholder="Your email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} />
                <button className="btn-primary w-full" onClick={handleForgotSend} disabled={forgotLoading}>
                  {forgotLoading ? 'Sending…' : 'Send Code'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <input type="text" className="input" placeholder="6-digit code" value={forgotCode} onChange={e => setForgotCode(e.target.value)} maxLength={6} />
                <input type="password" className="input" placeholder="New password" value={forgotPw} onChange={e => setForgotPw(e.target.value)} />
                <button className="btn-primary w-full" onClick={handleForgotReset} disabled={forgotLoading}>
                  {forgotLoading ? 'Resetting…' : 'Reset Password'}
                </button>
              </div>
            )}
            <button onClick={() => setForgotOpen(false)} className="btn-ghost w-full mt-2 btn-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
