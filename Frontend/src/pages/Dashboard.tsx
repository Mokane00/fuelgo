import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Fuel, MapPin, History, Gift, TrendingUp, Clock, Star, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { transactionsApi, loyaltyApi, stationsApi } from '../api/api';
import { StatCard } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import type { Transaction, LoyaltyInfo, Station } from '../types';

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();

  const [txns, setTxns]         = useState<Transaction[]>([]);
  const [loyalty, setLoyalty]   = useState<LoyaltyInfo | null>(null);
  const [nearbyStations, setNearby] = useState<Station[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      transactionsApi.list({ limit: 5 }).catch(() => ({ transactions: [], total: 0 })),
      loyaltyApi.info().catch(() => null),
      stationsApi.list().catch(() => []),
    ]).then(([txData, loy, stations]) => {
      setTxns((txData as { transactions: Transaction[] }).transactions || []);
      setLoyalty(loy as LoyaltyInfo | null);
      setNearby((stations as Station[]).slice(0, 3));
    }).catch(() => toast('error', 'Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, [toast]);

  const totalSpent = txns.reduce((s, t) => s + (t.amount || 0), 0);
  const totalLitres = txns.reduce((s, t) => s + (t.litres || 0), 0);

  const tierColors: Record<string, string> = {
    Bronze: 'warning', Silver: 'default', Gold: 'warning', Platinum: 'primary',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Good {hour()}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Here's your FuelGO overview</p>
        </div>
        <Link to="/pump" className="btn-accent btn-sm flex items-center gap-2">
          <Fuel className="w-4 h-4" /> Pay for fuel
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Loyalty Points"
          value={loyalty?.points_balance?.toLocaleString() ?? '—'}
          icon={<Gift className="w-5 h-5" />}
        />
        <StatCard
          label="Total Spent (M)"
          value={loading ? '…' : `M${totalSpent.toFixed(2)}`}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          label="Litres Purchased"
          value={loading ? '…' : `${totalLitres.toFixed(1)} L`}
          icon={<Fuel className="w-5 h-5" />}
        />
        <StatCard
          label="Tier"
          value={loyalty?.tier ?? '—'}
          icon={<Star className="w-5 h-5" />}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/stations', label: 'Find Station', icon: <MapPin className="w-5 h-5" />, color: 'text-blue-600' },
          { to: '/pump',     label: 'Pay for Fuel', icon: <Fuel className="w-5 h-5" />,   color: 'text-orange-500' },
          { to: '/history',  label: 'History',       icon: <History className="w-5 h-5" />, color: 'text-green-600' },
          { to: '/loyalty',  label: 'Loyalty',       icon: <Gift className="w-5 h-5" />,   color: 'text-purple-600' },
        ].map(a => (
          <Link key={a.to} to={a.to} className="card flex flex-col items-center gap-2 py-5 hover:shadow-md transition-shadow text-center">
            <div className={`${a.color}`}>{a.icon}</div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{a.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent transactions */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Recent Transactions</h2>
            <Link to="/history" className="text-xs text-primary dark:text-blue-300 hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}</div>
          ) : txns.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No transactions yet</p>
          ) : (
            <div className="space-y-3">
              {txns.map(t => (
                <div key={t.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-sm bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Fuel className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{t.station_name || `Station #${t.station_id}`}</p>
                    <p className="text-xs text-gray-400">{t.fuel_name} · {t.litres.toFixed(2)} L · {new Date(t.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">M{t.amount.toFixed(2)}</p>
                    <Badge variant={t.status === 'completed' ? 'success' : t.status === 'failed' ? 'danger' : 'warning'}>
                      {t.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Nearby stations */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Nearby Stations</h2>
            <Link to="/stations" className="text-xs text-primary dark:text-blue-300 hover:underline flex items-center gap-1">
              View map <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}</div>
          ) : nearbyStations.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No stations found</p>
          ) : (
            <div className="space-y-3">
              {nearbyStations.map(s => (
                <div key={s.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-sm bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4 text-primary dark:text-blue-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{s.name}</p>
                    <p className="text-xs text-gray-400 truncate">{s.address}, {s.city}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-400">{s.is_active ? 'Open' : 'Closed'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Loyalty card */}
      {loyalty && (
        <div className="bg-gradient-primary rounded-lg p-5 text-white">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className="text-blue-200 text-sm font-medium">Loyalty Status</p>
              <h2 className="font-heading font-bold text-2xl mt-1">{loyalty.tier} Member</h2>
              <p className="text-blue-200 text-sm mt-1">
                {(loyalty.points_balance || 0).toLocaleString()} points · {(loyalty.points_to_next_tier || 0) > 0 ? `${loyalty.points_to_next_tier.toLocaleString()} to ${loyalty.next_tier}` : 'Max tier!'}
              </p>
            </div>
            <Badge variant={tierColors[loyalty.tier] as 'warning' | 'primary' | 'default'}>
              {loyalty.tier}
            </Badge>
          </div>
          <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${loyalty.points_to_next_tier > 0
                ? Math.min(100, (loyalty.total_earned / Math.max(1, loyalty.total_earned + loyalty.points_to_next_tier)) * 100)
                : 100}%` }}
            />
          </div>
          <Link to="/loyalty" className="mt-4 inline-flex items-center gap-1 text-sm text-blue-200 hover:text-white">
            View rewards <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

function hour() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function SkeletonRow() {
  return (
    <div className="flex gap-3 animate-pulse">
      <div className="w-8 h-8 rounded-sm bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 rounded bg-gray-200 dark:bg-gray-700 w-3/4" />
        <div className="h-2.5 rounded bg-gray-200 dark:bg-gray-700 w-1/2" />
      </div>
    </div>
  );
}
