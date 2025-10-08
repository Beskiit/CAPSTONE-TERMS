import db from "../db.js"; // shared MySQL connection

const VALID_ROLES = ["teacher", "coordinator", "principal", "admin"];

/** List TEACHERS only (for dropdowns) */
export const getTeachers = (req, res) => {
  const sql = `
    SELECT user_id, name
    FROM user_details
    WHERE LOWER(role) = 'teacher'
    ORDER BY name ASC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

/** CREATE user (Admin only - for manual user creation) */
export const createUser = (req, res) => {
  const { google_id, email, name, role } = req.body;

  // Minimal required fields
  if (!email || !name) {
    return res.status(400).json({ error: "email and name are required" });
  }

  // Use provided role if valid, else default to "teacher"
  const finalRole = role && VALID_ROLES.includes(role) ? role : "teacher";

  const sql = `
    INSERT INTO user_details (google_id, email, name, role)
    VALUES (?, ?, ?, ?)
  `;
  const params = [google_id || null, email, name, finalRole];

  db.query(sql, params, (err, result) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res
          .status(409)
          .json({ error: "User with this email (or Google ID) already exists" });
      }
      return res.status(500).json({ error: "Error inserting user: " + err.message });
    }
    return res.status(201).json({
      message: `User ${name} added successfully`,
      userId: result.insertId,
    });
  });
};

/** READ all users (Admin/Principal only) */
export const getUsers = (req, res) => {
  const sql =
    "SELECT user_id, google_id, email, name, role, created_at FROM user_details ORDER BY created_at DESC";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

/** READ single user */
export const getUser = (req, res) => {
  const { id } = req.params;
  const sql =
    "SELECT user_id, google_id, email, name, role, created_at FROM user_details WHERE user_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(results[0]);
  });
};

/** UPDATE user (Admin only or self for name) */
export const patchUser = (req, res) => {
  const { id } = req.params;
  const { name, role } = req.body;

  if (role && !VALID_ROLES.includes(role)) {
    return res
      .status(400)
      .json({ error: "Invalid role. Must be one of: " + VALID_ROLES.join(", ") });
  }

  // Verify user exists (use user_id, not id)
  db.query("SELECT user_id FROM user_details WHERE user_id = ?", [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(404).json({ error: "User not found" });

    const updates = [];
    const values = [];

    if (name) {
      updates.push("name = ?");
      values.push(name);
    }
    if (role) {
      updates.push("role = ?");
      values.push(role);
    }

    if (!updates.length) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const sql = `UPDATE user_details SET ${updates.join(", ")} WHERE user_id = ?`;
    values.push(id);

    db.query(sql, values, (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ message: `User with id ${id} has been updated` });
    });
  });
};

/** DELETE user (Admin only) */
export const deleteUser = (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM user_details WHERE user_id = ?";

  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: `User with id ${id} has been deleted` });
  });
};
