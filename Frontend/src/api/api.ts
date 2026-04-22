import type { AdminOverview, LoyaltyInfo, PaymentIntent, Station, Transaction, Vehicle } from '../types';

const BASE_URL = '/api';

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

function getToken(): string | null {
  return localStorage.getItem('fg_token');
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isFormData = false,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData && body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });

  // Handle refreshed token header
  const refreshed = res.headers.get('X-Refreshed-Token');
  if (refreshed) localStorage.setItem('fg_token', refreshed);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, err.error || err.message || 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  try {
    return await res.json();
  } catch (e) {
    // Some endpoints may return empty or non-JSON bodies (e.g., plain text). Fall back to text.
    const txt = await res.text().catch(() => null);
    // If text looks like JSON, try to parse it; otherwise return text or undefined
    if (txt) {
      try { return JSON.parse(txt) as T; } catch { return txt as unknown as T; }
    }
    return undefined as T;
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    request<{ token: string; user: unknown }>('POST', '/auth/login', { email, password }),

  register: (data: { name: string; email: string; password: string; phone?: string }) =>
    request<{ token: string; user: unknown }>('POST', '/auth/register', data),

  me: () => request<unknown>('GET', '/auth/me'),

  updateMe: (data: { name?: string; email?: string; phone?: string }) =>
    request<unknown>('PUT', '/auth/profile', {
      full_name: data.name,
      email: data.email,
      phone: data.phone,
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>('PUT', '/auth/password', {
      current_password: currentPassword,
      new_password: newPassword,
    }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('POST', '/auth/forgot-password', { email }),

  resetPassword: (email: string, code: string, password: string) =>
    request<{ message: string }>('POST', '/auth/reset-password', { email, code, password }),
};

// ─── Station normaliser (backend uses different field names) ──────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseStation(raw: any): Station {
  return {
    id: raw.id ?? raw.station_id,
    name: raw.name ?? raw.station_name,
    address: raw.address ?? raw.location,
    city: raw.city ?? raw.district,
    latitude: parseFloat(raw.latitude),
    longitude: parseFloat(raw.longitude),
    phone: raw.phone ?? raw.contact_number,
    operating_hours: raw.operating_hours ?? raw.opening_hours,
    is_active: raw.is_active != null ? Boolean(raw.is_active) : raw.status === 'active',
    avg_rating: raw.avg_rating != null ? parseFloat(raw.avg_rating) : undefined,
    fuel_prices: (raw.fuel_prices ?? []).map((fp: { fuel_type_id: string; fuel_name: string; price_per_litre: string | number }) => ({
      fuel_type_id: fp.fuel_type_id,
      fuel_name: fp.fuel_name,
      price_per_litre: parseFloat(String(fp.price_per_litre)),
    })),
    distance_km: raw.distance_km,
  };
}

// ─── Stations ─────────────────────────────────────────────────────────────────
export const stationsApi = {
  list: async (params?: { lat?: number; lng?: number; fuel_type_id?: number }) => {
    const raw = await request<unknown[]>('GET', `/stations?${new URLSearchParams(params as Record<string, string> ?? {})}`);
    return (raw as unknown[]).map(normaliseStation);
  },

  get: async (id: number) => normaliseStation(await request<unknown>('GET', `/stations/${id}`)),
  pumps: async (id: number): Promise<import('../types').Pump[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await request<any[]>('GET', `/stations/${id}/pumps`);
    return raw.map(p => ({
      id: p.id ?? p.pump_id,
      station_id: p.station_id,
      pump_number: p.pump_number,
      status: p.status,
      fuel_type_id: p.fuel_type_id,
      fuel_name: p.fuel_name,
    }));
  },
  ratings: (id: number) => request<unknown[]>('GET', `/stations/${id}/ratings`),
  addRating: (id: number, rating: number, comment?: string) =>
    request<unknown>('POST', `/stations/${id}/ratings`, { rating, comment }),
};

// ─── Vehicle normaliser ───────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseVehicle(raw: any): Vehicle {
  return {
    id: raw.id ?? raw.vehicle_id,
    user_id: raw.user_id ?? 0,
    make: raw.make ?? '',
    model: raw.model ?? '',
    year: Number(raw.year ?? 0),
    license_plate: raw.license_plate ?? raw.plate_number ?? '',
    fuel_type_id: raw.fuel_type_id ?? 0,
    fuel_name: raw.fuel_name,
    tank_size: raw.tank_size != null ? parseFloat(raw.tank_size) : undefined,
    color: raw.color,
    is_default: Boolean(raw.is_default),
  };
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────
export const vehiclesApi = {
  list: async () => (await request<unknown[]>('GET', '/vehicles')).map(normaliseVehicle),
  add: async (data: Partial<Vehicle>) => {
    const payload: any = { ...data };
    if (payload.license_plate != null) { payload.plate_number = payload.license_plate; delete payload.license_plate; }
    return normaliseVehicle(await request<unknown>('POST', '/vehicles', payload));
  },
  update: async (id: number, data: Partial<Vehicle>) => {
    const payload: any = { ...data };
    if (payload.license_plate != null) { payload.plate_number = payload.license_plate; delete payload.license_plate; }
    return normaliseVehicle(await request<unknown>('PUT', `/vehicles/${id}`, payload));
  },
  delete: (id: number) => request<void>('DELETE', `/vehicles/${id}`),
  setDefault: (id: number) => request<void>('PUT', `/vehicles/${id}/default`),
};

// ─── Transaction normaliser ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseTransaction(raw: any): Transaction {
  return {
    id: raw.id ?? raw.transaction_id,
    user_id: raw.user_id ?? 0,
    station_id: raw.station_id ?? 0,
    pump_id: raw.pump_id ?? 0,
    vehicle_id: raw.vehicle_id,
    fuel_type_id: raw.fuel_type_id ?? 0,
    fuel_name: raw.fuel_name ?? raw.fuel_type ?? '',
    litres: parseFloat(raw.litres ?? 0),
    amount: parseFloat(raw.amount ?? raw.total_amount ?? 0),
    price_per_litre: parseFloat(raw.price_per_litre ?? 0),
    payment_method: raw.payment_method ?? 'card',
    status: raw.status ?? 'completed',
    points_earned: raw.points_earned,
    created_at: raw.created_at ?? raw.transaction_date ?? new Date().toISOString(),
    station_name: raw.station_name ?? raw.station_location,
    pump_number: raw.pump_number,
    receipt_url: raw.receipt_url,
  };
}

// ─── Transactions ─────────────────────────────────────────────────────────────
export const transactionsApi = {
  list: async (params?: { page?: number; limit?: number }) => {
    const raw = await request<unknown>('GET', `/transactions?${new URLSearchParams(params as Record<string, string> ?? {})}`);
    const arr: unknown[] = Array.isArray(raw) ? raw : ((raw as { transactions?: unknown[] }).transactions ?? []);
    const total: number = Array.isArray(raw) ? arr.length : ((raw as { total?: number }).total ?? arr.length);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { transactions: arr.map((t: any) => normaliseTransaction(t)), total };
  },
  get: (id: number) => request<Transaction>('GET', `/transactions/${id}`),
  create: (data: {
    pump_id?: number;
    station_id: number;
    fuel_type_id: number;
    vehicle_id?: number;
    litres: number;
    price_per_litre: number;
    total_amount: number;
    payment_method: string;
    payment_intent_id?: string;
  }) => request<{ transaction_id: number }>('POST', '/transactions', data),
};

// ─── Payments ─────────────────────────────────────────────────────────────────
export const paymentsApi = {
  config: async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await request<any>('GET', '/payments/config');
    return { publishableKey: raw.publishableKey ?? raw.publishable_key ?? '' } as { publishableKey: string };
  },
  createIntent: async (data: { pump_id?: number; fuel_type_id: number; amount: number; vehicle_id?: number }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await request<any>('POST', '/payments/create-intent', {
      amount_lsl: data.amount,
      fuel_type_id: data.fuel_type_id,
      pump_id: data.pump_id,
      vehicle_id: data.vehicle_id,
    });
    return {
      clientSecret: raw.clientSecret ?? raw.client_secret ?? '',
      payment_intent_id: raw.payment_intent_id ?? '',
      amount: data.amount,
    } as PaymentIntent;
  },
};

