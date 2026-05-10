import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from '../api/client';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }
  return <>{children}</>;
}
