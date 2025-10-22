// controllers/reportAssignmentCon.js
import db from '../db.js';

/* =========================
   LIST / READ
========================= */

// GET all reports
export const getReports = (req, res) => {
  const sql = `
     SELECT
      ra.*,
      c.category_name,
      sc.sub_category_name,
      ud.name AS given_by_name
    FROM report_assignment ra
    JOIN category c            ON ra.category_id = c.category_id
    LEFT JOIN sub_category sc  ON ra.sub_category_id = sc.sub_category_id
    LEFT JOIN user_details ud  ON ra.given_by = ud.user_id
    ORDER BY ra.to_date DESC, ra.report_assignment_id DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).send('Database error: ' + err);
    res.json(results);
  });
};

// GET reports by user (teacher)
export const getReportsByUser = (req, res) => {
  const { id } = req.params;
  const sql = `
  SELECT
    s.submission_id,
    s.report_assignment_id,
    s.category_id,
    s.submitted_by,
    s.number_of_submission,
    s.status,
    s.value AS submission_title,
    DATE_FORMAT(s.date_submitted, '%m/%d/%Y') AS date_submitted,

    ra.report_assignment_id,
    ra.title AS assignment_title,
    DATE_FORMAT(ra.from_date, '%m/%d/%Y') AS from_date,
    DATE_FORMAT(ra.to_date,   '%m/%d/%Y') AS to_date,
    ra.instruction,
    ra.allow_late,
    ra.is_given,
    ra.is_archived,
    qp.quarter,
    sy.school_year,

    c.category_name,
    sc.sub_category_name,
    COALESCE(sc.sub_category_name, c.category_name) AS report_name,

    ud.name AS given_by_name
  FROM submission s
  JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
  JOIN category c           ON ra.category_id = c.category_id
  LEFT JOIN sub_category sc ON ra.sub_category_id = sc.sub_category_id
  LEFT JOIN user_details ud ON ra.given_by = ud.user_id
  LEFT JOIN school_year sy  ON sy.year_id = ra.year
  LEFT JOIN quarter_period qp ON qp.quarter_period_id = ra.quarter
  WHERE s.submitted_by = ?
  ORDER BY ra.to_date DESC, ra.report_assignment_id DESC, s.number_of_submission DESC
`;
  db.query(sql, [id], (err, rows) => {
    if (err) return res.status(500).send('Database error: ' + err);
    res.json(rows || []);
  });
};

// GET reports assigned by a coordinator (for coordinators)
export const getReportsAssignedByUser = (req, res) => {
  const { id } = req.params;
  const sql = `
  SELECT
    s.submission_id,
    s.report_assignment_id,
    s.category_id,
    s.submitted_by,
    s.number_of_submission,
    s.status,
    s.value AS submission_title,
    DATE_FORMAT(s.date_submitted, '%m/%d/%Y') AS date_submitted,

    ra.report_assignment_id,
    ra.title AS assignment_title,
    DATE_FORMAT(ra.from_date, '%m/%d/%Y') AS from_date,
    DATE_FORMAT(ra.to_date, '%m/%d/%Y') AS to_date,
    ra.instruction,
    ra.allow_late,
    ra.is_given,
    ra.is_archived,
    qp.quarter,
    sy.school_year,

    c.category_name,
    sc.sub_category_name,
    COALESCE(sc.sub_category_name, c.category_name) AS report_name,

    ud.name  AS submitted_by_name,   -- teacher
    ud2.name AS given_by_name        -- coordinator
  FROM submission s
  JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
  JOIN category c           ON ra.category_id = c.category_id
  LEFT JOIN sub_category sc ON ra.sub_category_id = sc.sub_category_id
  LEFT JOIN user_details ud  ON s.submitted_by = ud.user_id
  LEFT JOIN user_details ud2 ON ra.given_by    = ud2.user_id
  LEFT JOIN school_year sy ON sy.year_id = ra.year
  LEFT JOIN quarter_period qp ON qp.quarter_period_id = ra.quarter
  WHERE ra.given_by = ?
  ORDER BY ra.to_date DESC, ra.report_assignment_id DESC, s.number_of_submission DESC
`;
  db.query(sql, [id], (err, rows) => {
    if (err) return res.status(500).send('Database error: ' + err);
    res.json(rows || []);
  });
};

// GET single report
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

/* =========================
   HELPERS
========================= */

function isAutoLike(v) {
  if (v == null || v === '') return true;
  const s = String(v).toLowerCase();
  return s === 'auto' || s === 'unlimited';
}

// compute next attempt using the SAME connection
function computeNextNumConn(conn, userId, reportAssignmentId, cb) {
  const sql = `
    SELECT COALESCE(MAX(number_of_submission), 0) + 1 AS next_num
    FROM submission
    WHERE submitted_by = ? AND report_assignment_id = ?
  `;
  conn.query(sql, [userId, reportAssignmentId], (err, rows) => {
    if (err) return cb(err);
    cb(null, rows?.[0]?.next_num || 1);
  });
}

/* =========================
   CREATE (GENERIC / MPS)
========================= */

// POST /reports/give
export const giveReport = (req, res) => {
  const authenticatedUserId = req.user?.user_id;
  if (!authenticatedUserId) return res.status(401).send('Authentication required');

  const {
    category_id,
    sub_category_id,                 // optional (exists in assignment)
    given_by = authenticatedUserId,
    quarter,
    year,
    from_date,
    to_date,
    instruction = null,
    is_given = 1,
    is_archived = 0,
    allow_late = 0,

    // recipients
    submitted_by,
    assignees,

    // generic form
    title,
    field_definitions = [],

    // attempts
    number_of_submission,
    number_of_submissions
  } = req.body || {};

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

  const hasPerRecipientNos = Array.isArray(number_of_submissions);
  if (hasPerRecipientNos && number_of_submissions.length !== recipients.length) {
    return res.status(400).send('number_of_submissions length must match assignees length.');
  }

  const fromDateValue = from_date
    ? new Date(from_date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const _is_given    = Number(Boolean(is_given));
  const _is_archived = Number(Boolean(is_archived));
  const _allow_late  = Number(Boolean(allow_late));

  const initialFields = JSON.stringify({
    _form: { title, fields: field_definitions },
    _answers: {}
  });

  db.getConnection((connErr, conn) => {
    if (connErr) return res.status(500).send('DB connect error: ' + connErr.message);

    conn.beginTransaction((txErr) => {
      if (txErr) { conn.release(); return res.status(500).send('Begin TX error: ' + txErr.message); }

      // 1) Insert assignment
      const insertReportSql = `
        INSERT INTO report_assignment
          (category_id, sub_category_id, given_by, quarter, year, from_date, to_date, instruction, is_given, is_archived, allow_late, title)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const raVals = [
        category_id,
        sub_category_id ?? null,
        given_by,
        quarter,
        year,
        fromDateValue,
        to_date,
        instruction,
        _is_given,
        _is_archived,
        _allow_late,
        title
      ];

      conn.query(insertReportSql, raVals, (raErr, raRes) => {
        if (raErr) {
          return conn.rollback(() => { conn.release(); res.status(500).send('Failed to insert report: ' + raErr.message); });
        }

        const report_assignment_id = raRes.insertId;

        // 2) Insert one blank submission per recipient (NO sub_category_id column in table)
        const insertAt = (idx) => {
          if (idx >= recipients.length) {
            return conn.query(
              'SELECT submission_id FROM submission WHERE report_assignment_id = ?',
              [report_assignment_id],
              (selErr, rows) => {
                if (selErr) {
                  return conn.rollback(() => { conn.release(); res.status(500).send('Select submission ids error: ' + selErr.message); });
                }
                conn.commit((cErr) => {
                  if (cErr) {
                    return conn.rollback(() => { conn.release(); res.status(500).send('Commit error: ' + cErr.message); });
                  }
                  conn.release();
                  res.status(201).json({
                    report_assignment_id,
                    submission_ids: rows.map(r => r.submission_id)
                  });
                });
              }
            );
          }

          const userId = recipients[idx];
          const desiredRaw = hasPerRecipientNos
            ? number_of_submissions[idx]
            : number_of_submission;

          const proceedInsert = (finalNo) => {
            const insertSubmissionSql = `
              INSERT INTO submission
                (report_assignment_id, category_id, submitted_by, status, number_of_submission, value, date_submitted, fields)
              VALUES
                (?, ?, ?, 1, ?, ?, NOW(), ?)
            `;
            const subVals = [
              report_assignment_id,
              category_id,
              userId,
              finalNo,
              title,
              initialFields
            ];

            conn.query(insertSubmissionSql, subVals, (subErr, subRes) => {
              if (subErr) {
                return conn.rollback(() => { conn.release(); res.status(500).send('Failed to insert submission: ' + subErr.message); });
              }
              insertAt(idx + 1);
            });
          };

          if (isAutoLike(desiredRaw)) {
            computeNextNumConn(conn, userId, report_assignment_id, (nErr, nextNum) => {
              if (nErr) {
                return conn.rollback(() => { conn.release(); res.status(500).send('Failed to compute next submission number: ' + nErr.message); });
              }
              proceedInsert(nextNum);
            });
          } else {
            const n = Number(desiredRaw);
            if (Number.isFinite(n) && n > 0) proceedInsert(n);
            else {
              return conn.rollback(() => { conn.release(); res.status(400).send('Invalid number_of_submission value.'); });
            }
          }
        };

        insertAt(0);
      });
    });
  });
};

