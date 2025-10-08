// Authentication middleware
export const requireAuth = (req, res, next) => {
  // Local dev bypass (DO NOT use in production)
  if (process.env.DEV_BYPASS_AUTH === "1") {
    // give yourself an admin role so your routes with requireAnyRole / requireAdmin will pass
    req.user = { user_id: 1, role: "admin", name: "Dev Admin" };
    return next();
  }

  // ... your real auth checks (session/JWT) below ...
  if (typeof req.isAuthenticated === "function" && req.isAuthenticated()) return next();
  if (req.session?.user) { req.user = req.session.user; return next(); }
  return res.status(401).json({ error: "Authentication required" });
};


// Role-based authorization middleware
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role;
    
    // If roles is a string, convert to array
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (allowedRoles.includes(userRole)) {
      return next();
    }
    
    res.status(403).json({ 
      error: 'Insufficient permissions', 
      required: allowedRoles,
      current: userRole 
    });
  };
};

// Specific role middlewares for convenience
export const requireTeacher = requireRole(['teacher', 'coordinator', 'principal', 'admin']);
export const requireCoordinator = requireRole(['coordinator', 'principal', 'admin']);
export const requirePrincipal = requireRole(['principal', 'admin']);
export const requireAdmin = requireRole(['admin']);

// Check if user is the owner of a resource or has higher privileges
export const requireOwnershipOrRole = (roles) => {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role;
    const userId = req.user.user_id;
    const resourceUserId = req.params.userId || req.body.userId;

    // If roles is a string, convert to array
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    // Check if user has required role or is the owner of the resource
    if (allowedRoles.includes(userRole) || userId.toString() === resourceUserId?.toString()) {
      return next();
    }
    
    res.status(403).json({ 
      error: 'Insufficient permissions - not owner or lacks required role',
      required: allowedRoles,
      current: userRole 
    });
  };
};

