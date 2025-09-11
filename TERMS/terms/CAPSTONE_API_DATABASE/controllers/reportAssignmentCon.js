import db from '../db.js';

// GET all reports
export const getReports = (req, res) => {
  const sql = `
    SELECT
      ra.*,
      c.category_name,
      sc.sub_category_name,
      ud.name AS given_by_name
    FROM report_assignment ra
    JOIN category c           ON ra.category_id = c.category_id
    LEFT JOIN sub_category sc ON ra.sub_category_id = sc.sub_category_id
    LEFT JOIN user_details ud ON ra.given_by = ud.user_id
    ORDER BY ra.to_date DESC, ra.report_assignment_id DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).send('Database error: ' + err);
    res.json(results);
  });
};

// GET reports by user
export const getReportsByUser = (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT 
      COALESCE(sc.sub_category_name, c.category_name) AS report_name,
      ud.name AS given_by_name,
      -- If you use lookup tables, keep these LEFT JOINs; otherwise swap to raw ra.year/ra.quarter:
      sy.school_year,     
      qp.quarter,                 
      DATE_FORMAT(ra.from_date, '%m/%d/%Y') AS from_date,
      DATE_FORMAT(ra.to_date,   '%m/%d/%Y') AS to_date,
      ra.instruction,
      ra.is_given,
      ra.is_archived,
      ra.allow_late
    FROM report_assignment ra
    JOIN category c            ON ra.category_id = c.category_id
    LEFT JOIN sub_category sc  ON ra.sub_category_id = sc.sub_category_id
    JOIN user_details ud       ON ra.given_by = ud.user_id
    LEFT JOIN school_year sy   ON sy.year_id = ra.year
    LEFT JOIN quarter_period qp ON qp.quarter_period_id = ra.quarter
    WHERE ra.given_by = ?
    ORDER BY ra.to_date DESC, ra.report_assignment_id DESC
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
      c.category_name,
      sc.sub_category_name,
      COALESCE(sc.sub_category_name, c.category_name) AS report_name
    FROM report_assignment ra
    JOIN category c           ON ra.category_id = c.category_id
    LEFT JOIN sub_category sc ON ra.sub_category_id = sc.sub_category_id
    WHERE ra.report_assignment_id = ?
  `;

  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).send('Database error: ' + err);
    if (results.length === 0) return res.status(404).send('No reports found for the given ID.');
    res.json(results[0]);
  });
};

