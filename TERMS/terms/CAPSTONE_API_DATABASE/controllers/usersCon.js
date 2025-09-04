import db from '../db.js'; // shared MySQL connection
import { requireAuth, requireAdmin } from '../middleware/auth.js';

// CREATE user (Admin only - for manual user creation)
export const createUser = async (req, res) => {
  const { google_id, email, name, role } = req.body;

  // Validation
  if (!google_id || !email || !name) {
    return res.status(400).json({ error: 'google_id, email, and name are required' });
  }

  const validRoles = ['teacher', 'coordinator', 'principal', 'admin'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be one of: ' + validRoles.join(', ') });
  }

  try {
    const sql = 'INSERT INTO user_details (google_id, email, name, role) VALUES (?, ?, ?, ?)';
    db.query(sql, [google_id, email, name, role || 'teacher'], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: 'User with this Google ID or email already exists' });
        }
        return res.status(500).json({ error: 'Error inserting user: ' + err.message });
      }
      res.status(201).json({ 
        message: `User ${name} added successfully`,
        userId: result.insertId 
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// READ all users (Admin/Principal only)
export const getUsers = (req, res) => {
  const sql = 'SELECT id, google_id, email, name, role, created_at FROM user_details';

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

// READ single user
export const getUser = (req, res) => {
  const { id } = req.params;
  const sql = 'SELECT id, google_id, email, name, role, created_at FROM user_details WHERE id = ?';

  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(results[0]);
  });
};

// UPDATE user (Admin only or self for name)
export const patchUser = async (req, res) => {
  const { id } = req.params;
  const { name, role } = req.body;

  // Validation
  const validRoles = ['teacher', 'coordinator', 'principal', 'admin'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be one of: ' + validRoles.join(', ') });
  }

  db.query('SELECT * FROM user_details WHERE id = ?', [id], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'User not found' });

    const updates = [];
    const values = [];

    if (name) {
      updates.push('name = ?');
      values.push(name);
    }

    if (role) {
      updates.push('role = ?');
      values.push(role);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    
    const sql = `UPDATE user_details SET ${updates.join(', ')} WHERE id = ?`;
    values.push(id);

    db.query(sql, values, (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: `User with id ${id} has been updated` });
    });
  });
};

// DELETE user (Admin only)
export const deleteUser = (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM user_details WHERE id = ?';

  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: `User with id ${id} has been deleted` });
  });
};
