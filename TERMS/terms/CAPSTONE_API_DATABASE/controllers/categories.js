import db from '../db.js';

// GET all categories
export const getCategories = (req, res) => {
  const sql = 'SELECT category_id, category_name FROM category';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).send('Database error: ' + err);
    res.json(results);
  });
};
