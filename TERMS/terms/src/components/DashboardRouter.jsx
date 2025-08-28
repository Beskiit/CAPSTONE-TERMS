import React from 'react';
import { useAuth } from '../context/AuthContext';
import DashboardTeacher from '../pages/Teacher/DashboardTeacher';
import DashboardCoordinator from '../pages/Coordinator/DashboardCoordinator';

const DashboardRouter = () => {
  const { user } = useAuth();

  if (!user) {
    return <div>Loading user data...</div>;
  }

  // Route user to appropriate dashboard based on role
  switch (user.role) {
    case 'teacher':
      return <DashboardTeacher />;
    case 'coordinator':
      return <DashboardCoordinator />;
    case 'principal':
      return <DashboardCoordinator />; // Principal can use coordinator dashboard
    case 'admin':
      return <DashboardCoordinator />; // Admin can use coordinator dashboard
    default:
      return (
        <div className="role-error">
          <h2>Unknown Role</h2>
          <p>Your role "{user.role}" is not recognized. Please contact an administrator.</p>
        </div>
      );
  }
};

export default DashboardRouter;