// POST (Give Report) + create blank submission(s) with form schema
export const giveReport = (req, res) => {
  const {
    category_id,
    sub_category_id,            // 👈 get this from body
    given_by = 5,
    quarter,
    year,
    from_date, // optional override
    to_date,
    instruction,
    is_given,
    is_archived,
    allow_late,

    // recipients
    submitted_by,
    assignees,

    // form-based assignment
    title,
    field_definitions = []
  } = req.body;

  // Validation
  if (category_id == null || quarter == null || year == null || !to_date) {
    return res.status(400).send('category_id, quarter, year, and to_date are required.');
  }
  if (!title || typeof title !== 'string') {
    return res.status(400).send('title is required (string).');
  }

  const recipients =
    Array.isArray(assignees) && assignees.length
      ? assignees
      : (submitted_by != null ? [submitted_by] : []);

  if (!recipients.length) {
    return res.status(400).send('Provide submitted_by or a non-empty assignees array.');
  }

  // Default to today (YYYY-MM-DD) if from_date not provided
  const fromDateValue = from_date
    ? new Date(from_date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // Initial fields JSON: form schema + empty answers
  const initialFields = JSON.stringify({
    _form: {
      title,
      fields: field_definitions
    },
    _answers: {}
  });

  db.query('START TRANSACTION', (txErr) => {
    if (txErr) return res.status(500).send('Failed to start transaction: ' + txErr);

    // 1) Insert report (now includes sub_category_id)
    const insertReportSql = `
      INSERT INTO report_assignment
        (category_id, sub_category_id, given_by, quarter, year, from_date, to_date, instruction, is_given, is_archived, allow_late)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const reportValues = [
      category_id,
      sub_category_id ?? null,
      given_by,
      quarter,
      year,
      fromDateValue,
      to_date,
      instruction,
      is_given,
      is_archived,
      allow_late
    ];

    db.query(insertReportSql, reportValues, (insErr, insRes) => {
      if (insErr) {
        return db.query('ROLLBACK', () =>
          res.status(500).send('Failed to insert report: ' + insErr)
        );
      }

      const report_assignment_id = insRes.insertId;

      // 2) Insert one blank submission per recipient
      const insertOne = (idx) => {
        if (idx >= recipients.length) {
          return db.query('COMMIT', (cErr) => {
            if (cErr) {
              return db.query('ROLLBACK', () =>
                res.status(500).send('Commit failed: ' + cErr)
              );
            }
            return res.status(201).json({
              report_assignment_id,
              submissions_created: recipients.length
            });
          });
        }

        const userId = recipients[idx];

        // Step A: compute next number_of_submission
        const nextNumSql = `
          SELECT COALESCE(MAX(number_of_submission), 0) + 1 AS next_num
          FROM submission
          WHERE submitted_by = ? AND category_id = ?
        `;
        db.query(nextNumSql, [userId, category_id], (numErr, numRes) => {
          if (numErr) {
            return db.query('ROLLBACK', () =>
              res.status(500).send('Failed to compute next submission number: ' + numErr)
            );
          }

          const nextNum = numRes?.[0]?.next_num || 1;

          // Step B: insert submission
          const insertSubmissionSql = `
            INSERT INTO submission
              (category_id, submitted_by, status, number_of_submission, value, date_submitted, fields /*, report_assignment_id */)
            VALUES
              (?, ?, 1, ?, ?, NOW(), ? /*, ? */)
          `;
          const subValues = [
            category_id,
            userId,
            nextNum,
            title,
            initialFields
            // report_assignment_id
          ];

          db.query(insertSubmissionSql, subValues, (subErr) => {
            if (subErr) {
              return db.query('ROLLBACK', () =>
                res.status(500).send('Failed to insert submission: ' + subErr)
              );
            }
            insertOne(idx + 1);
          });
        });
      };

      insertOne(0);
    });
  });
};

// POST /laempl/assign  (Give LAEMPL Report)
export const giveLAEMPLReport = (req, res) => {
  const {
    category_id,              // required
    sub_category_id,          // 👈 include this
    given_by = 5,
    quarter,                  // required
    year,                     // required
    from_date,                // optional (YYYY-MM-DD)
    to_date,                  // required (YYYY-MM-DD)
    instruction = null,
    is_given = 1,
    is_archived = 0,
    allow_late = 0,

    // recipients
    submitted_by,
    assignees,

    // LAEMPL-specific metadata
    title,                    // required (e.g., "LAEMPL - Grade 1")
    grade = 1
  } = req.body || {};

  if (category_id == null || quarter == null || year == null || !to_date) {
    return res.status(400).send('category_id, quarter, year, and to_date are required.');
  }
  if (!title || typeof title !== 'string') {
    return res.status(400).send('title is required (string).');
  }

  const recipients =
    Array.isArray(assignees) && assignees.length
      ? assignees
      : (submitted_by != null ? [submitted_by] : []);

  if (!recipients.length) {
    return res.status(400).send('Provide submitted_by or a non-empty assignees array.');
  }

  const TRAITS = ["Masipag","Matulungin","Masunurin","Magalang","Matapat","Matiyaga"];
  const COLS = [
    { key: "m" }, { key: "f" },
    { key: "gmrc" }, { key: "math" }, { key: "lang" }, { key: "read" }, { key: "makabasa" }
  ];

  const emptyRow = () => Object.fromEntries(COLS.map(c => [c.key, null]));
  const rowsSeed = TRAITS.map(trait => ({ trait, ...emptyRow() }));
  const totalsSeed = Object.fromEntries(COLS.map(c => [c.key, 0]));

  const initialFields = JSON.stringify({
    type: "LAEMPL",
    grade,
    rows: rowsSeed,
    totals: totalsSeed,
    meta: { createdAt: new Date().toISOString() }
  });

  const fromDateValue = from_date
    ? new Date(from_date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  db.query('START TRANSACTION', (txErr) => {
    if (txErr) return res.status(500).send('Failed to start transaction: ' + txErr);

    const insertReportSql = `
      INSERT INTO report_assignment
        (category_id, sub_category_id, given_by, quarter, year, from_date, to_date, instruction, is_given, is_archived, allow_late)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const reportValues = [
      category_id,
      sub_category_id ?? null,
      given_by,
      quarter,
      year,
      fromDateValue,
      to_date,
      instruction,
      is_given,
      is_archived,
      allow_late
    ];

    db.query(insertReportSql, reportValues, (insErr, insRes) => {
      if (insErr) {
        return db.query('ROLLBACK', () =>
          res.status(500).send('Failed to insert report: ' + insErr)
        );
      }

      const report_assignment_id = insRes.insertId;

      const insertOne = (idx) => {
        if (idx >= recipients.length) {
          return db.query('COMMIT', (cErr) => {
            if (cErr) {
              return db.query('ROLLBACK', () =>
                res.status(500).send('Commit failed: ' + cErr)
              );
            }
            return res.status(201).json({
              report_assignment_id,
              submissions_created: recipients.length
            });
          });
        }

        const userId = recipients[idx];

        const nextNumSql = `
          SELECT COALESCE(MAX(number_of_submission), 0) + 1 AS next_num
          FROM submission
          WHERE submitted_by = ? AND category_id = ?
        `;
        db.query(nextNumSql, [userId, category_id], (numErr, numRes) => {
          if (numErr) {
            return db.query('ROLLBACK', () =>
              res.status(500).send('Failed to compute next submission number: ' + numErr)
            );
          }

          const nextNum = numRes?.[0]?.next_num || 1;

          const insertSubmissionSql = `
            INSERT INTO submission
              (category_id, submitted_by, status, number_of_submission, value, date_submitted, fields /*, report_assignment_id */)
            VALUES
              (?, ?, 1, ?, ?, NOW(), ? /*, ? */)
          `;
          const subValues = [
            category_id,
            userId,
            nextNum,
            title,
            initialFields
            // report_assignment_id
          ];

          db.query(insertSubmissionSql, subValues, (subErr) => {
            if (subErr) {
              return db.query('ROLLBACK', () =>
                res.status(500).send('Failed to insert submission: ' + subErr)
              );
            }
            insertOne(idx + 1);
          });
        });
      };

      insertOne(0);
    });
  });
};
// PATCH report
export const patchReport = (req, res) => {
  const { id } = req.params;
  const {
    category_id,
    sub_category_id,   // 👈 allow updating this
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

  if (category_id !== undefined)    { updates.push('category_id = ?');     values.push(category_id); }
  if (sub_category_id !== undefined){ updates.push('sub_category_id = ?'); values.push(sub_category_id); }
  if (given_by !== undefined)       { updates.push('given_by = ?');        values.push(given_by); }
  if (quarter !== undefined)        { updates.push('quarter = ?');         values.push(quarter); }
  if (year !== undefined)           { updates.push('year = ?');            values.push(year); }
  if (from_date !== undefined)      { updates.push('from_date = ?');       values.push(from_date); }
  if (to_date !== undefined)        { updates.push('to_date = ?');         values.push(to_date); }
  if (instruction !== undefined)    { updates.push('instruction = ?');     values.push(instruction); }
  if (is_given !== undefined)       { updates.push('is_given = ?');        values.push(is_given); }
  if (is_archived !== undefined)    { updates.push('is_archived = ?');     values.push(is_archived); }
  if (allow_late !== undefined)     { updates.push('allow_late = ?');      values.push(allow_late); }

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
