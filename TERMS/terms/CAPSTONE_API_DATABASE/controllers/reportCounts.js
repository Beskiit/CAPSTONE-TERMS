// controllers/reportCounts.js
// ...existing code...
import db from '../db.js';

export const getStatusCountsByUserInRange = (req, res) => {
  const { id } = req.params;
  const { from, to } = req.query;

  const isYMD = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if ((from && !isYMD(from)) || (to && !isYMD(to))) {
    return res.status(400).json({ error: "Invalid 'from' or 'to' date. Use YYYY-MM-DD." });
  }

  const whereParts = ['s.submitted_by = ?'];
  const params = [id, id]; // Add id twice: once for submitted_by, once for given_by check in pending count
  if (from) { whereParts.push('DATE(ra.to_date) >= ?'); params.push(from); }
  if (to)   { whereParts.push('DATE(ra.to_date) <= ?'); params.push(to); }

  const sql = `
    SELECT
      SUM(CASE WHEN (LOWER(st.value) IN ('pending','for review') OR s.status = 1) AND NOT (
        ra.parent_report_assignment_id IS NULL 
        AND ra.given_by = ?
        AND (ra.category_id = 0 OR (ra.category_id = 1 AND ra.sub_category_id = 3))
      ) THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN LOWER(st.value) = 'completed' OR s.status = 2 THEN 1 ELSE 0 END) AS completed_only,
      SUM(CASE WHEN LOWER(st.value) = 'approved'  OR s.status = 3 THEN 1 ELSE 0 END) AS approved_only,
      SUM(CASE WHEN LOWER(st.value) = 'rejected'  OR s.status = 4 THEN 1 ELSE 0 END) AS rejected,
      COUNT(*) AS submitted
    FROM submission s
    JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
    LEFT JOIN status st       ON st.status_id = s.status
    WHERE ${whereParts.join(' AND ')}
  `;

  //AIRONE GAMIl

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error('getStatusCountsByUserInRange SQL error:', err);
      return res.status(500).json({ error: 'DB error', detail: String(err) });
    }

    const r = rows?.[0] || {};
    const pending   = Number(r.pending || 0);
    const completed = Number(r.completed_only || 0);
    const approvedStrict = Number(r.approved_only || 0);
    const approved  = approvedStrict + completed;   // combined
    const rejected  = Number(r.rejected || 0);
    const submitted = Number(r.submitted || 0);

    res.json({
      pending,
      approved,          // combined
      completed,         // separate completed
      rejected,
      submitted,
      range: { from: from || null, to: to || null }
    });
  });
};


export const getStatusCountsByUser = (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT
      SUM(CASE WHEN s.status = 1 AND NOT (
        ra.parent_report_assignment_id IS NULL 
        AND ra.given_by = ?
        AND (ra.category_id = 0 OR (ra.category_id = 1 AND ra.sub_category_id = 3))
      ) THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN s.status = 2 THEN 1 ELSE 0 END) AS submitted,
      SUM(CASE WHEN s.status = 3 THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN s.status = 4 THEN 1 ELSE 0 END) AS rejected,
      COUNT(*) AS total
    FROM submission s
    JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
    WHERE s.submitted_by = ?
  `;

  db.query(sql, [id, id], (err, rows) => {
    if (err) return res.status(500).send("DB error: " + err);
    const r = rows?.[0] || {};
    const pending   = Number(r.pending || 0);
    const submitted = Number(r.submitted || 0);
    const approved  = Number(r.approved || 0);
    const rejected  = Number(r.rejected || 0);
    const total     = Number(r.total || 0);

    // Keep keys your UI already expects
    res.json({
      submitted,
      pending,
      approved,
      rejected,
      total
    });
  });
};
