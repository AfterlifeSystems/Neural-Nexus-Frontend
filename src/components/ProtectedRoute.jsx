// components/ProtectedRoute.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  console.log('ENTRY PROTECTED ROUTE');

  if (loading) return <LoadingSpinner fullScreen />;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
