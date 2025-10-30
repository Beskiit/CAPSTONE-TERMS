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
      ra.category_id,
      ra.sub_category_id,
      c.category_name,
      sc.sub_category_name,
      st.value AS status_value,
      s.status,
      s.fields
    FROM submission s
    JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
    JOIN status st ON st.status_id = s.status
    JOIN category c ON c.category_id = ra.category_id
    LEFT JOIN sub_category sc ON sc.sub_category_id = ra.sub_category_id
    WHERE s.submitted_by = ?
      AND ra.to_date >= NOW()
      AND ra.is_given = 1
      AND (LOWER(st.value) = 'pending' OR s.status = 1 OR s.status = 4)
    ORDER BY ra.to_date ASC, ra.report_assignment_id ASC
  `;
  db.query(sql, [id], (err, rows) => {
    if (err) return res.status(500).send("DB error: " + err);
    
    // Process rows to add rejection information
    const processedRows = (rows || []).map(row => {
      const processedRow = { ...row };
      
      // Parse fields to get rejection information
      try {
        const fields = typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields || {};
        processedRow.rejection_reason = fields.rejection_reason;
        processedRow.extended_due_date = fields.extended_due_date;
        processedRow.original_due_date = fields.original_due_date;
        processedRow.rejected_at = fields.rejected_at;
      } catch (e) {
        // If parsing fails, set empty values
        processedRow.rejection_reason = null;
        processedRow.extended_due_date = null;
        processedRow.original_due_date = null;
        processedRow.rejected_at = null;
      }
      
      return processedRow;
    });
    
    // Return empty list with 200 so frontend can show friendly message
    return res.json(processedRows);
  });
};

// Completed reports for a specific user
export const getCompletedReportsByUser = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT 
      s.*, 
      ra.title, 
      ra.to_date, 
      st.value AS status_value
    FROM submission s
    JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
    JOIN status st ON st.status_id = s.status
    WHERE s.submitted_by = ?
      AND (LOWER(st.value) = 'approved' OR LOWER(st.value) = 'completed')
    ORDER BY ra.to_date DESC, s.number_of_submission DESC
  `;

  db.query(sql, [id], (err, rows) => {
    if (err) return res.status(500).send("DB error: " + err);
    if (!rows.length) return res.status(404).send("No approved/completed reports.");
    res.json(rows);
  });
};
