// controllers/reportCounts.js
// ...existing code...
import db from '../db.js';
/**
 * Map status by BOTH lookup value and numeric fallback.
 * Adjust numeric codes below if your DB uses different ones.
 *   1 = pending
 *   2 = approved (completed)
 *   3 = rejected
 */
export const getStatusCountsByUser = (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT
      SUM(CASE
            WHEN (st.value = 'pending'  OR s.status = 1) THEN 1
            ELSE 0
          END) AS pending,
      SUM(CASE
            WHEN (st.value = 'approved' OR s.status = 2) THEN 1
            ELSE 0
          END) AS approved,
      SUM(CASE
            WHEN (st.value = 'rejected' OR s.status = 3) THEN 1
            ELSE 0
          END) AS rejected,
      COUNT(*) AS submitted
    FROM submission s
    LEFT JOIN status st ON st.status_id = s.status
    WHERE s.submitted_by = ?
  `;

  db.query(sql, [id], (err, rows) => {
    if (err) return res.status(500).send('DB error: ' + err);

    // If user has no submissions, return zeros
    const row = rows?.[0] || {};
    const pending  = Number(row.pending  || 0);
    const approved = Number(row.approved || 0);
    const rejected = Number(row.rejected || 0);
    const submitted = Number(row.submitted || 0);

    // "completed" == approved
    res.json({
      pending,
      approved,
      completed: approved,
      rejected,
      submitted
    });
  });
};


/**
 * OPTIONAL: counts limited to a time window based on report_assignment.to_date
 * Accepts query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD
 * If you don't need date filtering, you can skip this.
 */// ...existing code...

export const getStatusCountsByUserInRange = (req, res) => {
  const { id } = req.params;
  const { from, to } = req.query;

  // Validate YYYY-MM-DD
  const isYMD = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

  if ((from && !isYMD(from)) || (to && !isYMD(to))) {
    return res.status(400).json({ error: "Invalid 'from' or 'to' date. Use YYYY-MM-DD." });
  }

  // Build WHERE
  const whereParts = ['s.submitted_by = ?'];
  const params = [id];

  // Compare on DATE(ra.to_date) to ignore time/tz drift
  if (from) { whereParts.push('DATE(ra.to_date) >= ?'); params.push(from); }
  if (to)   { whereParts.push('DATE(ra.to_date) <= ?'); params.push(to); }

  const sql = `
    SELECT
      SUM(CASE WHEN (st.value = 'pending'  OR s.status = 1) THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN (st.value = 'approved' OR s.status = 2) THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN (st.value = 'rejected' OR s.status = 3) THEN 1 ELSE 0 END) AS rejected,
      COUNT(*) AS submitted
    FROM submission s
    JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
    LEFT JOIN status st       ON st.status_id = s.status
    WHERE ${whereParts.join(' AND ')}
  `;

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error('getStatusCountsByUserInRange SQL error:', err);
      return res.status(500).json({ error: 'DB error', detail: String(err) });
    }

    const row = rows?.[0] || {};
    const pending   = Number(row.pending  || 0);
    const approved  = Number(row.approved || 0);
    const rejected  = Number(row.rejected || 0);
    const submitted = Number(row.submitted || 0);

    res.json({
      pending,
      approved,
      completed: approved,
      rejected,
      submitted,
      range: { from: from || null, to: to || null }
    });
  });
};

