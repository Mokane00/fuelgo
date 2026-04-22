import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Fuel, User, Mail, Lock, Phone, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { authApi } from '../api/api';

function validate(pw: string): string | null {
  if (pw.length < 8)             return 'At least 8 characters';
  if (!/[A-Z]/.test(pw))         return 'Include an uppercase letter';
  if (!/[0-9]/.test(pw))         return 'Include a number';
  if (!/[^A-Za-z0-9]/.test(pw))  return 'Include a special character';
  return null;
}

export default function Register() {
  const toast = useToast();
  const [form, setForm]   = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const pwError    = form.password ? validate(form.password) : null;
  const matchError = form.confirm && form.confirm !== form.password ? "Passwords don't match" : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwError || matchError) return;
    setLoading(true);
    try {
      const res = await authApi.register({
        name:     form.name,
        email:    form.email,
        password: form.password,
        phone:    form.phone || undefined,
      });
      localStorage.setItem('fg_token', res.token);
      window.location.href = '/dashboard';
    } catch (err: unknown) {
      toast('error', (err as Error).message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-dark via-primary to-primary-light p-4">
      <div className="w-full max-w-md animate-scale-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center mb-3">
            <Fuel className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-white">Create account</h1>
          <p className="text-blue-200 text-sm mt-1">Start paying for fuel digitally</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reg-name" className="label">Full name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input id="reg-name" name="name" type="text" required autoComplete="name" className="input pl-9" placeholder="John Doe" value={form.name} onChange={set('name')} />
              </div>
            </div>

            <div>
              <label htmlFor="reg-email" className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input id="reg-email" name="email" type="email" required autoComplete="email" className="input pl-9" placeholder="you@example.com" value={form.email} onChange={set('email')} />
              </div>
            </div>

            <div>
              <label htmlFor="reg-phone" className="label">Phone (optional)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input id="reg-phone" name="phone" type="tel" autoComplete="tel" className="input pl-9" placeholder="+266 5x xx xxxx" value={form.phone} onChange={set('phone')} />
              </div>
            </div>

            <div>
              <label htmlFor="reg-password" className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input id="reg-password" name="password" type={showPw ? 'text' : 'password'} required autoComplete="new-password" className="input pl-9 pr-10" placeholder="••••••••" value={form.password} onChange={set('password')} />
                <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwError && <p className="text-xs text-danger mt-1">{pwError}</p>}
            </div>

            <div>
              <label htmlFor="reg-confirm" className="label">Confirm password</label>
              <input id="reg-confirm" name="confirm" type="password" required autoComplete="new-password" className="input" placeholder="••••••••" value={form.confirm} onChange={set('confirm')} />
              {matchError && <p className="text-xs text-danger mt-1">{matchError}</p>}
            </div>

            <button type="submit" className="btn-primary w-full btn-lg" disabled={loading || !!pwError || !!matchError}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-primary dark:text-blue-300 hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
