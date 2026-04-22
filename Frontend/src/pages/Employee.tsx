import { Activity, Clock, DollarSign, Fuel, RefreshCw, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { employeeApi } from '../api/api';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { useToast } from '../context/ToastContext';
import type { Pump } from '../types';

interface EmployeeDashboard {
  station: { id: number; name: string; address: string };
  today: { txns: number; revenue: number | string; litres: number | string };
  pumps: (Pump & { fuel_name?: string })[];
  recent_transactions: unknown[];
}

const STATUS_CYCLE: Record<string, string> = {
  available: 'maintenance',
  maintenance: 'available',
  in_use: 'available',
};

export default function Employee() {
  const toast = useToast();
  const [data, setData] = useState<EmployeeDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await employeeApi.dashboard();
      setData(d as EmployeeDashboard);
    } catch { toast('error', 'Failed to load station data'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  async function togglePumpStatus(pump: Pump) {
    const newStatus = STATUS_CYCLE[pump.status] ?? 'available';
    setUpdating(pump.id);
    try {
      await employeeApi.updatePump(pump.id, newStatus);
      setData(d => d ? {
        ...d,
        pumps: d.pumps.map(p => p.id === pump.id ? { ...p, status: newStatus as Pump['status'] } : p),
      } : d);
      toast('success', `Pump #${pump.pump_number} → ${newStatus}`);
    } catch { toast('error', 'Failed to update pump'); }
    finally { setUpdating(null); }
  }

  const pumpColor: Record<string, string> = {
    available: 'border-success bg-success/5',
    in_use: 'border-primary bg-primary/5',
    maintenance: 'border-warning bg-warning/5',
    offline: 'border-danger bg-danger/5',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{data?.station.name ?? 'My Station'}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{data?.station.address ?? 'Employee dashboard'}</p>
        </div>
        <button onClick={load} className="btn-outline btn-sm" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Today's stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Today's Revenue" value={`M${parseFloat(String(data?.today.revenue ?? 0)).toFixed(2)}`} icon={<DollarSign className="w-5 h-5" />} />
        <StatCard label="Transactions" value={data?.today.txns ?? '—'} icon={<Activity className="w-5 h-5" />} />
        <StatCard label="Litres Sold" value={`${parseFloat(String(data?.today.litres ?? 0)).toFixed(1)} L`} icon={<Fuel className="w-5 h-5" />} />
      </div>

      {/* Pumps grid */}
      <Card>
        <h2 className="section-title flex items-center gap-2"><Zap className="w-4 h-4 text-accent" /> Pump Status</h2>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-sm bg-gray-200 dark:bg-gray-700 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(data?.pumps ?? []).map(p => (
              <div key={p.id} className={`rounded-sm border-2 p-4 text-center ${pumpColor[p.status] ?? 'border-border'}`}>
                <p className="font-heading font-bold text-xl text-gray-900 dark:text-white">#{p.pump_number}</p>
                {p.fuel_name && <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{p.fuel_name}</p>}
                <Badge variant={p.status === 'available' ? 'success' : p.status === 'in_use' ? 'primary' : p.status === 'maintenance' ? 'warning' : 'danger'}>
                  {p.status}
                </Badge>
                {p.status !== 'in_use' && (
                  <button
                    onClick={() => togglePumpStatus(p)}
                    disabled={updating === p.id}
                    className="mt-2 btn-ghost btn-sm w-full text-xs"
                  >
                    {updating === p.id ? '…' : p.status === 'available' ? 'Set maintenance' : 'Set available'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent transactions */}
      <Card>
        <h2 className="section-title flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /> Recent Transactions</h2>
        {loading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded-sm bg-gray-200 dark:bg-gray-700 animate-pulse" />)}</div>
        ) : (data?.recent_transactions ?? []).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No transactions today</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-border dark:border-white/10">
                  <th className="pb-2 pr-4 font-medium">Time</th>
                  <th className="pb-2 pr-4 font-medium">Pump</th>
                  <th className="pb-2 pr-4 font-medium">Fuel</th>
                  <th className="pb-2 pr-4 font-medium">Litres</th>
                  <th className="pb-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recent_transactions as unknown as {
                  id: number; pump_number: number; fuel_name: string;
                  litres: number | string; amount: number | string; created_at: string;
                }[]).map((t, i) => (
                  <tr key={i} className="border-b border-border dark:border-white/10 last:border-0">
                    <td className="py-2 pr-4 text-gray-400">{new Date(t.created_at).toLocaleTimeString()}</td>
                    <td className="py-2 pr-4">#{t.pump_number}</td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{t.fuel_name}</td>
                    <td className="py-2 pr-4 font-mono">{parseFloat(String(t.litres)).toFixed(2)} L</td>
                    <td className="py-2 font-semibold">M{parseFloat(String(t.amount)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
