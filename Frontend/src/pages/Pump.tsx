import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { AlertCircle, Car, CheckCircle, CreditCard, Fuel, MapPin } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { fuelApi, paymentsApi, stationsApi, transactionsApi, vehiclesApi } from '../api/api';
import { Card } from '../components/ui/Card';
import { useToast } from '../context/ToastContext';
import type { Pump, Station, Vehicle } from '../types';

// ─── Stripe checkout sub-component ───────────────────────────────────────────
function CheckoutForm({
  onSuccess,
  onError,
}: {
  onSuccess: (paymentIntentId: string) => void;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });
      if (error) { onError(error.message ?? 'Payment failed'); return; }
      if (paymentIntent?.status === 'succeeded') {
        onSuccess(paymentIntent.id);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <PaymentElement />
      <button type="submit" className="btn-accent w-full btn-lg" disabled={loading}>
        {loading ? 'Processing payment…' : 'Pay Now'}
      </button>
    </form>
  );
}

// ─── Main Pump page ───────────────────────────────────────────────────────────
export default function PumpPage() {
  const toast = useToast();

  // Config
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fuelTypes, setFuelTypes] = useState<{ id: number; name: string; price: number }[]>([]);

  // Selections
  const [stationId, setStationId] = useState<number | ''>('');
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [pumpId, setPumpId] = useState<number | ''>('');
  const [vehicleId, setVehicleId] = useState<number | ''>('');
  const [fuelTypeId, setFuelTypeId] = useState<number | ''>('');
  const [litres, setLitres] = useState('');
  const [paymentAmt, setPaymentAmt] = useState(0);

  // State machine: idle → selecting → confirming → paying → success | error
  const [step, setStep] = useState<'select' | 'confirm' | 'pay' | 'success' | 'error'>('select');
  const [clientSecret, setClientSecret] = useState('');
  const [txnId, setTxnId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Socket for real-time pump status
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Load Stripe key safely
    paymentsApi.config().then(cfg => {
      const key = cfg.publishableKey;
      if (!key) return;
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isSecure = window.location.protocol === 'https:' || isLocal;
      if (!isSecure) {
        console.warn('Stripe requires HTTPS in production. Skipping Stripe init to avoid warnings.');
      } else {
        setStripePromise(loadStripe(key));
      }
    }).catch(() => { /* ignore stripe init failure */ });

    // Load data
    Promise.all([
      stationsApi.list().catch(() => []),
      vehiclesApi.list().catch(() => []),
      fuelApi.list().catch(() => []),
    ]).then(([ss, vs, fs]) => {
      setStations(ss as Station[]);
      setVehicles(vs as Vehicle[]);
      setFuelTypes(fs as { id: number; name: string; price: number }[]);
      // Auto-select default vehicle
      const def = (vs as Vehicle[]).find(v => v.is_default);
      if (def) { setVehicleId(def.id); setFuelTypeId(def.fuel_type_id); }
    });

    // Socket.io
    const sock = io(window.location.origin);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(sock);
    return () => { sock.disconnect(); };
  }, []);

  // Load pumps when station changes
  useEffect(() => {
    if (!stationId) return;
    stationsApi.pumps(stationId as number).then(ps => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPumps(ps as Pump[]);
      socket?.emit('join_station', stationId);
    });
  }, [stationId, socket]);

  // Recalculate amount
  useEffect(() => {
    const l = parseFloat(litres);
    const ft = fuelTypes.find(f => f.id === fuelTypeId);
    if (l > 0 && ft) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPaymentAmt(l * ft.price);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPaymentAmt(0);
    }
  }, [litres, fuelTypeId, fuelTypes]);

  const handleConfirm = useCallback(async () => {
    if (!pumpId || !fuelTypeId || !litres) { toast('error', 'Fill all fields'); return; }
    setStep('pay');
    try {
      const pi = await paymentsApi.createIntent({
        pump_id: pumpId as number,
        fuel_type_id: fuelTypeId as number,
        amount: paymentAmt,
        vehicle_id: vehicleId ? vehicleId as number : undefined,
      });
      setClientSecret(pi.clientSecret);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
      setStep('error');
    }
  }, [pumpId, fuelTypeId, litres, paymentAmt, vehicleId, toast]);

  const fuel = fuelTypes.find(f => f.id === fuelTypeId);
  const pump = pumps.find(p => p.id === pumpId);
  const vehicle = vehicles.find(v => v.id === vehicleId);

  if (step === 'success') return (
    <div className="max-w-md mx-auto text-center py-16 animate-scale-in">
      <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
      <h2 className="text-xl font-heading font-bold text-gray-900 dark:text-white mb-2">Payment Successful!</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-6">Your fuel is being dispensed.</p>
      <div className="flex gap-3 justify-center">
        <a href={`/receipt?id=${txnId}`} className="btn-primary">View Receipt</a>
        <button onClick={() => { setStep('select'); setClientSecret(''); setTxnId(null); }} className="btn-outline">Pay Again</button>
      </div>
    </div>
  );

  if (step === 'error') return (
    <div className="max-w-md mx-auto text-center py-16 animate-scale-in">
      <AlertCircle className="w-16 h-16 text-danger mx-auto mb-4" />
      <h2 className="text-xl font-heading font-bold text-gray-900 dark:text-white mb-2">Payment Failed</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-6">{errorMsg}</p>
      <button onClick={() => setStep('select')} className="btn-primary">Try Again</button>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="page-title">Pay for Fuel</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Select a station, pump, and pay securely</p>
      </div>

      {step === 'select' && (
        <Card>
          <div className="space-y-4">
            {/* Station */}
            <div>
              <label htmlFor="pump-station" className="label"><MapPin className="inline w-4 h-4 mr-1" />Station</label>
              <select id="pump-station" className="input" value={stationId} onChange={e => { setStationId(Number(e.target.value)); setPumpId(''); setFuelTypeId(''); }}>
                <option value="">Select a station…</option>
                {stations.filter(s => s.is_active).map(s => (
                  <option key={s.id} value={s.id}>{s.name} — {s.city}</option>
                ))}
              </select>
            </div>

            {/* Pump */}
            {pumps.length > 0 && (
              <div>
                <label className="label"><Fuel className="inline w-4 h-4 mr-1" />Pump</label>
                <div className="grid grid-cols-3 gap-2">
                  {pumps.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        if (p.status !== 'available') return;
                        setPumpId(p.id);
                        if (p.fuel_type_id) setFuelTypeId(p.fuel_type_id);
                      }}
                      disabled={p.status !== 'available'}
                      className={`py-3 px-2 rounded-sm border text-sm font-medium transition-all ${pumpId === p.id
                          ? 'border-primary bg-primary/10 text-primary dark:text-blue-300'
                          : p.status === 'available'
                            ? 'border-border dark:border-white/20 hover:border-primary/50'
                            : 'border-border dark:border-white/10 text-gray-300 dark:text-gray-600 bg-surface-alt dark:bg-bg cursor-not-allowed'
                        }`}
                    >
                      <span className="block font-bold">#{p.pump_number}</span>
                      {p.fuel_name && <span className="block text-xs mt-0.5 text-gray-500 dark:text-gray-400 truncate">{p.fuel_name}</span>}
                      <span className={`block text-xs mt-0.5 ${p.status === 'available' ? 'text-success' : 'text-danger'}`}>
                        {p.status}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fuel type */}
            <div>
              <label htmlFor="pump-fuel" className="label"><Fuel className="inline w-4 h-4 mr-1" />Fuel type</label>
              <select id="pump-fuel" className="input" value={fuelTypeId} onChange={e => setFuelTypeId(Number(e.target.value))}>
                <option value="">Select fuel…</option>
                {fuelTypes.map(f => (
                  <option key={f.id} value={f.id}>{f.name} — M{f.price.toFixed(2)}/L</option>
                ))}
              </select>
            </div>

            {/* Vehicle */}
            {vehicles.length > 0 && (
              <div>
                <label htmlFor="pump-vehicle" className="label"><Car className="inline w-4 h-4 mr-1" />Vehicle (optional)</label>
                <select id="pump-vehicle" className="input" value={vehicleId} onChange={e => setVehicleId(Number(e.target.value) || '')}>
                  <option value="">No vehicle / manual</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} ({v.license_plate})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Litres */}
            <div>
              <label htmlFor="pump-litres" className="label">Litres to pump</label>
              <input id="pump-litres" type="number" min="0.1" step="0.1" className="input" placeholder="e.g. 20" value={litres} onChange={e => setLitres(e.target.value)} />
            </div>

            {/* Amount preview */}
            {paymentAmt > 0 && (
              <div className="flex items-center justify-between bg-surface-alt dark:bg-bg rounded-sm p-3">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total amount</span>
                <span className="text-xl font-heading font-bold text-primary dark:text-blue-300">M{paymentAmt.toFixed(2)}</span>
              </div>
            )}

            <button
              className="btn-accent w-full btn-lg"
              onClick={() => setStep('confirm')}
              disabled={!stationId || !pumpId || !fuelTypeId || !litres}
            >
              <CreditCard className="w-4 h-4" /> Proceed to payment
            </button>
          </div>
        </Card>
      )}

      {step === 'confirm' && (
        <Card>
          <h2 className="section-title">Confirm your order</h2>
          <div className="space-y-3 mb-6">
            <Row label="Station" value={stations.find(s => s.id === stationId)?.name ?? ''} />
            <Row label="Pump" value={pump ? `#${pump.pump_number}` : ''} />
            <Row label="Fuel" value={fuel?.name ?? ''} />
            {vehicle && <Row label="Vehicle" value={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} />}
            <Row label="Litres" value={`${litres} L`} />
            <Row label="Price/L" value={`M${fuel?.price.toFixed(2)}`} />
            <div className="pt-3 border-t border-border dark:border-white/10 flex justify-between">
              <span className="font-semibold text-gray-800 dark:text-gray-100">Total</span>
              <span className="text-xl font-heading font-bold text-primary dark:text-blue-300">M{paymentAmt.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('select')} className="btn-outline flex-1">Back</button>
            <button onClick={handleConfirm} className="btn-accent flex-1">Pay M{paymentAmt.toFixed(2)}</button>
          </div>
        </Card>
      )}

      {step === 'pay' && clientSecret && stripePromise && (
        <Card>
          <h2 className="section-title">Enter payment details</h2>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm
              onSuccess={async paymentIntentId => {
                try {
                  const txn = await transactionsApi.create({
                    pump_id: pumpId as number || undefined,
                    station_id: stationId as number,
                    fuel_type_id: fuelTypeId as number,
                    vehicle_id: vehicleId ? vehicleId as number : undefined,
                    litres: parseFloat(litres),
                    price_per_litre: fuel?.price ?? 0,
                    total_amount: paymentAmt,
                    payment_method: 'card',
                    payment_intent_id: paymentIntentId,
                  });
                  setTxnId(txn.transaction_id);
                  setStep('success');
                } catch (err: unknown) {
                  // Payment succeeded but recording failed — still show success with null id
                  console.error('Transaction record error:', err);
                  setTxnId(null);
                  setStep('success');
                }
              }}
              onError={msg => { setErrorMsg(msg); setStep('error'); }}
            />
          </Elements>
          <button onClick={() => setStep('confirm')} className="btn-ghost w-full mt-3 btn-sm">Back</button>
        </Card>
      )}

      {step === 'pay' && !clientSecret && (
        <div className="card text-center py-10">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Setting up payment…</p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-medium text-gray-800 dark:text-gray-100">{value}</span>
    </div>
  );
}
