// ─── Auth / User ──────────────────────────────────────────────────────────────
export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: 'customer' | 'employee' | 'admin';
  avatar_url?: string;
  loyalty_points?: number;
  loyalty_tier?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  is_verified?: boolean;
  created_at?: string;
}

export interface AuthState {
  token: string | null;
  user: User | null;
}

// ─── Station ──────────────────────────────────────────────────────────────────
export interface FuelPrice {
  fuel_type_id: number;
  fuel_name: string;
  price_per_litre: number;
}

export interface Station {
  id: number;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  phone?: string;
  operating_hours?: string;
  is_active: boolean;
  avg_rating?: number;
  fuel_prices?: FuelPrice[];
  distance_km?: number;
}

// ─── Pump ─────────────────────────────────────────────────────────────────────
export type PumpStatus = 'available' | 'in_use' | 'maintenance' | 'offline';

export interface Pump {
  id: number;
  station_id: number;
  pump_number: number;
  status: PumpStatus;
  fuel_type_id?: number;
  fuel_name?: string;
}

// ─── Vehicle ─────────────────────────────────────────────────────────────────
export interface Vehicle {
  id: number;
  user_id: number;
  make: string;
  model: string;
  year: number;
  license_plate: string;
  fuel_type_id: number;
  fuel_name?: string;
  tank_size?: number;
  color?: string;
  is_default: boolean;
}

// ─── Transaction ─────────────────────────────────────────────────────────────
export interface Transaction {
  id: number;
  user_id: number;
  station_id: number;
  pump_id: number;
  vehicle_id?: number;
  fuel_type_id: number;
  fuel_name: string;
  litres: number;
  amount: number;
  price_per_litre: number;
  payment_method: 'mobile_money' | 'card' | 'wallet' | 'cash';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  points_earned?: number;
  created_at: string;
  station_name?: string;
  pump_number?: number;
  receipt_url?: string;
}

// ─── Loyalty ──────────────────────────────────────────────────────────────────
export interface LoyaltyTransaction {
  id: number;
  user_id: number;
  transaction_id?: number;
  points: number;
  type: 'earned' | 'redeemed' | 'bonus' | 'expired';
  description: string;
  created_at: string;
}

export interface LoyaltyInfo {
  points_balance: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  points_to_next_tier: number;
  next_tier?: string;
  total_earned: number;
  total_redeemed: number;
  history: LoyaltyTransaction[];
}

// ─── Admin ────────────────────────────────────────────────────────────────────
export interface AdminOverview {
  total_stations: number;
  total_customers: number;
  total_employees: number;
  transactions_today: number;
  revenue_today: number;
  revenue_this_month: number;
  total_revenue_all_time: number;
  daily_revenue: { date: string; revenue: number }[];
  fuel_breakdown: { fuel_name: string; litres: number; revenue: number }[];
}

// ─── Payments ─────────────────────────────────────────────────────────────────
export interface PaymentIntent {
  clientSecret: string;
  payment_intent_id: string;
  amount: number;
}

// ─── API response wrapper ─────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}
