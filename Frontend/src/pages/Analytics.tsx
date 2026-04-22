import { BarChart3, Calendar, DollarSign, Fuel, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { adminApi } from '../api/api';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { useToast } from '../context/ToastContext';
import type { AdminOverview } from '../types';

export default function Analytics() {
  const toast = useToast();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.overview()
      .then(setData)
      .catch(() => toast('error', 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [toast]);

  const maxRevenue = data ? Math.max(...data.daily_revenue.map(d => Number(d.revenue)), 1) : 1;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Analytics</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Platform performance overview</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}
          </div>
          <div className="card h-64 animate-pulse" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Stations" value={data.total_stations} icon={<Fuel className="w-5 h-5" />} />
            <StatCard label="Total Customers" value={data.total_customers} icon={<TrendingUp className="w-5 h-5" />} />
            <StatCard label="Transactions Today" value={data.transactions_today} icon={<BarChart3 className="w-5 h-5" />} />
            <StatCard label="All-Time Revenue" value={`M${(data.total_revenue_all_time / 1000).toFixed(1)}k`} icon={<DollarSign className="w-5 h-5" />} />
          </div>

          {/* Daily revenue bar chart */}
          <Card>
            <h2 className="section-title flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" /> Daily Revenue (Last 30 days)</h2>
            <div className="flex items-end gap-1 h-48">
              {data.daily_revenue.slice(-30).map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="relative w-full">
                    <div
                      className="bg-primary/70 dark:bg-primary rounded-t-sm hover:bg-primary transition-colors cursor-pointer"
                      style={{ height: `${Math.max(4, (Number(d.revenue) / maxRevenue) * 160)}px` }}
                      title={`M${Number(d.revenue).toFixed(2)}`}
                    />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                      M{Number(d.revenue).toFixed(0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>{data.daily_revenue.slice(-30)[0]?.date?.slice(5)}</span>
              <span>{data.daily_revenue.slice(-1)[0]?.date?.slice(5)}</span>
            </div>
          </Card>

          {/* Fuel breakdown */}
          <Card>
            <h2 className="section-title flex items-center gap-2"><Fuel className="w-4 h-4 text-accent" /> Fuel Breakdown</h2>
            <div className="space-y-4">
              {data.fuel_breakdown.map(fb => {
                const maxLitres = Math.max(...data.fuel_breakdown.map(f => Number(f.litres)), 1);
                const litres = Number(fb.litres);
                const revenue = Number(fb.revenue);
                return (
                  <div key={fb.fuel_name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{fb.fuel_name}</span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">M{revenue.toFixed(2)}</span>
                        <span className="text-xs text-gray-400 ml-2">{litres.toFixed(0)} L</span>
                      </div>
                    </div>
                    <div className="h-2 bg-surface-alt dark:bg-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${(litres / maxLitres) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* This month summary */}
          <Card>
            <h2 className="section-title">This Month</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-gradient-primary rounded-md p-4 text-white">
                <p className="text-blue-200 text-xs uppercase tracking-wide mb-1">Revenue</p>
                <p className="text-2xl font-heading font-bold">M{parseFloat(String(data.revenue_this_month)).toFixed(2)}</p>
              </div>
              <div className="bg-gradient-accent rounded-md p-4 text-white">
                <p className="text-orange-100 text-xs uppercase tracking-wide mb-1">Transactions Today</p>
                <p className="text-2xl font-heading font-bold">{data.transactions_today}</p>
              </div>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
