import db from '../db.js';

// Pending reports for a specific user
export const getPendingReportsByUser = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT s.*, ra.title, ra.to_date, st.value AS status_value
    FROM submission s
    JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
    JOIN status st ON st.status_id = s.status
    WHERE s.submitted_by = ? AND st.value = 'pending'
    ORDER BY ra.to_date DESC, s.number_of_submission DESC
  `;
  db.query(sql, [id], (err, rows) => {
    if (err) return res.status(500).send("DB error: " + err);
    if (!rows.length) return res.status(404).send("No pending reports.");
    res.json(rows);
  });
};

// Upcoming deadlines for a specific user
export const getUpcomingDeadlinesByUser = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT 
      s.submission_id,
      s.submitted_by,
      ra.report_assignment_id,
      ra.title,
      ra.instruction,
      ra.from_date,
      ra.to_date,
      st.value AS status_value
    FROM submission s
    JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
    JOIN status st ON st.status_id = s.status
    WHERE s.submitted_by = ?
      AND ra.to_date >= NOW()          -- still open
      AND (st.value = 'pending')       -- still not finished
    ORDER BY ra.to_date ASC
  `;
  db.query(sql, [id], (err, rows) => {
    if (err) return res.status(500).send("DB error: " + err);
    if (!rows.length) return res.status(404).send("No upcoming deadlines.");
    res.json(rows);
  });
};

// Completed reports for a specific user
export const getCompletedReportsByUser = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT s.*, ra.title, ra.to_date, st.value AS status_value
    FROM submission s
    JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
    JOIN status st ON st.status_id = s.status
    WHERE s.submitted_by = ? AND st.value = 'approved'
    ORDER BY ra.to_date DESC, s.number_of_submission DESC
  `;
  db.query(sql, [id], (err, rows) => {
    if (err) return res.status(500).send("DB error: " + err);
    if (!rows.length) return res.status(404).send("No approved/completed reports.");
    res.json(rows);
  });
};
