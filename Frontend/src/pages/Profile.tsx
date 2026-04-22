import { Camera, Eye, EyeOff, Lock, Mail, Phone, User as UserIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { authApi, uploadApi } from '../api/api';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { User } from '../types';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({ name: user.name, email: user.email, phone: user.phone ?? '' });
    }
  }, [user]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadApi.avatar(file);
      updateUser({ ...user!, avatar_url: res.url });
      toast('success', 'Avatar updated');
    } catch { toast('error', 'Upload failed'); }
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await authApi.updateMe(form);
      if (updated) updateUser({ ...user!, ...(updated as Partial<User>), name: form.name, email: form.email, phone: form.phone });
      toast('success', 'Profile updated');
    } catch (err: unknown) {
      toast('error', (err as Error).message || 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { toast('error', "Passwords don't match"); return; }
    setPwSaving(true);
    try {
      await authApi.changePassword(pwForm.current, pwForm.next);
      toast('success', 'Password changed');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err: unknown) {
      toast('error', (err as Error).message || 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <h1 className="page-title">My Profile</h1>

      {/* Avatar */}
      <Card className="flex items-center gap-5">
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary dark:text-blue-300 text-3xl font-bold overflow-hidden">
            {user.avatar_url
              ? <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
              : (user.name?.[0] ?? '?').toUpperCase()
            }
          </div>
          <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center cursor-pointer shadow-md hover:bg-primary-light transition-colors">
            <Camera className="w-3.5 h-3.5 text-white" />
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </label>
        </div>
        <div>
          <h2 className="font-heading font-semibold text-gray-900 dark:text-white text-lg">{user.name}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={user.role === 'admin' ? 'danger' : user.role === 'employee' ? 'accent' : 'primary'}>
              {user.role}
            </Badge>
            {user.loyalty_tier && (
              <Badge variant="warning">{user.loyalty_tier}</Badge>
            )}
            {user.is_verified && <Badge variant="success">Verified</Badge>}
          </div>
        </div>
      </Card>

      {/* Profile form */}
      <Card>
        <h2 className="section-title flex items-center gap-2"><UserIcon className="w-4 h-4" /> Personal Info</h2>
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label htmlFor="prof-name" className="label">Full name</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input id="prof-name" name="name" type="text" required autoComplete="name" className="input pl-9" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label htmlFor="prof-email" className="label">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input id="prof-email" name="email" type="email" required autoComplete="email" className="input pl-9" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div>
            <label htmlFor="prof-phone" className="label">Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input id="prof-phone" name="phone" type="tel" autoComplete="tel" className="input pl-9" placeholder="+266 5x xx xxxx" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </Card>

      {/* Password */}
      <Card>
        <h2 className="section-title flex items-center gap-2"><Lock className="w-4 h-4" /> Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label htmlFor="pw-current" className="label">Current password</label>
            <input id="pw-current" name="current_password" type="password" required autoComplete="current-password" className="input" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="pw-new" className="label">New password</label>
            <div className="relative">
              <input id="pw-new" name="new_password" type={showPw ? 'text' : 'password'} required autoComplete="new-password" className="input pr-10" value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} />
              <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="pw-confirm" className="label">Confirm new password</label>
            <input id="pw-confirm" name="confirm_password" type="password" required autoComplete="new-password" className="input" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
          </div>
          <button type="submit" className="btn-outline w-full" disabled={pwSaving}>
            {pwSaving ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </Card>
    </div>
  );
}