/* =========================
   CREATE (LAEMPL)
========================= */

// POST /reports/laempl
// Give LAEMPL & MPS report with subject selection
export const giveLAEMPLMPSReport = (req, res) => {
  const authenticatedUserId = req.user?.user_id;
  if (!authenticatedUserId) return res.status(401).send('Authentication required');

  const {
    category_id,
    sub_category_id,
    given_by = authenticatedUserId,
    quarter,
    year,
    from_date,
    to_date,
    instruction = null,
    is_given = 1,
    is_archived = 0,
    allow_late = 0,
    submitted_by,
    assignees,
    title,
    grade_level_id,
    subject_ids = [], // Array of subject IDs
    number_of_submission,
    number_of_submissions
  } = req.body || {};

  // Validation
  if (category_id == null || quarter == null || year == null || !to_date) {
    return res.status(400).send('category_id, quarter, year, and to_date are required.');
  }
  if (!title || typeof title !== 'string') {
    return res.status(400).send('title is required (string).');
  }
  if (!grade_level_id) {
    return res.status(400).send('grade_level_id is required for LAEMPL & MPS.');
  }
  if (!Array.isArray(subject_ids) || subject_ids.length === 0) {
    return res.status(400).send('subject_ids array is required for LAEMPL & MPS.');
  }

  const recipients =
    Array.isArray(assignees) && assignees.length
      ? assignees
      : (submitted_by != null ? [submitted_by] : []);

  if (!recipients.length) {
    return res.status(400).send('Provide submitted_by or a non-empty assignees array.');
  }

  const hasPerRecipientNos = Array.isArray(number_of_submissions);
  if (hasPerRecipientNos && number_of_submissions.length !== recipients.length) {
    return res.status(400).send('number_of_submissions length must match assignees length.');
  }

  const fromDateValue = from_date
    ? new Date(from_date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const _is_given    = Number(Boolean(is_given));
  const _is_archived = Number(Boolean(is_archived));
  const _allow_late  = Number(Boolean(allow_late));

  db.getConnection((connErr, conn) => {
    if (connErr) return res.status(500).send('DB connect error: ' + connErr.message);

    conn.beginTransaction((txErr) => {
      if (txErr) { conn.release(); return res.status(500).send('Begin TX error: ' + txErr.message); }

      // Create assignments for each subject
      const createAssignments = async () => {
        const results = [];
        
        for (const subject_id of subject_ids) {
          // Get subject name for title
          const subjectQuery = `SELECT subject_name FROM subject WHERE subject_id = ?`;
          const subjectResult = await new Promise((resolve, reject) => {
            conn.query(subjectQuery, [subject_id], (err, results) => {
              if (err) reject(err);
              else resolve(results);
            });
          });

          const subjectName = subjectResult[0]?.subject_name || 'Unknown Subject';
          const assignmentTitle = `${title} - ${subjectName}`;

          // Insert assignment for this subject
          const insertReportSql = `
            INSERT INTO report_assignment
              (category_id, sub_category_id, given_by, quarter, year, from_date, to_date, instruction, is_given, is_archived, allow_late, title)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          const raVals = [
            category_id,
            sub_category_id ?? null,
            given_by,
            quarter,
            year,
            fromDateValue,
            to_date,
            instruction,
            _is_given,
            _is_archived,
            _allow_late,
            assignmentTitle
          ];

          const assignmentResult = await new Promise((resolve, reject) => {
            conn.query(insertReportSql, raVals, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });

          const report_assignment_id = assignmentResult.insertId;

          // Create submissions for each recipient for this subject
          for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            const nos = hasPerRecipientNos ? number_of_submissions[i] : (number_of_submission || 1);

            const insertSubmissionSql = `
              INSERT INTO submission
                (report_assignment_id, category_id, submitted_by, status, number_of_submission, value, fields)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            const submissionVals = [
              report_assignment_id,
              category_id,
              recipient,
              1, // pending status
              nos,
              assignmentTitle,
              JSON.stringify({
                type: "LAEMPL",
                grade: grade_level_id,
                subject_id: subject_id,
                subject_name: subjectName,
                rows: [],
                totals: {},
                meta: { createdAt: new Date().toISOString() }
              })
            ];

            await new Promise((resolve, reject) => {
              conn.query(insertSubmissionSql, submissionVals, (err, result) => {
                if (err) reject(err);
                else resolve(result);
              });
            });
          }

          results.push({
            report_assignment_id,
            subject_id,
            subject_name: subjectName,
            title: assignmentTitle
          });
        }

        return results;
      };

      createAssignments()
        .then((results) => {
          conn.commit((commitErr) => {
            conn.release();
            if (commitErr) {
              return res.status(500).send('Commit error: ' + commitErr.message);
            }
            res.json({
              success: true,
              message: `Created ${results.length} LAEMPL & MPS assignments`,
              assignments: results
            });
          });
        })
        .catch((error) => {
          conn.rollback(() => {
            conn.release();
            res.status(500).send('Error creating assignments: ' + error.message);
          });
        });
    });
  });
};

