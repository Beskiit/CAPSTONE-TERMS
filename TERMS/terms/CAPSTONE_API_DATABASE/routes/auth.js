import express from 'express';
import passport from '../config/passport.js';

const router = express.Router();

// Google OAuth login route
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

// Google OAuth callback route
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication, redirect to frontend with user info
    const user = req.user;
    const frontendURL = process.env.FRONTEND_URL || 'https://your-frontend-domain.com';
    
    // Redirect to frontend with user role to determine which dashboard to show
    res.redirect(`${frontendURL}/dashboard?role=${user.role}&user=${encodeURIComponent(JSON.stringify({
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role
    }))}`);
  }
);

// Logout route
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    req.session.destroy((sessionErr) => {
      if (sessionErr) {
        return res.status(500).json({ error: 'Session destruction failed' });
      }
      res.clearCookie('connect.sid'); // Clear the session cookie
      res.json({ message: 'Logged out successfully' });
    });
  });
});

// Check authentication status
router.get('/status', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: {
        user_id: req.user.user_id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Get current user info
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      user_id: req.user.user_id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

export default router;

