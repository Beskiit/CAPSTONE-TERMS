import db from '../db.js';

export const createNotification = (userId, payload, cb) => {
  const { title, message = null, type = null, ref_type = null, ref_id = null } = payload || {};
  if (!userId || !title) return cb?.(new Error('userId and title are required'));
  const sql = `
    INSERT INTO notifications (user_id, title, message, type, ref_type, ref_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  db.query(sql, [userId, title, message, type, ref_type, ref_id], (err, res) => {
    if (cb) return cb(err, res?.insertId);
  });
};

export const createNotificationsBulk = (rows = [], cb) => {
  if (!Array.isArray(rows) || rows.length === 0) return cb?.(null, 0);
  const values = rows.map(r => [r.user_id, r.title, r.message || null, r.type || null, r.ref_type || null, r.ref_id || null]);
  const sql = `
    INSERT INTO notifications (user_id, title, message, type, ref_type, ref_id)
    VALUES ?
  `;
  db.query(sql, [values], (err, res) => cb?.(err, res?.affectedRows || 0));
};

export const getMyNotifications = (req, res) => {
  const userId = req.user?.user_id || Number(req.params?.id);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const sql = `
    SELECT notification_id, title, message, type, ref_type, ref_id, is_read,
           DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC, notification_id DESC
  `;
  db.query(sql, [userId], (err, rows) => {
    if (err) return res.status(500).send('DB error: ' + err);
    res.json(rows || []);
  });
};

export const markNotificationRead = (req, res) => {
  const { id } = req.params;
  const userId = req.user?.user_id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const sql = `UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?`;
  db.query(sql, [id, userId], (err, result) => {
    if (err) return res.status(500).send('DB error: ' + err);
    res.json({ ok: true, updated: result?.affectedRows || 0 });
  });
};

export const markAllNotificationsRead = (req, res) => {
  const userId = req.user?.user_id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const sql = `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`;
  db.query(sql, [userId], (err, result) => {
    if (err) return res.status(500).send('DB error: ' + err);
    res.json({ ok: true, updated: result?.affectedRows || 0 });
  });
};