// ─── Loyalty ──────────────────────────────────────────────────────────────────
export const loyaltyApi = {
  info: async (): Promise<LoyaltyInfo> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await request<any>('GET', '/loyalty');
    return {
      points_balance: Number(raw.points_balance) || 0,
      tier: raw.tier || 'Bronze',
      points_to_next_tier: Number(raw.points_to_next_tier) || 0,
      next_tier: raw.next_tier ?? undefined,
      total_earned: Number(raw.total_earned) || 0,
      total_redeemed: Number(raw.total_redeemed) || 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      history: (raw.history ?? []).map((h: any) => ({
        id: h.id ?? h.lt_id ?? 0,  // backend aliases lt_id AS id
        user_id: h.user_id,
        transaction_id: h.transaction_id,
        points: Number(h.points) || 0,
        type: h.type || 'earned',
        description: h.description || '',
        created_at: h.created_at || new Date().toISOString(),
      })),
    };
  },
  redeem: (points: number) => request<{ success: boolean; new_balance: number }>('POST', '/loyalty/redeem', { points }),
};

// ─── Fuel types ───────────────────────────────────────────────────────────────
export const fuelApi = {
  list: async () => {
    const raw = await request<unknown[]>('GET', '/fuel-types');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return raw.map((f: any) => ({
      id: f.id ?? f.fuel_type_id,
      name: f.name ?? f.fuel_name,
      price: parseFloat(f.price ?? f.price_per_litre ?? 0),
    }));
  },
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  overview: () => request<AdminOverview>('GET', '/admin/overview'),
  users: (params?: { page?: number; search?: string }) =>
    request<unknown>('GET', `/admin/users?${new URLSearchParams(params as Record<string, string> ?? {})}`),
  createUser: (data: { full_name: string; email: string; phone?: string; role: string; password: string; station_id?: number | null }) =>
    request<{ user_id: number }>('POST', '/admin/users', data),
  updateUser: (id: number, data: { full_name: string; email: string; phone?: string; role: string; is_active: boolean; station_id?: number | null }) =>
    request<unknown>('PUT', `/admin/users/${id}`, data),
  deleteUser: (id: number) => request<void>('DELETE', `/admin/users/${id}`),
  stations: async () => {
    const raw = await request<unknown[]>('GET', '/stations');
    return (raw as unknown[]).map(normaliseStation);
  },
  createStation: async (data: Partial<Station>) => {
    await request<unknown>('POST', '/stations', {
      station_name: data.name,
      location: data.address,
      district: data.city,
      latitude: data.latitude,
      longitude: data.longitude,
      status: data.is_active !== false ? 'active' : 'inactive',
    });
    // Reload to get full station with assigned id
    const all = await request<unknown[]>('GET', '/stations');
    return normaliseStation((all as unknown[]).at(-1));
  },
  updateStation: async (id: number, data: Partial<Station>) => {
    await request<unknown>('PUT', `/stations/${id}`, {
      station_name: data.name,
      location: data.address,
      district: data.city,
      latitude: data.latitude,
      longitude: data.longitude,
      status: data.is_active !== false ? 'active' : 'inactive',
    });
    return { ...data, id } as Station;
  },
  deleteStation: (id: number) => request<void>('DELETE', `/stations/${id}`),
  transactions: (params?: { from?: string; to?: string }) =>
    request<unknown>('GET', `/admin/transactions?${new URLSearchParams((params ?? {}) as Record<string, string>)}`),
  loyaltyReport: () => request<unknown>('GET', '/admin/loyalty-report'),
  auditLogs: (params?: { page?: number; limit?: number; action?: string; search?: string; from?: string; to?: string }) =>
    request<{ logs: AuditLog[]; total: number; actions: string[] }>('GET', `/admin/audit-logs?${new URLSearchParams((params ?? {}) as Record<string, string>)}`),
};

export interface AuditLog {
  log_id: number;
  actor_id: number | null;
  actor_email: string;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: number | null;
  target_label: string;
  ip_address: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ─── Employee ─────────────────────────────────────────────────────────────────
export const employeeApi = {
  dashboard: () => request<unknown>('GET', '/employee/dashboard'),
  updatePump: (id: number, status: string) =>
    request<unknown>('PUT', `/employee/pumps/${id}`, { status }),
};

// ─── Upload ───────────────────────────────────────────────────────────────────
export const uploadApi = {
  avatar: (file: File) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return request<{ url: string }>('POST', '/upload/avatar', fd, true);
  },
};

// ─── Favourites ───────────────────────────────────────────────────────────────
export const favouritesApi = {
  list: async () => {
    const raw = await request<unknown[]>('GET', '/favourites');
    return (raw as unknown[]).map(normaliseStation);
  },
  add: (stationId: number) => request<void>('POST', '/favourites', { station_id: stationId }),
  remove: (stationId: number) => request<void>('DELETE', `/favourites/${stationId}`),
};

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const alertsApi = {
  list: () => request<unknown[]>('GET', '/alerts'),
  dismiss: (id: number) => request<void>('DELETE', `/alerts/${id}`),
};

export { ApiError };
