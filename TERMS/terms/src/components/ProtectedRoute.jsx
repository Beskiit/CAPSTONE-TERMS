import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Login from '../pages/Login';

const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const { isAuthenticated, user, loading, hasAnyRole } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect to login page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If specific roles are required, check user role
  if (requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
    // Redirect to appropriate dashboard based on user role
    const redirectPath = user?.role === 'teacher' ? '/DashboardTeacher' : 
                        user?.role === 'coordinator' ? '/DashboardCoordinator' :
                        user?.role === 'principal' ? '/DashboardPrincipal' :
                        user?.role === 'admin' ? '/UserManagement' : '/login';
    return <Navigate to={redirectPath} replace />;
  }

  // User is authenticated and has required permissions
  return children;
};

export default ProtectedRoute;

