import db from '../db.js';

export const getSubCategoriesByCategoryId = (req, res) => {
  const categoryId = req.params.categoryId;
  const sql = 'SELECT sub_category_id, sub_category_name FROM sub_category WHERE category_id = ?';

  db.query(sql, [categoryId], (err, results) => {
    if (err) return res.status(500).send('Database error: ' + err);
    res.json(results);
  });
};
