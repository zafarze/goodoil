import axios, { AxiosError } from 'axios';

export const TOKEN_KEY = 'goodoil_token';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(err);
  },
);

export interface AuthUser {
  id: number;
  username: string;
  is_staff: boolean;
}

export async function login(username: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const res = await api.post<{ token: string; user: AuthUser }>('/auth/login/', { username, password });
  localStorage.setItem(TOKEN_KEY, res.data.token);
  localStorage.setItem('goodoil_user', JSON.stringify(res.data.user));
  return res.data;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('goodoil_user');
  window.location.assign('/login');
}

export function currentUser(): AuthUser | null {
  const raw = localStorage.getItem('goodoil_user');
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Station {
  id: number;
  name: string;
  address: string;
}

export interface FuelType {
  id: number;
  name: string;
  unit: 'L' | 'T';
}

export interface Employee {
  id: number;
  full_name: string;
  telegram_id: number;
  station: number;
  station_name: string;
  is_active: boolean;
  birth_date: string | null;
  phone: string;
  address: string;
  passport_front: string | null;
  passport_back: string | null;
  user: number | null;
  user_username: string | null;
}

export interface Delivery {
  id: number;
  date: string;
  station: number;
  station_name: string;
  fuel_type: number;
  fuel_type_name: string;
  volume: string;
  note: string;
  created_at: string;
}

export interface ReportItem {
  id: number;
  fuel_type: number;
  fuel_type_name: string;
  sold: string;
  revenue: string;
  remainder: string;
}

export interface DailyReport {
  id: number;
  date: string;
  employee: number;
  employee_name: string;
  station: number;
  station_name: string;
  photo: string | null;
  status: 'draft' | 'confirmed';
  created_at: string;
  confirmed_at: string | null;
  items: ReportItem[];
}

export interface Remainder {
  fuel_type_id: number;
  fuel_type: string;
  unit: string;
  delivered: number;
  sold: number;
  remainder: number;
}

export interface UserProfile {
  username: string;
  is_staff: boolean;
  full_name: string;
  phone: string;
  address: string;
  birth_date: string | null;
  photo: string | null;
}

export type SystemUserRole = 'owner' | 'employee' | 'user';

export interface SystemUser {
  id: number;
  username: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
  last_login: string | null;
  role: SystemUserRole;
  employee_id: number | null;
  employee_name: string | null;
  employee_station: string | null;
}
