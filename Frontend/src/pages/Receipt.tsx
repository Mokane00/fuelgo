import { CheckCircle, Download, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { transactionsApi } from '../api/api';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { useToast } from '../context/ToastContext';
import type { Transaction } from '../types';

export default function Receipt() {
  const toast = useToast();
  const id = new URLSearchParams(window.location.search).get('id');
  const [txn, setTxn] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    transactionsApi.get(Number(id))
      .then(setTxn)
      .catch(() => toast('error', 'Receipt not found'))
      .finally(() => setLoading(false));
  }, [id, toast]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!txn) return (
    <div className="text-center py-20">
      <p className="text-gray-400">Receipt not found</p>
    </div>
  );

  return (
    <div className="max-w-sm mx-auto space-y-4 animate-fade-in">
      <div className="flex items-center justify-between no-print">
        <h1 className="page-title">Receipt</h1>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn-outline btn-sm">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={() => { document.title = `FuelGO-Receipt-${txn.id}`; window.print(); }} className="btn-primary btn-sm">
            <Download className="w-4 h-4" /> Save PDF
          </button>
        </div>
      </div>

      <Card className="print-card">
        {/* Header */}
        <div className="text-center border-b border-border dark:border-white/10 pb-5 mb-5">
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6 text-success" />
          </div>
          <h2 className="font-heading font-bold text-gray-900 dark:text-white text-xl">Payment Successful</h2>
          <p className="text-gray-400 text-sm mt-1">FuelGO Digital Receipt</p>
        </div>

        {/* Receipt lines */}
        <div className="space-y-3 text-sm">
          <Row label="Receipt #" value={`#${txn.id}`} />
          <Row label="Date" value={new Date(txn.created_at).toLocaleString()} />
          <Row label="Station" value={txn.station_name ?? `Station #${txn.station_id}`} />
          <Row label="Pump" value={`Pump #${txn.pump_id}`} />
          <Row label="Fuel" value={txn.fuel_name} />
          <Row label="Litres" value={`${txn.litres.toFixed(3)} L`} />
          <Row label="Price/L" value={`M${txn.price_per_litre.toFixed(2)}`} />
          <Row label="Payment" value={txn.payment_method} />
          {txn.points_earned != null && (
            <Row label="Points Earned" value={`+${txn.points_earned} pts`} />
          )}
        </div>

        <div className="border-t border-border dark:border-white/10 mt-5 pt-5 flex items-center justify-between">
          <span className="font-heading font-semibold text-gray-700 dark:text-gray-200 text-base">Total</span>
          <span className="font-heading font-bold text-2xl text-primary dark:text-blue-300">M{txn.amount.toFixed(2)}</span>
        </div>

        <div className="mt-4 text-center">
          <Badge variant={txn.status === 'completed' ? 'success' : txn.status === 'failed' ? 'danger' : 'warning'}>
            {txn.status.toUpperCase()}
          </Badge>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          Thank you for using FuelGO!<br />
          www.fuelgo.ls
        </p>
      </Card>
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
