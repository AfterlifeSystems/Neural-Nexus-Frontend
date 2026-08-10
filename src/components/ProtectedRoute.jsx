// components/ProtectedRoute.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  console.log(`PROTECTED ROUTE LOADING: ${isLoading}`);
  console.log(`user: ${user}`);
  console.log('ENTRY PROTECTED ROUTE');

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
