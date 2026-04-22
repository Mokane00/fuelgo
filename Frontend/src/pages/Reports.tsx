import { Activity, Download, FileText, Gift, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { adminApi } from '../api/api';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { useToast } from '../context/ToastContext';

interface LoyaltyReport {
  total_points_issued: number;
  total_points_redeemed: number;
  top_earners: { name: string; email: string; points: number }[];
}

interface TxnReport {
  transactions: { id: number; station_name: string; fuel_name: string; litres: number; amount: number; status: string; created_at: string }[];
  total: number;
}

export default function Reports() {
  const toast = useToast();
  const [loyaltyReport, setLoyaltyReport] = useState<LoyaltyReport | null>(null);
  const [txnReport, setTxnReport] = useState<TxnReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminApi.loyaltyReport().catch(() => null),
      adminApi.transactions().catch(() => null),
    ]).then(([lr, tr]) => {
      setLoyaltyReport(lr as LoyaltyReport | null);
      setTxnReport(tr as TxnReport | null);
    }).catch(() => toast('error', 'Failed to load reports'))
      .finally(() => setLoading(false));
  }, [toast]);

  function printReport() {
    window.print();
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2"><FileText className="w-6 h-6" /> Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Generated {new Date().toLocaleDateString()}</p>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={printReport} className="btn-outline btn-sm"><Printer className="w-4 h-4" /> Print</button>
          <button onClick={printReport} className="btn-primary btn-sm"><Download className="w-4 h-4" /> Export PDF</button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-32 animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Loyalty report */}
          {loyaltyReport && (
            <Card>
              <h2 className="section-title flex items-center gap-2"><Gift className="w-4 h-4 text-accent" /> Loyalty Programme Report</h2>
              <div className="grid sm:grid-cols-2 gap-4 mb-5">
                <div className="bg-surface-alt dark:bg-bg rounded-sm p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Points Issued</p>
                  <p className="text-2xl font-heading font-bold text-gray-900 dark:text-white">{(loyaltyReport.total_points_issued ?? 0).toLocaleString()}</p>
                </div>
                <div className="bg-surface-alt dark:bg-bg rounded-sm p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Points Redeemed</p>
                  <p className="text-2xl font-heading font-bold text-gray-900 dark:text-white">{(loyaltyReport.total_points_redeemed ?? 0).toLocaleString()}</p>
                </div>
              </div>

              {loyaltyReport.top_earners && loyaltyReport.top_earners.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Top Earners</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-border dark:border-white/10">
                          <th className="pb-2 pr-4 font-medium">Rank</th>
                          <th className="pb-2 pr-4 font-medium">Name</th>
                          <th className="pb-2 pr-4 font-medium">Email</th>
                          <th className="pb-2 font-medium">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loyaltyReport.top_earners.map((e, i) => (
                          <tr key={i} className="border-b border-border dark:border-white/10 last:border-0">
                            <td className="py-2 pr-4 font-mono text-gray-400">#{i + 1}</td>
                            <td className="py-2 pr-4 font-medium text-gray-800 dark:text-gray-100">{e.name}</td>
                            <td className="py-2 pr-4 text-gray-500">{e.email}</td>
                            <td className="py-2 font-semibold text-primary dark:text-blue-300">{e.points.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>
          )}

          {/* Transactions report */}
          <Card>
            <h2 className="section-title flex items-center gap-2"><Activity className="w-4 h-4 text-primary dark:text-blue-300" /> Transaction Report</h2>
            {txnReport && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{txnReport.total} total transactions</p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-border dark:border-white/10">
                    <th className="pb-2 pr-4 font-medium">ID</th>
                    <th className="pb-2 pr-4 font-medium">Station</th>
                    <th className="pb-2 pr-4 font-medium">Fuel</th>
                    <th className="pb-2 pr-4 font-medium">Litres</th>
                    <th className="pb-2 pr-4 font-medium">Amount</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(txnReport?.transactions ?? []).slice(0, 50).map(t => (
                    <tr key={t.id} className="border-b border-border dark:border-white/10 last:border-0">
                      <td className="py-2 pr-4 font-mono text-gray-400">#{t.id}</td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300 max-w-[160px] truncate">{t.station_name}</td>
                      <td className="py-2 pr-4">{t.fuel_name}</td>
                      <td className="py-2 pr-4 font-mono">{parseFloat(String(t.litres)).toFixed(2)}</td>
                      <td className="py-2 pr-4 font-semibold">M{parseFloat(String(t.amount)).toFixed(2)}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={t.status === 'completed' ? 'success' : t.status === 'failed' ? 'danger' : 'warning'}>
                          {t.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-gray-400 whitespace-nowrap text-xs">{new Date(t.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
