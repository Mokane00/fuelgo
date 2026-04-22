import { useEffect, useState } from 'react';
import { Car, Plus, Trash2, Edit3, Star } from 'lucide-react';
import { vehiclesApi, fuelApi } from '../api/api';
import { useToast } from '../context/ToastContext';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import type { Vehicle } from '../types';

const EMPTY: Partial<Vehicle> = { make: '', model: '', year: new Date().getFullYear(), license_plate: '', fuel_type_id: undefined, tank_size: undefined, color: '' };

export default function Vehicles() {
  const toast = useToast();
  const [vehicles, setVehicles]   = useState<Vehicle[]>([]);
  const [fuelTypes, setFuelTypes] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<Vehicle | null>(null);
  const [form, setForm]           = useState<Partial<Vehicle>>(EMPTY);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    Promise.all([vehiclesApi.list(), fuelApi.list()])
      .then(([vs, fs]) => { setVehicles(vs); setFuelTypes(fs as { id: number; name: string }[]); })
      .catch(() => toast('error', 'Failed to load vehicles'))
      .finally(() => setLoading(false));
  }, [toast]);

  function openAdd() { setEditing(null); setForm(EMPTY); setModalOpen(true); }
  function openEdit(v: Vehicle) { setEditing(v); setForm(v); setModalOpen(true); }

  async function handleSave() {
    setSaving(true);
    try {
      if (editing) {
        const updated = await vehiclesApi.update(editing.id, form);
        setVehicles(vs => vs.map(v => v.id === editing.id ? updated : v));
      } else {
        const created = await vehiclesApi.add(form);
        setVehicles(vs => [...vs, created]);
      }
      toast('success', editing ? 'Vehicle updated' : 'Vehicle added');
      setModalOpen(false);
    } catch (err: unknown) {
      toast('error', (err as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this vehicle?')) return;
    try {
      await vehiclesApi.delete(id);
      setVehicles(vs => vs.filter(v => v.id !== id));
      toast('success', 'Vehicle removed');
    } catch { toast('error', 'Failed to delete'); }
  }

  async function handleSetDefault(id: number) {
    try {
      await vehiclesApi.setDefault(id);
      setVehicles(vs => vs.map(v => ({ ...v, is_default: v.id === id })));
      toast('success', 'Default vehicle updated');
    } catch { toast('error', 'Failed'); }
  }

  const NUMERIC_KEYS: (keyof Vehicle)[] = ['year', 'tank_size', 'fuel_type_id'];
  const set = (key: keyof Vehicle) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = NUMERIC_KEYS.includes(key) ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value;
    setForm(f => ({ ...f, [key]: val }));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">My Vehicles</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          <Plus className="w-4 h-4" /> Add Vehicle
        </button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-32 animate-pulse" />)}
        </div>
      ) : vehicles.length === 0 ? (
        <Card className="text-center py-12">
          <Car className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">No vehicles yet</p>
          <button className="btn-primary" onClick={openAdd}><Plus className="w-4 h-4" /> Add your first vehicle</button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map(v => (
            <Card key={v.id} className="relative">
              {v.is_default && (
                <span className="absolute top-3 right-3">
                  <Badge variant="primary"><Star className="w-3 h-3 mr-1 inline" />Default</Badge>
                </span>
              )}
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Car className="w-5 h-5 text-primary dark:text-blue-300" />
                </div>
                <div className="flex-1 min-w-0 pr-16">
                  <p className="font-heading font-semibold text-gray-900 dark:text-white">{v.year} {v.make} {v.model}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{v.license_plate}</p>
                </div>
              </div>
              <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400 mb-4">
                {v.fuel_name && <p>⛽ {v.fuel_name}</p>}
                {v.tank_size && <p>🪣 {v.tank_size}L tank</p>}
                {v.color && <p>🎨 {v.color}</p>}
              </div>
              <div className="flex gap-2">
                {!v.is_default && (
                  <button onClick={() => handleSetDefault(v.id)} className="btn-ghost btn-sm flex-1 text-xs">Set default</button>
                )}
                <button onClick={() => openEdit(v)} className="btn-outline btn-sm px-3"><Edit3 className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(v.id)} className="btn-danger btn-sm px-3"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Vehicle' : 'Add Vehicle'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="v-make" className="label">Make</label>
              <input id="v-make" name="make" className="input" placeholder="Toyota" value={form.make ?? ''} onChange={set('make')} />
            </div>
            <div>
              <label htmlFor="v-model" className="label">Model</label>
              <input id="v-model" name="model" className="input" placeholder="Corolla" value={form.model ?? ''} onChange={set('model')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="v-year" className="label">Year</label>
              <input id="v-year" name="year" type="number" className="input" value={form.year ?? ''} onChange={set('year')} />
            </div>
            <div>
              <label htmlFor="v-color" className="label">Color</label>
              <input id="v-color" name="color" className="input" placeholder="White" value={form.color ?? ''} onChange={set('color')} />
            </div>
          </div>
          <div>
            <label htmlFor="v-plate" className="label">License plate</label>
            <input id="v-plate" name="license_plate" className="input" placeholder="ABC 123 LS" value={form.license_plate ?? ''} onChange={set('license_plate')} />
          </div>
          <div>
            <label htmlFor="v-fuel" className="label">Fuel type</label>
            <select id="v-fuel" name="fuel_type_id" className="input" value={form.fuel_type_id ?? ''} onChange={set('fuel_type_id')}>
              <option value="">Select…</option>
              {fuelTypes.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="v-tank" className="label">Tank size (L)</label>
            <input id="v-tank" name="tank_size" type="number" className="input" placeholder="50" value={form.tank_size ?? ''} onChange={set('tank_size')} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-outline flex-1">Cancel</button>
            <button onClick={handleSave} className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add vehicle'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
