// components/ProtectedRoute.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute() {
  const { user, isRestoringSession } = useAuth();

  // Until the mount-time session restore has decided whether the stored
  // credential still authenticates, render a spinner rather than bouncing a
  // signed-in user to /login on every page refresh.
  if (isRestoringSession) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
