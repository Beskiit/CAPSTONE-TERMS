import bcrypt from 'bcrypt';
import db from '../db.js'; // shared MySQL connection

// CREATE user
export const createUser = async (req, res) => {
  const { username, password, name, role } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = 'INSERT INTO user_details (username, password, name, role) VALUES (?, ?, ?, ?)';
    db.query(sql, [username, hashedPassword, name, role], (err, result) => {
      if (err) return res.status(500).send('Error inserting user: ' + err);
      res.send(`User with name ${name} added to the database.`);
    });
  } catch (error) {
    res.status(500).send('Error hashing password: ' + error);
  }
};

// READ all users
export const getUsers = (req, res) => {
  const sql = 'SELECT user_id, username, name, role FROM user_details';

  db.query(sql, (err, results) => {
    if (err) return res.status(500).send(err);
    res.send(results);
  });
};

// READ single user
export const getUser = (req, res) => {
  const { id } = req.params;
  const sql = 'SELECT user_id, username, name, role FROM user_details WHERE user_id = ?';

  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).send(err);
    if (results.length === 0) return res.status(404).send('User not found');
    res.send(results[0]);
  });
};

// UPDATE user
export const patchUser = async (req, res) => {
  const { id } = req.params;
  const { username, password, name, role } = req.body;

  db.query('SELECT * FROM user_details WHERE user_id = ?', [id], async (err, results) => {
    if (err) return res.status(500).send(err);
    if (results.length === 0) return res.status(404).send('User not found');

    const updates = [];
    const values = [];

    if (username) {
      updates.push('username = ?');
      values.push(username);
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      values.push(hashedPassword);
    }

    if (name) {
      updates.push('name = ?');
      values.push(name);
    }

    if (role) {
      updates.push('role = ?');
      values.push(role);
    }

    if (updates.length === 0) return res.status(400).send('No fields to update.');
    
    const sql = `UPDATE user_details SET ${updates.join(', ')} WHERE user_id = ?`;
    values.push(id);

    db.query(sql, values, (err, result) => {
      if (err) return res.status(500).send(err);
      res.send(`User with id ${id} has been updated.`);
    });
  });
};

// DELETE user
export const deleteUser = (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM user_details WHERE user_id = ?';

  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).send(err);
    res.send(`User with id ${id} has been deleted.`);
  });
};
