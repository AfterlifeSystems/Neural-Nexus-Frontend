// components/ProtectedRoute.jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
const ProtectedRoute = ({ children }) => {
  const { user, loading, accessToken } = useAuth(); // accessToken = firebase idToken
  const location = useLocation();
  // Show loading spinner while Firebase is still checking auth state
  // Now you can safely use conditionals
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-teal-500"></div>
      </div>
    );
  }
  console.log('XXXXXXXXXXXXXXXXXXXXXXXXX USER XXXXXXXXXXXXXXXXXXXX');
  console.log(user);
  // Critical: only allow access if we have a valid Firebase user AND a fresh ID token
  if (!user) {
    console.log('!user 1 XXXXXXXXXXXXXXXXXXXXXXXXX USER XXXXXXXXXXXXXXXXXXXX');
    console.log(user);
    try {
      const user = getAuth().currentUser;
      console.log(
        'try getAuth user  XXXXXXXXXXXXXXXXXXXXXXXXX USER XXXXXXXXXXXXXXXXXXXX'
      );
      console.log(user);
      if (!user) {
        console.log(
          'getAuth !user 2  XXXXXXXXXXXXXXXXXXXXXXXXX USER XXXXXXXXXXXXXXXXXXXX'
        );
        console.log(user);

        return <Navigate to="/login" replace state={{ from: location }} />;
      }
    } catch {
      console.log('error getAuth().currentUser && user');
    }
    // Optional: you can log or redirect with state if needed
  }

  return <Outlet />;
};

export default ProtectedRoute;