export const giveLAEMPLReport = (req, res) => {
  const authenticatedUserId = req.user?.user_id;
  if (!authenticatedUserId) return res.status(401).send('Authentication required');

  const {
    category_id,              // required
    sub_category_id,          // optional (in assignment only)
    given_by = authenticatedUserId,
    quarter,                  // required
    year,                     // required
    from_date,                // optional
    to_date,                  // required
    instruction = null,
    is_given = 1,
    is_archived = 0,
    allow_late = 0,

    // recipients
    submitted_by,
    assignees,

    title,                    // required
    grade = 1,

    number_of_submission,
    number_of_submissions
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

  const hasPerRecipientNos = Array.isArray(number_of_submissions);
  if (hasPerRecipientNos && number_of_submissions.length !== recipients.length) {
    return res.status(400).send('number_of_submissions length must match assignees length.');
  }

  // LAEMPL seed
  const TRAITS = ["Masipag","Matulungin","Masunurin","Magalang","Matapat","Matiyaga"];
  const COLS   = [{ key: "m" }, { key: "f" }, { key: "gmrc" }, { key: "math" }, { key: "lang" }, { key: "read" }, { key: "makabasa" }];
  const emptyRow   = () => Object.fromEntries(COLS.map(c => [c.key, null]));
  const rowsSeed   = TRAITS.map(trait => ({ trait, ...emptyRow() }));
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

  const _is_given    = Number(Boolean(is_given));
  const _is_archived = Number(Boolean(is_archived));
  const _allow_late  = Number(Boolean(allow_late));

  db.getConnection((connErr, conn) => {
    if (connErr) return res.status(500).send('DB connect error: ' + connErr.message);

    conn.beginTransaction((txErr) => {
      if (txErr) { conn.release(); return res.status(500).send('Begin TX error: ' + txErr.message); }

      const insertReportSql = `
        INSERT INTO report_assignment
          (category_id, sub_category_id, given_by, quarter, year, from_date, to_date, instruction, is_given, is_archived, allow_late, title)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const raVals = [
        category_id,
        sub_category_id ?? null,
        given_by,
        quarter,
        year,
        fromDateValue,
        to_date,
        instruction,
        _is_given,
        _is_archived,
        _allow_late,
        title
      ];

      conn.query(insertReportSql, raVals, (raErr, raRes) => {
        if (raErr) {
          return conn.rollback(() => { conn.release(); res.status(500).send('Failed to insert report: ' + raErr.message); });
        }

        const report_assignment_id = raRes.insertId;

        const insertOne = (idx) => {
          if (idx >= recipients.length) {
            return conn.query(
              'SELECT submission_id FROM submission WHERE report_assignment_id = ?',
              [report_assignment_id],
              (selErr, rows) => {
                if (selErr) {
                  return conn.rollback(() => { conn.release(); res.status(500).send('Select submission ids error: ' + selErr.message); });
                }
                conn.commit((cErr) => {
                  if (cErr) {
                    return conn.rollback(() => { conn.release(); res.status(500).send('Commit error: ' + cErr.message); });
                  }
                  conn.release();
                  res.status(201).json({
                    report_assignment_id,
                    submission_ids: rows.map(r => r.submission_id)
                  });
                });
              }
            );
          }

          const userId = recipients[idx];
          const desiredRaw = hasPerRecipientNos
            ? number_of_submissions[idx]
            : number_of_submission;

          const proceedInsert = (finalNo) => {
            const insertSubmissionSql = `
              INSERT INTO submission
                (report_assignment_id, category_id, submitted_by, status, number_of_submission, value, date_submitted, fields)
              VALUES
                (?, ?, ?, 1, ?, ?, NOW(), ?)
            `;
            const subVals = [
              report_assignment_id,
              category_id,
              userId,
              finalNo,
              title,
              initialFields
            ];

            conn.query(insertSubmissionSql, subVals, (subErr) => {
              if (subErr) {
                return conn.rollback(() => { conn.release(); res.status(500).send('Failed to insert submission: ' + subErr.message); });
              }
              insertOne(idx + 1);
            });
          };

          if (isAutoLike(desiredRaw)) {
            computeNextNumConn(conn, userId, report_assignment_id, (nErr, nextNum) => {
              if (nErr) {
                return conn.rollback(() => { conn.release(); res.status(500).send('Failed to compute next submission number: ' + nErr.message); });
              }
              proceedInsert(nextNum);
            });
          } else {
            const n = Number(desiredRaw);
            if (Number.isFinite(n) && n > 0) proceedInsert(n);
            else {
              return conn.rollback(() => { conn.release(); res.status(400).send('Invalid number_of_submission value.'); });
            }
          }
        };

        insertOne(0);
      });
    });
  });
};

/* =========================
   UPDATE / DELETE
========================= */

// PATCH report (also set linked submissions.status = 2)
export const patchReport = (req, res) => {
  const { id } = req.params;
  const {
    category_id,
    sub_category_id,
    given_by,
    quarter,
    year,
    from_date,
    to_date,
    instruction,
    is_given,
    is_archived,
    allow_late,
    title
  } = req.body || {};

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
  if (title !== undefined)          { updates.push('title = ?');           values.push(title); }

  if (updates.length === 0) {
    return res.status(400).send('No fields provided for update.');
  }

  db.getConnection((connErr, conn) => {
    if (connErr) return res.status(500).send('DB connect error: ' + connErr.message);

    conn.beginTransaction((txErr) => {
      if (txErr) { conn.release(); return res.status(500).send('Begin TX error: ' + txErr.message); }

      const sqlUpdateReport = `UPDATE report_assignment SET ${updates.join(', ')} WHERE report_assignment_id = ?`;
      const reportVals = [...values, id];

      conn.query(sqlUpdateReport, reportVals, (updErr, updRes) => {
        if (updErr) {
          return conn.rollback(() => { conn.release(); res.status(500).send('Update failed: ' + updErr.message); });
        }

        const sqlFlipSubs = `
          UPDATE submission s
          SET s.status = 2
          WHERE s.report_assignment_id = ?
        `;
        conn.query(sqlFlipSubs, [id], (flipErr, flipRes) => {
          if (flipErr) {
            return conn.rollback(() => { conn.release(); res.status(500).send('Failed to update submission statuses: ' + flipErr.message); });
          }

          conn.commit((cErr) => {
            if (cErr) {
              return conn.rollback(() => { conn.release(); res.status(500).send('Commit failed: ' + cErr.message); });
            }
            conn.release();
            return res.json({
              message: `Report ${id} updated. Linked submissions set to status=2.`,
              report_updated_rows: updRes.affectedRows,
              submissions_updated_rows: flipRes.affectedRows
            });
          });
        });
      });
    });
  });
};

// DELETE report
// Give LAEMPL & MPS report for coordinators (single submission with all subjects)
export const giveLAEMPLMPSCoordinatorReport = (req, res) => {
  const authenticatedUserId = req.user?.user_id;
  if (!authenticatedUserId) return res.status(401).send('Authentication required');

  const {
    category_id, sub_category_id, given_by = authenticatedUserId, quarter, year, from_date, to_date,
    instruction = null, is_given = 1, is_archived = 0, allow_late = 0, submitted_by, assignees, title,
    grade_level_id, number_of_submission, number_of_submissions
  } = req.body || {};

  if (!category_id || !sub_category_id || !quarter || !year || !from_date || !to_date || !assignees || !title || !grade_level_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const recipients = Array.isArray(assignees) ? assignees : [assignees];
  const hasPerRecipientNos = Array.isArray(number_of_submissions) && number_of_submissions.length === recipients.length;

  // Get all subjects for the grade level
  const getSubjectsQuery = `
    SELECT subject_id, subject_name 
    FROM subject 
    WHERE grade_level_id = ? AND is_active = 1
    ORDER BY subject_name
  `;

  db.getConnection((connErr, conn) => {
    if (connErr) {
      console.error('Database connection error:', connErr);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    conn.beginTransaction(async (err) => {
      if (err) {
        conn.release();
        return res.status(500).json({ error: 'Transaction failed to start' });
      }

      try {
        // Get all subjects for the grade level
        const subjects = await new Promise((resolve, reject) => {
          conn.query(getSubjectsQuery, [grade_level_id], (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        });

        if (subjects.length === 0) {
          throw new Error('No subjects found for the selected grade level');
        }

        // Create a single report assignment for the coordinator
        const fromDateValue = from_date ? new Date(from_date).toISOString().split('T')[0] : null;
        const _is_given = is_given ? 1 : 0;
        const _is_archived = is_archived ? 1 : 0;
        const _allow_late = allow_late ? 1 : 0;

        const insertReportSql = `
          INSERT INTO report_assignment 
          (category_id, sub_category_id, given_by, quarter, year, from_date, to_date, instruction, is_given, is_archived, allow_late, title)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const raVals = [category_id, sub_category_id ?? null, given_by, quarter, year, fromDateValue, to_date, instruction, _is_given, _is_archived, _allow_late, title];
        
        const assignmentResult = await new Promise((resolve, reject) => {
          conn.query(insertReportSql, raVals, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });

        const report_assignment_id = assignmentResult.insertId;

        // Create submissions for all recipients with all subjects
        for (let i = 0; i < recipients.length; i++) {
          const recipient = recipients[i];
          const nos = hasPerRecipientNos ? number_of_submissions[i] : (number_of_submission || 1);
          
          // Create a single submission with all subjects
          const allSubjectsData = subjects.map(subject => ({
            subject_id: subject.subject_id,
            subject_name: subject.subject_name,
            rows: [],
            totals: {}
          }));

          const insertSubmissionSql = `
            INSERT INTO submission 
            (report_assignment_id, category_id, submitted_by, status, number_of_submission, fields)
            VALUES (?, ?, ?, ?, ?, ?)
          `;
          
          const submissionVals = [
            report_assignment_id, 
            category_id, 
            recipient, 
            1, // status = 1 (submitted)
            nos,
            JSON.stringify({ 
              type: "LAEMPL_COORDINATOR", 
              grade: grade_level_id, 
              subjects: allSubjectsData,
              title: title,
              meta: { createdAt: new Date().toISOString() }
            })
          ];

          await new Promise((resolve, reject) => {
            conn.query(insertSubmissionSql, submissionVals, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
        }

        await new Promise((resolve, reject) => {
          conn.commit((err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        conn.release();
        res.json({ 
          success: true, 
          message: 'LAEMPL & MPS coordinator report created successfully',
          report_assignment_id,
          subjects_covered: subjects.length
        });

      } catch (error) {
        await new Promise((resolve) => {
          conn.rollback(() => {
            conn.release();
            resolve();
          });
        });
        
        console.error('Error creating coordinator report:', error);
        res.status(500).json({ error: 'Failed to create coordinator report', details: error.message });
      }
    });
  });
};

export const deleteReport = (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM report_assignment WHERE report_assignment_id = ?';
  db.query(sql, [id], (err) => {
    if (err) return res.status(500).send('Delete failed: ' + err);
    res.send(`Report with ID ${id} has been deleted.`);
  });
};
