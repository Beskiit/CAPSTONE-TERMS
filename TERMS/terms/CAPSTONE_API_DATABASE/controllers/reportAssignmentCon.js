import db from '../db.js';

// GET all reports
export const getReports = (req, res) => {
  const sql = 'SELECT * FROM report_assignment';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).send('Database error: ' + err);
    res.json(results);
  });
};

// GET reports by user (removing given_to logic)
export const getReportsByUser = (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT 
      rt.report_name,
      ud.name AS given_by_name,
      sy.school_year,     
      qp.quarter,                 
      DATE_FORMAT(ra.from_date, '%m/%d/%Y') AS from_date,
      DATE_FORMAT(ra.to_date, '%m/%d/%Y') AS to_date,
      ra.instruction,
      ra.is_given,
      ra.is_archived,
      ra.allow_late
    FROM report_assignment ra
    JOIN category c ON ra.category_id = c.category_id
    JOIN report_type rt ON c.report_type_id = rt.report_type_id
    JOIN user_details ud ON ra.given_by = ud.user_id
    JOIN year_and_quarter yq ON ra.quarter = yq.yr_and_qtr_id
    JOIN school_year sy ON yq.year = sy.year_id
    JOIN quarter_period qp ON yq.quarter = qp.quarter_period_id
    WHERE ra.given_by = ?
  `;

  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).send('Database error: ' + err);
    if (results.length === 0) return res.status(404).send('No reports found for the given user.');
    res.json(results);
  });
};

// GET single report by ID
export const getReport = (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT 
      ra.*, 
      c.report_type_id,
      rt.report_name
    FROM report_assignment ra
    JOIN category c ON ra.category_id = c.category_id
    JOIN report_type rt ON c.report_type_id = rt.report_type_id
    WHERE ra.report_assignment_id = ?
  `;

  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).send('Database error: ' + err);
    if (results.length === 0) return res.status(404).send('No reports found for the given ID.');
    res.json(results);
  });
};

// POST (Give Report)
export const giveReport = (req, res) => {
  const {
    category_id,
    given_by = 5, // Default to 5 if not provided
    quarter,
    year,
    to_date,
    instruction,
    is_given,
    is_archived,
    allow_late
  } = req.body;

  const from_date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const sql = `
    INSERT INTO report_assignment 
    (category_id, given_by, quarter, year, from_date, to_date, instruction, is_given, is_archived, allow_late) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    category_id,
    given_by, // will be 5 if not provided in the request
    quarter,
    year,
    from_date,
    to_date,
    instruction,
    is_given,
    is_archived,
    allow_late
  ];

  db.query(sql, values, (err) => {
    if (err) return res.status(500).send('Failed to insert report: ' + err);
    res.send('Report assignment created successfully.');
  });
};

// PATCH report
export const patchReport = (req, res) => {
  const { id } = req.params;
  const {
    category_id,
    given_by,
    quarter,
    year,
    from_date,
    to_date,
    instruction,
    is_given,
    is_archived,
    allow_late
  } = req.body;

  const updates = [];
  const values = [];

  if (category_id !== undefined) {
    updates.push('category_id = ?');
    values.push(category_id);
  }
  if (given_by !== undefined) {
    updates.push('given_by = ?');
    values.push(given_by);
  }
  if (quarter !== undefined) {
    updates.push('quarter = ?');
    values.push(quarter);
  }
  if (year !== undefined) {
    updates.push('year = ?');
    values.push(year);
  }
  if (from_date !== undefined) {
    updates.push('from_date = ?');
    values.push(from_date);
  }
  if (to_date !== undefined) {
    updates.push('to_date = ?');
    values.push(to_date);
    console.log("Updating to_date:", to_date); // Debug
  }
  if (instruction !== undefined) {
    updates.push('instruction = ?');
    values.push(instruction);
  }
  if (is_given !== undefined) {
    updates.push('is_given = ?');
    values.push(is_given);
  }
  if (is_archived !== undefined) {
    updates.push('is_archived = ?');
    values.push(is_archived);
  }
  if (allow_late !== undefined) {
    updates.push('allow_late = ?');
    values.push(allow_late);
  }

  if (updates.length === 0) {
    return res.status(400).send('No fields provided for update.');
  }

  const sql = `UPDATE report_assignment SET ${updates.join(', ')} WHERE report_assignment_id = ?`;
  values.push(id);

  db.query(sql, values, (err) => {
    if (err) return res.status(500).send('Update failed: ' + err);
    res.send(`Report with ID ${id} has been updated.`);
  });
};

// DELETE report
export const deleteReport = (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM report_assignment WHERE report_assignment_id = ?';
  db.query(sql, [id], (err) => {
    if (err) return res.status(500).send('Delete failed: ' + err);
    res.send(`Report with ID ${id} has been deleted.`);
  });
};
