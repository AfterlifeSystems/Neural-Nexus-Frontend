// components/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth(); // 'user' is the firebaseUser object
  console.log(
    'XXXXXXXXXXXXXXXXXXXXXXXXX protected route XXXXXXXXXXXXXXXXXXXXXXXX'
  );
  console.log(user);
  // try {
  //   if (!user) {
  //     user = localStorage.getItem(user);
  //   }
  // } catch {
  //   console.log('no user or user object in local storage');
  // }
  // IMPORTANT: Do not redirect if we are still determining auth state
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black">
        {/* A simple spinner prevents the blank 'null' return which can break router history */}
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-teal-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
