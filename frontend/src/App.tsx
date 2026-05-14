import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { NotifyProvider } from './components/Notify';
import RequireAuth from './components/RequireAuth';
import Login from './pages/Login';
import Reports from './pages/Reports';
import Deliveries from './pages/Deliveries';
import Employees from './pages/Employees';
import Stations from './pages/Stations';
import FuelTypes from './pages/FuelTypes';
import Users from './pages/Users';
import Management from './pages/Management';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import './App.css';

const Dashboard = lazy(() => import('./pages/Dashboard'));

export default function App() {
  return (
    <NotifyProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route
            index
            element={
              <Suspense fallback={<div className="page"><p className="muted">Загрузка…</p></div>}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route path="reports" element={<Reports />} />
          <Route path="deliveries" element={<Deliveries />} />
          <Route path="employees" element={<Employees />} />
          <Route path="stations" element={<Stations />} />
          <Route path="fuel-types" element={<FuelTypes />} />
          <Route path="users" element={<Users />} />
          <Route path="management" element={<Management />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </NotifyProvider>
  );
}
