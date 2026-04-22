import { useEffect, useState, useCallback } from 'react';
import { Users, MapPin, BarChart3, Shield, Trash2, Edit3, Plus, Search, ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi } from '../api/api';
import type { AuditLog } from '../api/api';
import { useToast } from '../context/ToastContext';
import { StatCard } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import type { AdminOverview, Station, User } from '../types';

type Tab = 'overview' | 'users' | 'stations' | 'audit';

interface AdminUser extends User {
  is_active: boolean;
  created_at: string;
  station_id?: number | null;
  station_name?: string | null;
}

interface UserForm {
  id?: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  is_active: boolean;
  password: string;
  station_id: number | null;
}

const emptyUserForm = (): UserForm => ({
  name: '', email: '', phone: '', role: 'customer', is_active: true, password: '', station_id: null,
});

export default function Admin() {
  const toast = useToast();
  const [tab, setTab]           = useState<Tab>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers]       = useState<AdminUser[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  const [userForm, setUserForm]       = useState<UserForm | null>(null);
  const [editStation, setEditStation] = useState<Partial<Station> | null>(null);
  const [stationModalOpen, setStationModal] = useState(false);
  const [saving, setSaving]           = useState(false);

  // Audit state
  const [auditLogs, setAuditLogs]       = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal]     = useState(0);
  const [auditActions, setAuditActions] = useState<string[]>([]);
  const [auditPage, setAuditPage]       = useState(1);
  const [auditSearch, setAuditSearch]   = useState('');
  const [auditAction, setAuditAction]   = useState('');
  const [auditFrom, setAuditFrom]       = useState('');
  const [auditTo, setAuditTo]           = useState('');
  const AUDIT_LIMIT = 50;

  const loadAudit = useCallback(async (page = auditPage) => {
    setLoading(true);
    try {
      const res = await adminApi.auditLogs({ page, limit: AUDIT_LIMIT, action: auditAction, search: auditSearch, from: auditFrom, to: auditTo });
      setAuditLogs(res.logs);
      setAuditTotal(res.total);
      if (res.actions.length) setAuditActions(res.actions);
    } catch { toast('error', 'Failed to load audit logs'); }
    finally { setLoading(false); }
  }, [auditPage, auditAction, auditSearch, auditFrom, auditTo, toast]); // eslint-disable-line

  // Load stations once on mount so the station dropdown is always available
  useEffect(() => {
    adminApi.stations().then(setStations).catch(() => {});
  }, []);

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    try {
      if (t === 'overview') {
        setOverview(await adminApi.overview());
      } else if (t === 'users') {
        const res = await adminApi.users({ search }) as { users: AdminUser[] };
        setUsers(res.users ?? []);
      } else if (t === 'stations') {
        setStations(await adminApi.stations());
      } else if (t === 'audit') {
        await loadAudit(1);
        return;
      }
    } catch { toast('error', `Failed to load ${t}`); }
    finally { setLoading(false); }
  }, [search, toast, loadAudit]);

  useEffect(() => { load(tab); }, [tab]); // eslint-disable-line

  // ── Users ──────────────────────────────────────────────────────────────────
  function openCreateUser() {
    setUserForm(emptyUserForm());
  }

  function openEditUser(u: AdminUser) {
    setUserForm({ id: u.id, name: u.name, email: u.email, phone: u.phone ?? '', role: u.role, is_active: u.is_active, password: '', station_id: u.station_id ?? null });
  }

  async function saveUser() {
    if (!userForm) return;
    setSaving(true);
    try {
      if (userForm.id) {
        await adminApi.updateUser(userForm.id, {
          full_name: userForm.name,
          email: userForm.email,
          phone: userForm.phone || undefined,
          role: userForm.role,
          is_active: userForm.is_active,
          station_id: userForm.station_id,
        });
        const assignedStation = stations.find(s => s.id === userForm.station_id);
        setUsers(us => us.map(u => u.id === userForm.id
          ? { ...u, name: userForm.name, email: userForm.email, phone: userForm.phone, role: userForm.role as User['role'], is_active: userForm.is_active, station_id: userForm.station_id, station_name: assignedStation?.name ?? null }
          : u));
        toast('success', 'User updated');
      } else {
        if (!userForm.password) { toast('error', 'Password is required'); setSaving(false); return; }
        await adminApi.createUser({ full_name: userForm.name, email: userForm.email, phone: userForm.phone || undefined, role: userForm.role, password: userForm.password, station_id: userForm.station_id });
        await load('users');
        toast('success', 'User created');
      }
      setUserForm(null);
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Failed');
    }
    finally { setSaving(false); }
  }

  async function deleteUser(id: number) {
    if (!confirm('Delete user? This cannot be undone.')) return;
    try {
      await adminApi.deleteUser(id);
      setUsers(us => us.filter(u => u.id !== id));
      toast('success', 'User deleted');
    } catch (e: unknown) { toast('error', e instanceof Error ? e.message : 'Failed'); }
  }

  // ── Stations ───────────────────────────────────────────────────────────────
  async function saveStation() {
    if (!editStation) return;
    setSaving(true);
    try {
      if (editStation.id) {
        await adminApi.updateStation(editStation.id, editStation);
        setStations(ss => ss.map(s => s.id === editStation.id ? { ...s, ...editStation } as Station : s));
      } else {
        await adminApi.createStation(editStation);
        setStations(await adminApi.stations());
      }
      toast('success', 'Station saved');
      setStationModal(false);
    } catch { toast('error', 'Failed'); }
    finally { setSaving(false); }
  }

  async function deleteStation(id: number) {
    if (!confirm('Delete station? This cannot be undone.')) return;
    try {
      await adminApi.deleteStation(id);
      setStations(ss => ss.filter(s => s.id !== id));
      toast('success', 'Station deleted');
    } catch (e: unknown) { toast('error', e instanceof Error ? e.message : 'Failed'); }
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',  label: 'Overview',  icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'users',     label: 'Users',     icon: <Users className="w-4 h-4" /> },
    { id: 'stations',  label: 'Stations',  icon: <MapPin className="w-4 h-4" /> },
    { id: 'audit',     label: 'Audit Log', icon: <ClipboardList className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <Shield className="w-6 h-6 text-danger" />
        <h1 className="page-title">Admin Panel</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border dark:border-white/10 no-print">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-primary text-primary dark:text-blue-300'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        loading ? <LoadingGrid /> : overview ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Stations"    value={overview.total_stations}         icon={<MapPin className="w-5 h-5" />} />
              <StatCard label="Total Customers"   value={overview.total_customers}        icon={<Users className="w-5 h-5" />} />
              <StatCard label="Txns Today"        value={overview.transactions_today}     icon={<BarChart3 className="w-5 h-5" />} />
              <StatCard label="Revenue This Month" value={`M${Number(overview.revenue_this_month).toFixed(2)}`} icon={<BarChart3 className="w-5 h-5" />} />
            </div>

            <Card>
              <h2 className="section-title">Fuel Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase border-b border-border dark:border-white/10">
                      <th className="pb-2 pr-4 font-medium">Fuel</th>
                      <th className="pb-2 pr-4 font-medium">Litres</th>
                      <th className="pb-2 font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.fuel_breakdown.map(fb => (
                      <tr key={fb.fuel_name} className="border-b border-border dark:border-white/10 last:border-0">
                        <td className="py-2 pr-4 font-medium">{fb.fuel_name}</td>
                        <td className="py-2 pr-4 font-mono">{Number(fb.litres).toFixed(1)} L</td>
                        <td className="py-2 font-semibold">M{Number(fb.revenue).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : null
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input pl-9" placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button onClick={() => load('users')} className="btn-outline btn-sm">Search</button>
            <button onClick={openCreateUser} className="btn-primary btn-sm">
              <Plus className="w-4 h-4" /> Add User
            </button>
          </div>

          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-border dark:border-white/10">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Station</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b border-border dark:border-white/10">
                        {[...Array(7)].map((__, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : users.map(u => (
                    <tr key={u.id} className="border-b border-border dark:border-white/10 last:border-0">
                      <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{u.name}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={u.role === 'admin' ? 'danger' : u.role === 'employee' ? 'accent' : 'primary'}>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs max-w-[140px] truncate">
                        {u.station_name ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.is_active ? 'success' : 'danger'}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEditUser(u)} className="btn-ghost btn-sm px-2"><Edit3 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteUser(u.id)} className="btn-danger btn-sm px-2"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Stations */}
      {tab === 'stations' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className="btn-primary btn-sm" onClick={() => { setEditStation({}); setStationModal(true); }}>
              <Plus className="w-4 h-4" /> Add Station
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="card h-28 animate-pulse" />)
            ) : stations.map(s => (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{s.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{s.address}, {s.city}</p>
                    <Badge variant={s.is_active ? 'success' : 'danger'} className="mt-2">{s.is_active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => { setEditStation(s); setStationModal(true); }} className="btn-ghost btn-sm px-2">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteStation(s.id)} className="btn-danger btn-sm px-2">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Audit Log */}
      {tab === 'audit' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className="input pl-9" placeholder="Search actor / target…" value={auditSearch} onChange={e => setAuditSearch(e.target.value)} />
              </div>
              <select id="audit-action" name="audit_action" className="input w-44" value={auditAction} onChange={e => setAuditAction(e.target.value)}>
                <option value="">All actions</option>
                {auditActions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <input type="date" className="input w-36" value={auditFrom} onChange={e => setAuditFrom(e.target.value)} />
              <input type="date" className="input w-36" value={auditTo}   onChange={e => setAuditTo(e.target.value)} />
              <button className="btn-primary btn-sm" onClick={() => { setAuditPage(1); loadAudit(1); }}>Filter</button>
            </div>
          </Card>

          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-border dark:border-white/10">
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Actor</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Target</th>
                    <th className="px-4 py-3 font-medium">IP</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(8)].map((_, i) => (
                      <tr key={i} className="border-b border-border dark:border-white/10">
                        {[...Array(6)].map((__, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : auditLogs.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No audit logs found</td></tr>
                  ) : auditLogs.map(log => (
                    <tr key={log.log_id} className="border-b border-border dark:border-white/10 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800 dark:text-gray-100 truncate max-w-[140px]">{log.actor_email || '—'}</p>
                        {log.actor_role && <Badge variant={log.actor_role === 'admin' ? 'danger' : 'accent'} className="mt-0.5">{log.actor_role}</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate max-w-[160px] text-gray-700 dark:text-gray-300">{log.target_label || '—'}</p>
                        {log.target_type && <span className="text-xs text-gray-400">{log.target_type}{log.target_id ? ` #${log.target_id}` : ''}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">{log.ip_address || '—'}</td>
                      <td className="px-4 py-3 max-w-[200px]">
                        {log.metadata && (
                          <details className="cursor-pointer">
                            <summary className="text-xs text-primary hover:underline select-none">view</summary>
                            <pre className="mt-1 text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-all">{JSON.stringify(log.metadata, null, 2)}</pre>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {auditTotal > AUDIT_LIMIT && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border dark:border-white/10">
                <span className="text-xs text-gray-400">
                  {(auditPage - 1) * AUDIT_LIMIT + 1}–{Math.min(auditPage * AUDIT_LIMIT, auditTotal)} of {auditTotal}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={auditPage <= 1}
                    onClick={() => { const p = auditPage - 1; setAuditPage(p); loadAudit(p); }}
                    className="btn-ghost btn-sm px-2 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={auditPage * AUDIT_LIMIT >= auditTotal}
                    onClick={() => { const p = auditPage + 1; setAuditPage(p); loadAudit(p); }}
                    className="btn-ghost btn-sm px-2 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* User create/edit modal */}
      <Modal open={!!userForm} onClose={() => setUserForm(null)} title={userForm?.id ? 'Edit User' : 'Add User'}>
        {userForm && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="uf-name" className="label">Full Name</label>
                <input id="uf-name" name="full_name" className="input" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} />
              </div>
              <div>
                <label htmlFor="uf-phone" className="label">Phone</label>
                <input id="uf-phone" name="phone" className="input" value={userForm.phone} onChange={e => setUserForm({ ...userForm, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <label htmlFor="uf-email" className="label">Email</label>
              <input id="uf-email" name="email" type="email" className="input" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} />
            </div>
            <div>
              <label htmlFor="uf-role" className="label">Role</label>
              <select id="uf-role" name="role" className="input" value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value, station_id: e.target.value === 'customer' ? null : userForm.station_id })}>
                <option value="customer">customer</option>
                <option value="employee">employee</option>
                <option value="admin">admin</option>
              </select>
            </div>
            {(userForm.role === 'employee' || userForm.role === 'admin') && (
              <div>
                <label htmlFor="uf-station" className="label"><MapPin className="inline w-3.5 h-3.5 mr-1" />Assigned Station</label>
                <select
                  id="uf-station"
                  name="station_id"
                  className="input"
                  value={userForm.station_id ?? ''}
                  onChange={e => setUserForm({ ...userForm, station_id: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">No station assigned</option>
                  {stations.filter(s => s.is_active).map(s => (
                    <option key={s.id} value={s.id}>{s.name} — {s.city}</option>
                  ))}
                </select>
              </div>
            )}
            {!userForm.id && (
              <div>
                <label htmlFor="uf-password" className="label">Password</label>
                <input id="uf-password" name="password" type="password" className="input" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="uf_active" checked={userForm.is_active} onChange={e => setUserForm({ ...userForm, is_active: e.target.checked })} />
              <label htmlFor="uf_active" className="text-sm text-gray-700 dark:text-gray-300">Active</label>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setUserForm(null)} className="btn-outline flex-1">Cancel</button>
              <button onClick={saveUser} className="btn-primary flex-1" disabled={saving}>{saving ? 'Saving…' : userForm.id ? 'Save Changes' : 'Create User'}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Station create/edit modal */}
      <Modal open={stationModalOpen} onClose={() => setStationModal(false)} title={editStation?.id ? 'Edit Station' : 'Add Station'} size="lg">
        {editStation && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="st-name" className="label">Name</label>
                <input id="st-name" name="station_name" className="input" value={editStation.name ?? ''} onChange={e => setEditStation({ ...editStation, name: e.target.value })} />
              </div>
              <div>
                <label htmlFor="st-city" className="label">City</label>
                <input id="st-city" name="district" className="input" value={editStation.city ?? ''} onChange={e => setEditStation({ ...editStation, city: e.target.value })} />
              </div>
            </div>
            <div>
              <label htmlFor="st-address" className="label">Address</label>
              <input id="st-address" name="location" className="input" value={editStation.address ?? ''} onChange={e => setEditStation({ ...editStation, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="st-lat" className="label">Latitude</label>
                <input id="st-lat" name="latitude" type="number" step="any" className="input" value={editStation.latitude ?? ''} onChange={e => setEditStation({ ...editStation, latitude: parseFloat(e.target.value) })} />
              </div>
              <div>
                <label htmlFor="st-lng" className="label">Longitude</label>
                <input id="st-lng" name="longitude" type="number" step="any" className="input" value={editStation.longitude ?? ''} onChange={e => setEditStation({ ...editStation, longitude: parseFloat(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active_s" checked={editStation.is_active ?? true} onChange={e => setEditStation({ ...editStation, is_active: e.target.checked })} />
              <label htmlFor="is_active_s" className="text-sm text-gray-700 dark:text-gray-300">Active</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStationModal(false)} className="btn-outline flex-1">Cancel</button>
              <button onClick={saveStation} className="btn-primary flex-1" disabled={saving}>{saving ? 'Saving…' : 'Save Station'}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const variant =
    action.startsWith('DELETE') ? 'danger' :
    action.startsWith('CREATE') ? 'success' :
    action.startsWith('LOGIN_FAILED') ? 'danger' :
    action.startsWith('LOGIN') ? 'primary' :
    'accent';
  return <Badge variant={variant}>{action}</Badge>;
}
