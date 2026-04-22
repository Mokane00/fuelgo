import { useEffect, useState } from 'react';
import { Gift, Star, TrendingUp, Clock, ArrowDownLeft, Sparkles } from 'lucide-react';
import { loyaltyApi } from '../api/api';
import { useToast } from '../context/ToastContext';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import type { LoyaltyInfo } from '../types';

const TIER_COLORS: Record<string, string> = {
  Bronze:   'bg-amber-700',
  Silver:   'bg-gray-400',
  Gold:     'bg-yellow-500',
  Platinum: 'bg-purple-600',
};

const TIER_BENEFITS: Record<string, string[]> = {
  Bronze:   ['1 point per M1 spent', '5% discount on 10th fill-up', 'Birthday bonus 50pts'],
  Silver:   ['1.5 pts per M1 spent', '8% discount on 5th fill-up', 'Priority support'],
  Gold:     ['2 pts per M1 spent', '12% discount every 3rd fill-up', 'Free car wash monthly'],
  Platinum: ['3 pts per M1 spent', '15% discount on all fills', 'Dedicated concierge'],
};

export default function Loyalty() {
  const toast = useToast();
  const [loyalty, setLoyalty]   = useState<LoyaltyInfo | null>(null);
  const [loading, setLoading]   = useState(true);
  const [redeemAmt, setRedeemAmt] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    loyaltyApi.info()
      .then(setLoyalty)
      .catch(() => toast('error', 'Failed to load loyalty info'))
      .finally(() => setLoading(false));
  }, [toast]);

  async function handleRedeem() {
    const pts = parseInt(redeemAmt);
    if (!pts || pts <= 0) { toast('error', 'Enter a valid point amount'); return; }
    if (loyalty && pts > loyalty.points_balance) { toast('error', 'Insufficient points'); return; }
    setRedeeming(true);
    try {
      await loyaltyApi.redeem(pts);
      toast('success', `Redeemed ${pts} points — confetti! 🎉`);
      setLoyalty(l => l ? { ...l, points_balance: l.points_balance - pts, total_redeemed: l.total_redeemed + pts } : null);
      setRedeemAmt('');
    } catch (err: unknown) {
      toast('error', (err as Error).message || 'Redemption failed');
    } finally {
      setRedeeming(false);
    }
  }

  const pct = loyalty
    ? Math.min(100, loyalty.total_earned / Math.max(1, loyalty.total_earned + loyalty.points_to_next_tier) * 100)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Loyalty Rewards</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Earn points every time you fuel up</p>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}
        </div>
      ) : loyalty ? (
        <>
          {/* Tier hero */}
          <div className={`${TIER_COLORS[loyalty.tier] || 'bg-primary'} rounded-lg p-6 text-white`}>
            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
              <div>
                <p className="text-white/70 text-sm font-medium">Your tier</p>
                <h2 className="font-heading font-bold text-3xl mt-1">{loyalty.tier}</h2>
              </div>
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Star className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-white/80 text-sm mb-3">
              {loyalty.points_to_next_tier > 0
                ? `${loyalty.points_to_next_tier.toLocaleString()} points to ${loyalty.next_tier}`
                : 'Maximum tier reached!'}
            </p>
            <div className="h-2 bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card className="flex flex-col gap-1">
              <div className="w-8 h-8 rounded-sm bg-primary/10 flex items-center justify-center mb-2">
                <Gift className="w-4 h-4 text-primary dark:text-blue-300" />
              </div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Balance</p>
              <p className="text-2xl font-heading font-bold text-gray-900 dark:text-white">{loyalty.points_balance.toLocaleString()}</p>
              <p className="text-xs text-gray-400">pts</p>
            </Card>
            <Card className="flex flex-col gap-1">
              <div className="w-8 h-8 rounded-sm bg-success/10 flex items-center justify-center mb-2">
                <TrendingUp className="w-4 h-4 text-success" />
              </div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Total Earned</p>
              <p className="text-2xl font-heading font-bold text-gray-900 dark:text-white">{loyalty.total_earned.toLocaleString()}</p>
              <p className="text-xs text-gray-400">lifetime pts</p>
            </Card>
            <Card className="flex flex-col gap-1">
              <div className="w-8 h-8 rounded-sm bg-accent/10 flex items-center justify-center mb-2">
                <ArrowDownLeft className="w-4 h-4 text-accent" />
              </div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Redeemed</p>
              <p className="text-2xl font-heading font-bold text-gray-900 dark:text-white">{loyalty.total_redeemed.toLocaleString()}</p>
              <p className="text-xs text-gray-400">pts used</p>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Redeem */}
            <Card>
              <h2 className="section-title flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> Redeem Points</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">100 points = M1 discount on your next purchase</p>
              <div className="flex gap-2 mb-3">
                {[500, 1000, 2000, 5000].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setRedeemAmt(String(amt))}
                    disabled={loyalty.points_balance < amt}
                    className={`flex-1 py-2 rounded-sm text-xs font-medium border transition-all ${
                      redeemAmt === String(amt) ? 'border-primary bg-primary/10 text-primary dark:text-blue-300' : 'border-border dark:border-white/20'
                    } disabled:opacity-40`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
              <input
                type="number"
                className="input mb-3"
                placeholder="Or enter custom amount"
                value={redeemAmt}
                onChange={e => setRedeemAmt(e.target.value)}
                max={loyalty.points_balance}
              />
              {redeemAmt && parseInt(redeemAmt) > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  = M{(parseInt(redeemAmt) / 100).toFixed(2)} discount
                </p>
              )}
              <button
                className="btn-accent w-full"
                onClick={handleRedeem}
                disabled={redeeming || !redeemAmt || parseInt(redeemAmt) <= 0 || parseInt(redeemAmt) > loyalty.points_balance}
              >
                {redeeming ? 'Redeeming…' : 'Redeem Points'}
              </button>
            </Card>

            {/* Tier benefits */}
            <Card>
              <h2 className="section-title">{loyalty.tier} Benefits</h2>
              <ul className="space-y-2">
                {(TIER_BENEFITS[loyalty.tier] ?? []).map(b => (
                  <li key={b} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-success mt-0.5">✓</span> {b}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* Transaction history */}
          <Card>
            <h2 className="section-title flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /> Points History</h2>
            {loyalty.history.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No history yet</p>
            ) : (
              <div className="space-y-3">
                {loyalty.history.map(lh => (
                  <div key={lh.id} className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                      ${lh.type === 'earned' ? 'bg-success/10 text-success' :
                        lh.type === 'redeemed' ? 'bg-accent/10 text-accent' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                      {lh.type === 'earned' ? '+' : lh.type === 'redeemed' ? '−' : '•'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 dark:text-gray-300">{lh.description}</p>
                      <p className="text-xs text-gray-400">{new Date(lh.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={lh.type === 'earned' ? 'success' : lh.type === 'redeemed' ? 'accent' : 'default'}>
                      {lh.type === 'earned' ? '+' : '−'}{Math.abs(lh.points)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card className="text-center py-12">
          <Gift className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No loyalty data available</p>
        </Card>
      )}
    </div>
  );
}
