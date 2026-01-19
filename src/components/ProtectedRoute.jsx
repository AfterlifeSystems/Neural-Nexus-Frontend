// components/ProtectedRoute.jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const ProtectedRoute = ({ children }) => {
  const { user, loading, accessToken } = useAuth(); // accessToken = firebase idToken
  const location = useLocation();
  console.log('PROTECTED ROUTE XXXXXXXXXXXXXXXXXXXXXXXX');
  console.log('loading: ' + loading);

  console.log('user: ' + user);
  console.log('local storage: ' + localStorage.getItem('user'));

  // Show loading spinner while Firebase is still checking auth state
  // Now you can safely use conditionals
  if (loading) {
    console.log('LOADING PROTECTED ROUTE XXXXXXXXXXXXXXXXXXXXXXXX');
    console.log('loading: ' + loading);

    console.log('user: ' + user);
    return <LoadingSpinner />;
  }
  // Critical: only allow access if we have a valid Firebase user AND a fresh ID token
  if (!user) {
    console.log('!USER PROTECTED ROUTE XXXXXXXXXXXXXXXXXXXXXXXX');
    console.log('loading: ' + loading);
    console.log('user: ' + user);
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
