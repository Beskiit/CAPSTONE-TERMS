import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication status on app load
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('https://terms-api.kiri8tives.com/auth/me', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('https://terms-api.kiri8tives.com/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      setUser(null);
      setIsAuthenticated(false);
      
      // Redirect to login
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      // Force redirect even if logout API fails
      setUser(null);
      setIsAuthenticated(false);
      window.location.href = '/login';
    }
  };

  const hasRole = (requiredRoles) => {
    if (!user) return false;
    
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return roles.includes(user.role);
  };

  const hasAnyRole = (roles) => {
    if (!user) return false;
    
    const roleHierarchy = {
      'teacher': 1,
      'coordinator': 2,
      'principal': 3,
      'admin': 4
    };
    
    const userLevel = roleHierarchy[user.role] || 0;
    const requiredLevels = roles.map(role => roleHierarchy[role] || 0);
    
    return requiredLevels.some(level => userLevel >= level);
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    logout,
    checkAuthStatus,
    hasRole,
    hasAnyRole,
    // Role check helpers
    isTeacher: () => hasRole('teacher'),
    isCoordinator: () => hasAnyRole(['coordinator', 'principal', 'admin']),
    isPrincipal: () => hasAnyRole(['principal', 'admin']),
    isAdmin: () => hasRole('admin'),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

