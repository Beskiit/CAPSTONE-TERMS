import express from 'express';
import bcrypt from 'bcrypt';

const router = express.Router();

// Temporary user accounts for testing
const tempUsers = [
  {
    id: 1,
    username: 'teacher1',
    password: '$2b$10$8K1p/a0dCO/.Oz1A1MNKSO8BdMOoEzEo1YGy2JYKH.JpscEHqDbZy', // password: teacher123
    name: 'John Teacher',
    role: 'teacher',
    email: 'teacher@test.com'
  },
  {
    id: 2,
    username: 'coordinator1',
    password: '$2b$10$8K1p/a0dCO/.Oz1A1MNKSO8BdMOoEzEo1YGy2JYKH.JpscEHqDbZy', // password: coord123
    name: 'Jane Coordinator',
    role: 'coordinator',
    email: 'coordinator@test.com'
  },
  {
    id: 3,
    username: 'principal1',
    password: '$2b$10$8K1p/a0dCO/.Oz1A1MNKSO8BdMOoEzEo1YGy2JYKH.JpscEHqDbZy', // password: principal123
    name: 'Dr. Principal',
    role: 'principal',
    email: 'principal@test.com'
  },
  {
    id: 4,
    username: 'admin1',
    password: '$2b$10$8K1p/a0dCO/.Oz1A1MNKSO8BdMOoEzEo1YGy2JYKH.JpscEHqDbZy', // password: admin123
    name: 'System Admin',
    role: 'admin',
    email: 'admin@test.com'
  }
];

// Login endpoint
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Find user
  const user = tempUsers.find(u => u.username === username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Check password (for demo, we'll accept simple passwords too)
  const isValidPassword = password === 'teacher123' && user.role === 'teacher' ||
                         password === 'coord123' && user.role === 'coordinator' ||
                         password === 'principal123' && user.role === 'principal' ||
                         password === 'admin123' && user.role === 'admin';

  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Return user info (excluding password)
  const { password: _, ...userInfo } = user;
  res.json({
    message: 'Login successful',
    user: userInfo,
    token: `temp_token_${user.id}_${Date.now()}` // Simple token for testing
  });
});

// Get current user (mock endpoint)
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Extract user ID from token (very basic for demo)
  const token = authHeader.replace('Bearer ', '');
  const userId = token.split('_')[2];
  
  const user = tempUsers.find(u => u.id.toString() === userId);
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { password: _, ...userInfo } = user;
  res.json(userInfo);
});

// Get all available test accounts
router.get('/test-accounts', (req, res) => {
  const accounts = tempUsers.map(user => ({
    username: user.username,
    role: user.role,
    name: user.name,
    password: `${user.role}123` // Show password for testing
  }));
  
  res.json({
    message: 'Available test accounts',
    accounts
  });
});

export default router;
