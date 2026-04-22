import { ChevronLeft, ChevronRight, Download, Fuel, Receipt, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { transactionsApi } from '../api/api';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { useToast } from '../context/ToastContext';
import type { Transaction } from '../types';

const STATUS_COLOR: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  completed: 'success',
  failed: 'danger',
  pending: 'warning',
  refunded: 'default',
};

export default function History() {
  const toast = useToast();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Transaction | null>(null);
  const LIMIT = 15;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await transactionsApi.list({ page: p, limit: LIMIT });
      setTxns(res.transactions);
      setTotal(res.total);
    } catch { toast('error', 'Failed to load history'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => {
    load(1);
  }, [load]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  const filtered = search
    ? txns.filter(t =>
      (t.station_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      t.fuel_name.toLowerCase().includes(search.toLowerCase()),
    )
    : txns;

  const pages = Math.ceil(filtered.length / LIMIT);
  const displayed = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  const totalSpent = txns.reduce((s, t) => s + (t.amount || 0), 0);
  const totalLitres = txns.reduce((s, t) => s + (t.litres || 0), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Transaction History</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{total} total transaction{total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => window.print()} className="btn-outline btn-sm no-print">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="flex flex-col gap-1">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Spent</p>
          <p className="text-2xl font-heading font-bold text-gray-900 dark:text-white">M{totalSpent.toFixed(2)}</p>
        </Card>
        <Card className="flex flex-col gap-1">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Litres</p>
          <p className="text-2xl font-heading font-bold text-gray-900 dark:text-white">{totalLitres.toFixed(1)} L</p>
        </Card>
        <Card className="flex flex-col gap-1">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Transactions</p>
          <p className="text-2xl font-heading font-bold text-gray-900 dark:text-white">{total}</p>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input id="history-search" name="search" className="input pl-9" placeholder="Search by station or fuel…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-border dark:border-white/10">
                <th className="px-5 py-3 font-medium">Station</th>
                <th className="px-4 py-3 font-medium">Fuel</th>
                <th className="px-4 py-3 font-medium">Litres</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
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
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <Fuel className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No transactions found
                  </td>
                </tr>
              ) : displayed.map(t => (
                <tr
                  key={t.id}
                  className="border-b border-border dark:border-white/10 hover:bg-surface-alt dark:hover:bg-bg/50 cursor-pointer"
                  onClick={() => setSelected(t)}
                >
                  <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100 max-w-[200px] truncate">
                    {t.station_name || `Station #${t.station_id}`}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{t.fuel_name}</td>
                  <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-300">{t.litres.toFixed(2)} L</td>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">M{t.amount.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_COLOR[t.status] ?? 'default'}>{t.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Receipt className="w-4 h-4 text-gray-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border dark:border-white/10">
            <p className="text-xs text-gray-400">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="btn-outline btn-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage(p => p + 1)}
                className="btn-outline btn-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelected(null)} />
          <Card className="relative w-full max-w-sm animate-scale-in z-10">
            <h3 className="font-heading font-semibold text-gray-900 dark:text-white mb-4">Transaction #{selected.id}</h3>
            <div className="space-y-2 text-sm">
              <Row label="Station" value={selected.station_name ?? `#${selected.station_id}`} />
              <Row label="Pump" value={`#${selected.pump_id}`} />
              <Row label="Fuel" value={selected.fuel_name} />
              <Row label="Litres" value={`${selected.litres.toFixed(2)} L`} />
              <Row label="Price/L" value={`M${selected.price_per_litre.toFixed(2)}`} />
              <Row label="Amount" value={`M${selected.amount.toFixed(2)}`} />
              <Row label="Points" value={`+${selected.points_earned ?? 0}`} />
              <Row label="Status" value={selected.status} />
              <Row label="Date" value={new Date(selected.created_at).toLocaleString()} />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setSelected(null)} className="btn-outline flex-1">Close</button>
              <a href={`/receipt?id=${selected.id}`} className="btn-primary flex-1 text-center">View Receipt</a>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-medium text-gray-800 dark:text-gray-100">{value}</span>
    </div>
  );
}
