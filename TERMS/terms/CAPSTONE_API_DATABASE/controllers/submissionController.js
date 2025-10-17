import db from '../db.js';
import pool from '../db.js';
import { createNotification } from './notificationsController.js';
// --- helpers ---
const safeParseJSON = (val, fallback = null) => {
  try {
    if (val == null) return fallback;
    if (typeof val === "object") return val; // already parsed
    return JSON.parse(val);
  } catch {
    return fallback;
  }
};

const normalizeFields = (row) => {
  if (!row) return row;
  return { ...row, fields: safeParseJSON(row.fields, {}) };
};

export const createSubmission = (req, res) => {
  const { category_id, submitted_by, status = 0, value = null, fields } = req.body;
  if (category_id == null || submitted_by == null || fields == null) {
    return res.status(400).send('category_id, submitted_by, and fields are required.');
  }

  const countSql = `
    SELECT COALESCE(MAX(number_of_submission), 0) AS max_no
    FROM submission
    WHERE submitted_by = ? AND category_id = ?
  `;
  db.query(countSql, [submitted_by, category_id], (countErr, countRes) => {
    if (countErr) return res.status(500).send('Database error (count): ' + countErr);

    const number_of_submission = Number(countRes?.[0]?.max_no || 0) + 1;
    const insertSql = `
      INSERT INTO submission
        (category_id, submitted_by, status, number_of_submission, value, date_submitted, fields)
      VALUES
        (?, ?, ?, ?, ?, NOW(), ?)
    `;
    const fieldsJson = typeof fields === 'string' ? fields : JSON.stringify(fields);

    db.query(
      insertSql,
      [category_id, submitted_by, status, number_of_submission, value, fieldsJson],
      (insErr, insRes) => {
        if (insErr) return res.status(500).send('Failed to insert submission: ' + insErr);

        const getSql = `
          SELECT s.submission_id, s.category_id, s.submitted_by, s.status,
                 s.number_of_submission, s.value,
                 DATE_FORMAT(s.date_submitted, '%m/%d/%Y %H:%i:%s') AS date_submitted,
                 s.fields
          FROM submission s
          WHERE s.submission_id = ?
        `;
        db.query(getSql, [insRes.insertId], (gErr, gRes) => {
          if (gErr) return res.status(500).send('Database error: ' + gErr);
          res.status(201).json(normalizeFields(gRes[0]));
        });
      }
    );
  });
};


export const getSubmissions = (req, res) => {
  const sql = `
    SELECT s.submission_id, s.category_id, s.submitted_by, s.status,
           s.number_of_submission, s.value,
           DATE_FORMAT(s.date_submitted, '%m/%d/%Y %H:%i:%s') AS date_submitted,
           s.fields
    FROM submission s
    ORDER BY s.date_submitted DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).send('Database error: ' + err);
    res.json(results.map(normalizeFields));
  });
};

export const getSubmissionsByUser = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT s.submission_id, s.category_id, s.submitted_by, s.status,
           s.number_of_submission, s.value,
           DATE_FORMAT(s.date_submitted, '%m/%d/%Y %H:%i:%s') AS date_submitted,
           s.fields
    FROM submission s
    WHERE s.submitted_by = ?
    ORDER BY s.date_submitted DESC
  `;
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).send('Database error: ' + err);
    res.json(results.map(normalizeFields)); // 200 with [] if none
  });
};

export const getSubmission = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT s.submission_id, s.report_assignment_id, s.category_id, s.submitted_by, s.status,
           s.number_of_submission, s.value,
           DATE_FORMAT(s.date_submitted, '%m/%d/%Y %H:%i:%s') AS date_submitted,
           s.fields
    FROM submission s
    WHERE s.submission_id = ?
  `;
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).send('Database error: ' + err);
    if (!results.length) return res.status(404).send('No submission found for the given ID.');
    res.json(normalizeFields(results[0]));
  });
};

// simple passthrough for React's /submissions/laempl/:id GET
export const getLAEMPLBySubmissionId = (req, res) => getSubmission(req, res);

export const submitAnswers = (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const requestedStatus = body.status; // may be undefined

  let answers = {};
  const input = body.answers ?? {};
  if (typeof input === 'string') {
    try { answers = JSON.parse(input); } catch { answers = {}; }
  } else if (input && typeof input === 'object') {
    answers = input;
  }

  const selectSql = `SELECT status, fields FROM submission WHERE submission_id = ?`;
  db.query(selectSql, [id], (selErr, selRes) => {
    if (selErr) return res.status(500).send('Database error: ' + selErr);
    if (!selRes.length) return res.status(404).send('Submission not found.');

    const currentStatus = Number(selRes[0].status) || 0;

    let current = {};
    try {
      current = typeof selRes[0].fields === 'string'
        ? JSON.parse(selRes[0].fields)
        : (selRes[0].fields || {});
    } catch { current = {}; }

    const next = {
      _form: current._form || { title: '', fields: [] },
      _answers: { ...(current._answers || {}), ...answers },
    };

    // Decide the new status:
    let newStatusClause = '';
    const params = [JSON.stringify(next)];
    if (Number.isInteger(requestedStatus)) {
      newStatusClause = ', status = ?';
      params.push(requestedStatus);
    } else if (currentStatus < 2) {
      // auto-promote only if not yet at/above 2
      newStatusClause = ', status = 2';
    }

    const updateSql = `UPDATE submission SET fields = ?, date_submitted = NOW()${newStatusClause} WHERE submission_id = ?`;
    params.push(id);

    db.query(updateSql, params, (updErr) => {
      if (updErr) return res.status(500).send('Update failed: ' + updErr);

      const fetchSql = `
        SELECT submission_id, category_id, submitted_by, status, number_of_submission,
               value, DATE_FORMAT(date_submitted, '%m/%d/%Y %H:%i:%s') AS date_submitted, fields
        FROM submission WHERE submission_id = ?
      `;
      db.query(fetchSql, [id], (fErr, fRes) => {
        if (fErr) return res.status(500).send('Database error: ' + fErr);
        const out = { ...fRes[0] };
        try { out.fields = typeof out.fields === 'string' ? JSON.parse(out.fields) : out.fields; } catch {}
        // Notify assigner on first submit (status 2)
        const becameSubmitted = Number.isInteger(requestedStatus) ? requestedStatus === 2 : (currentStatus < 2);
        if (becameSubmitted && out?.submission_id) {
          const metaSql = `
            SELECT ra.given_by, ra.title
            FROM submission s
            JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
            WHERE s.submission_id = ?
          `;
          db.query(metaSql, [id], (mErr, mRows) => {
            if (!mErr && mRows?.length) {
              const meta = mRows[0];
              createNotification(meta.given_by, {
                title: `Report submitted: ${meta.title}`,
                message: `A teacher submitted a report for your review.`,
                type: 'report_submitted',
                ref_type: 'submission',
                ref_id: Number(id)
              });
            }
          });
        }
        return res.json(out);
      });
    });
  });
};


export const getMySubmissions = (req, res) => {
  const userId = req.user?.user_id || req.params.id || req.query.user_id;
  if (!userId) return res.status(400).json({ error: "User ID is required." });

  const sql = `
    SELECT
      s.submission_id,
      s.category_id,
      s.submitted_by,
      s.status,
      s.number_of_submission,
      s.value,
      s.date_submitted,
      s.fields,
      c.category_name
    FROM submission s
    LEFT JOIN category c ON s.category_id = c.category_id
    WHERE s.submitted_by = ?
    ORDER BY s.date_submitted DESC
  `;

  pool.query(sql, [userId], (err, results) => {
    if (err) {
      console.error("DB error fetching submissions:", err);
      return res.status(500).json({ error: "Database error." });
    }
    return res.json(results);
  });
};
export const patchLAEMPLBySubmissionId = (req, res) => {
  const { id } = req.params; // submission_id

  // — LAEMPL schema/rules —
  const TRAITS = ["Masipag","Matulungin","Masunurin","Magalang","Matapat","Matiyaga"];
  const COLS = [
    { key: "m",        type: "count", min: 0,  max: 9999 },
    { key: "f",        type: "count", min: 0,  max: 9999 },
    { key: "gmrc",     type: "score", min: 15, max: 25 },
    { key: "math",     type: "score", min: 15, max: 25 },
    { key: "lang",     type: "score", min: 15, max: 25 },
    { key: "read",     type: "score", min: 15, max: 25 },
    { key: "makabasa", type: "score", min: 15, max: 25 },
  ];
  const clamp = (val, min, max) => {
    if (val === "" || val == null) return null;
    const n = Number(val);
    if (Number.isNaN(n)) return null;
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };

  const body   = req.body || {};
  const requestedStatus = body.status; // may be undefined
  const grade  = body.grade;

  const rowsInput = body.rows ?? body.data ?? {};
  let rowsNormalized;
  try {
    const obj = typeof rowsInput === 'string' ? JSON.parse(rowsInput) : rowsInput;
    if (Array.isArray(obj)) {
      rowsNormalized = obj;
    } else if (obj && typeof obj === 'object') {
      rowsNormalized = TRAITS.map(trait => ({ trait, ...(obj[trait] || {}) }));
    } else {
      rowsNormalized = [];
    }
  } catch { rowsNormalized = []; }

  const cleanRows = TRAITS.map(trait => {
    const src = rowsNormalized.find(r => (r?.trait || '').toLowerCase() === trait.toLowerCase()) || {};
    const cleaned = { trait };
    COLS.forEach(c => { cleaned[c.key] = clamp(src[c.key], c.min, c.max); });
    return cleaned;
  });

  const totals = COLS.reduce((acc, c) => {
    acc[c.key] = cleanRows.reduce((sum, r) => sum + (r[c.key] ?? 0), 0);
    return acc;
  }, {});

  const selectSql = `SELECT status, fields FROM submission WHERE submission_id = ?`;
  db.query(selectSql, [id], (selErr, selRes) => {
    if (selErr) return res.status(500).send('Database error: ' + selErr);
    if (!selRes.length) return res.status(404).send('Submission not found.');

    const currentStatus = Number(selRes[0].status) || 0;

    let current = {};
    try {
      current = typeof selRes[0].fields === 'string'
        ? JSON.parse(selRes[0].fields)
        : (selRes[0].fields || {});
    } catch { current = {}; }

    const ensureRows = () => {
      const byTrait = Object.create(null);
      (current.rows || []).forEach(r => { if (r?.trait) byTrait[r.trait] = r; });
      return TRAITS.map(tr => {
        const r = byTrait[tr] || { trait: tr };
        COLS.forEach(c => { if (!(c.key in r)) r[c.key] = null; });
        return r;
      });
    };

    const nextFields = {
      type: 'LAEMPL',
      grade: grade ?? current.grade ?? 1,
      rows: cleanRows.length ? cleanRows : ensureRows(),
      totals,
      meta: { ...(current.meta || {}), updatedAt: new Date().toISOString() }
    };

    // Decide the new status:
    let newStatusClause = '';
    const params = [JSON.stringify(nextFields)];
    if (typeof requestedStatus === 'number') {
      newStatusClause = ', status = ?';
      params.push(requestedStatus);
    } else if (currentStatus < 2) {
      newStatusClause = ', status = 2';
    }

    const updateSql = `UPDATE submission SET fields = ?, date_submitted = NOW()${newStatusClause} WHERE submission_id = ?`;
    params.push(id);

    db.query(updateSql, params, (updErr) => {
      if (updErr) return res.status(500).send('Update failed: ' + updErr);

      const fetchSql = `
        SELECT submission_id, category_id, submitted_by, status, number_of_submission,
               value, DATE_FORMAT(date_submitted, '%m/%d/%Y %H:%i:%s') AS date_submitted, fields
        FROM submission
        WHERE submission_id = ?
      `;
      db.query(fetchSql, [id], (fErr, fRes) => {
        if (fErr) return res.status(500).send('Database error: ' + fErr);
        const out = { ...fRes[0] };
        try { out.fields = typeof out.fields === 'string' ? JSON.parse(out.fields) : out.fields; } catch {}
        return res.json(out);
      });
    });
  });
};

export const patchMPSBySubmissionId = (req, res) => {
  const { id } = req.params; // submission_id

  // MPS schema
  const TRAITS = ["Masipag","Matulungin","Masunurin","Magalang","Matapat","Matiyaga"];
  const COLS = [
    { key: "m" }, { key: "f" }, { key: "total" },
    { key: "mean" }, { key: "median" }, { key: "pl" },
    { key: "mps" }, { key: "sd" }, { key: "target" },
    { key: "hs" }, { key: "ls" },
  ];

  const num = (v) => {
    if (v === "" || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const body = req.body || {};
  const requestedStatus = body.status; // optional

  // normalize incoming rows
  const rowsInput = body.rows ?? body.data ?? [];
  const rowsNormalized = Array.isArray(rowsInput) ? rowsInput : [];

  const cleanRows = TRAITS.map(trait => {
    const src = rowsNormalized.find(r => (r?.trait || "").toLowerCase() === trait.toLowerCase()) || {};
    const out = { trait };
    COLS.forEach(c => { out[c.key] = num(src[c.key]); });
    return out;
  });

  // totals (sum numeric; ignore nulls)
  const totals = COLS.reduce((acc, c) => {
    acc[c.key] = cleanRows.reduce((sum, r) => sum + (r[c.key] ?? 0), 0);
    return acc;
  }, {});

  // fetch current
  const selectSql = `SELECT status, fields FROM submission WHERE submission_id = ?`;
  db.query(selectSql, [id], (selErr, selRes) => {
    if (selErr) return res.status(500).send('Database error: ' + selErr);
    if (!selRes.length) return res.status(404).send('Submission not found.');

    const currentStatus = Number(selRes[0].status) || 0;

    let current = {};
    try {
      current = typeof selRes[0].fields === 'string'
        ? JSON.parse(selRes[0].fields)
        : (selRes[0].fields || {});
    } catch { current = {}; }

    const nextFields = {
      type: 'MPS',
      grade: current.grade ?? 1,
      rows: cleanRows,
      totals,
      meta: { ...(current.meta || {}), updatedAt: new Date().toISOString() },
    };

    // status transition
    let statusSql = '';
    const params = [JSON.stringify(nextFields)];
    if (Number.isInteger(requestedStatus)) {
      statusSql = ', status = ?';
      params.push(requestedStatus);
    } else if (currentStatus < 2) {
      statusSql = ', status = 2'; // auto-promote to Submitted on first save
    }

    const updateSql = `UPDATE submission SET fields = ?, date_submitted = NOW()${statusSql} WHERE submission_id = ?`;
    params.push(id);

    db.query(updateSql, params, (updErr) => {
      if (updErr) return res.status(500).send('Update failed: ' + updErr);

      const fetchSql = `
        SELECT submission_id, category_id, submitted_by, status, number_of_submission,
               value, DATE_FORMAT(date_submitted, '%m/%d/%Y %H:%i:%s') AS date_submitted, fields
        FROM submission
        WHERE submission_id = ?
      `;
      db.query(fetchSql, [id], (fErr, fRes) => {
        if (fErr) return res.status(500).send('Database error: ' + fErr);
        const out = { ...fRes[0] };
        try { out.fields = typeof out.fields === 'string' ? JSON.parse(out.fields) : out.fields; } catch {}
        // Notify assigner on first submit (status 2)
        const becameSubmitted = Number.isInteger(requestedStatus) ? requestedStatus === 2 : (currentStatus < 2);
        if (becameSubmitted && out?.submission_id) {
          const metaSql = `
            SELECT ra.given_by, ra.title
            FROM submission s
            JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
            WHERE s.submission_id = ?
          `;
          db.query(metaSql, [id], (mErr, mRows) => {
            if (!mErr && mRows?.length) {
              const meta = mRows[0];
              createNotification(meta.given_by, {
                title: `Report submitted: ${meta.title}`,
                message: `A teacher submitted an MPS report for your review.`,
                type: 'report_submitted',
                ref_type: 'submission',
                ref_id: Number(id)
              });
            }
          });
        }
        return res.json(out);
      });
    });
  });
};



// DELETE submission
export const deleteSubmission = (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM submission WHERE submission_id = ?';
  db.query(sql, [id], (err) => {
    if (err) return res.status(500).send('Delete failed: ' + err);
    res.send(`Submission with ID ${id} has been deleted.`);
  });
};

/**
 * POST /submissions/:id/submit-to-principal
 * Allows coordinators to submit accomplishment reports to principal for approval
 */
export const submitToPrincipal = (req, res) => {
  const { id } = req.params;
  const { coordinator_notes } = req.body || {};

  // First, check if the submission exists and get its current status
  const selectSql = `
    SELECT s.submission_id, s.status, s.fields, s.submitted_by, s.value,
           ud.name as submitted_by_name, ud.role as submitted_by_role
    FROM submission s
    LEFT JOIN user_details ud ON s.submitted_by = ud.user_id
    WHERE s.submission_id = ?
  `;

  db.query(selectSql, [id], (selErr, selRes) => {
    if (selErr) return res.status(500).send('Database error: ' + selErr);
    if (!selRes.length) return res.status(404).send('Submission not found.');

    const submission = selRes[0];
    const currentStatus = Number(submission.status) || 0;

    // Check if submission is already approved (status 3) or rejected (status 4)
    if (currentStatus >= 3) {
      return res.status(400).send('This submission has already been processed by the principal.');
    }

    // Check if submission is at least completed by teacher (status 2)
    if (currentStatus < 2) {
      return res.status(400).send('Submission must be completed by teacher before coordinator can submit to principal.');
    }

    // Update submission status to "Completed" (status 2) - ready for principal review
    const updateSql = `
      UPDATE submission 
      SET status = 2, 
          date_submitted = NOW(),
          fields = JSON_SET(
            COALESCE(fields, '{}'), 
            '$.coordinator_notes', ?,
            '$.submitted_to_principal_at', ?
          )
      WHERE submission_id = ?
    `;

    const submittedAt = new Date().toISOString();
    const fieldsUpdate = [
      coordinator_notes || '',
      submittedAt,
      id
    ];

    db.query(updateSql, fieldsUpdate, (updErr) => {
      if (updErr) return res.status(500).send('Update failed: ' + updErr);

    // Notify principal (assigner) that coordinator submitted to principal
    const metaSql = `
      SELECT ra.given_by, ra.title
      FROM submission s
      JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
      WHERE s.submission_id = ?
    `;
    db.query(metaSql, [id], (mErr, mRows) => {
      if (!mErr && mRows?.length) {
        const meta = mRows[0];
        const payload = {
          title: `For approval: ${meta.title}`,
          message: `A coordinator forwarded a submission for your approval.`,
          type: 'for_approval',
          ref_type: 'submission',
          ref_id: Number(id)
        };
        // Notify the assigner (often the principal)
        createNotification(meta.given_by, payload);
        // Also notify all principals (fallback), excluding the assigner to avoid duplicates
        db.query(`SELECT user_id FROM user_details WHERE LOWER(role)='principal'`, [], (pErr, pRows) => {
          if (pErr || !pRows?.length) return;
          pRows.forEach((row) => {
            if (Number(row.user_id) !== Number(meta.given_by)) {
              createNotification(row.user_id, payload);
            }
          });
        });
      }
    });

      // Return updated submission data
      const fetchSql = `
        SELECT s.submission_id, s.category_id, s.submitted_by, s.status, s.number_of_submission,
               s.value, DATE_FORMAT(s.date_submitted, '%Y-%m-%d %H:%i:%s') AS date_submitted,
               s.fields, ud.name as submitted_by_name
        FROM submission s
        LEFT JOIN user_details ud ON s.submitted_by = ud.user_id
        WHERE s.submission_id = ?
      `;

      db.query(fetchSql, [id], (fErr, fRes) => {
        if (fErr) return res.status(500).send('Database error: ' + fErr);
        
        const out = { ...fRes[0] };
        try { 
          out.fields = typeof out.fields === 'string' ? JSON.parse(out.fields) : out.fields; 
        } catch {}
        
        res.json({
          success: true,
          message: 'Submission successfully submitted to principal for approval.',
          submission: out
        });
      });
    });
  });
};

/**
 * GET /submissions/for-principal-approval
 * Returns submissions that were assigned BY the current principal and are ready for principal approval (status 2)
 */
export const getSubmissionsForPrincipalApproval = (req, res) => {
  const principalId = req.user?.user_id;
  
  if (!principalId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const sql = `
    SELECT 
      s.submission_id,
      s.category_id,
      s.submitted_by,
      s.status,
      s.number_of_submission,
      s.value as title,
      DATE_FORMAT(s.date_submitted, '%Y-%m-%d %H:%i:%s') AS date_submitted,
      s.fields,
      ud.name as submitted_by_name,
      ud.role as submitted_by_role,
      c.category_name,
      ra.title as assignment_title,
      ra.to_date as due_date,
      ra.given_by as assigned_by_principal
    FROM submission s
    LEFT JOIN user_details ud ON s.submitted_by = ud.user_id
    LEFT JOIN category c ON s.category_id = c.category_id
    LEFT JOIN report_assignment ra ON s.report_assignment_id = ra.report_assignment_id
    WHERE s.status = 2 
      AND ra.given_by = ?
    ORDER BY s.date_submitted DESC
  `;

  db.query(sql, [principalId], (err, results) => {
    if (err) return res.status(500).send('Database error: ' + err);
    
    // Parse fields for each submission
    const submissions = results.map(row => {
      const out = { ...row };
      try { 
        out.fields = typeof out.fields === 'string' ? JSON.parse(out.fields) : out.fields; 
      } catch {
        out.fields = {};
      }
      return out;
    });
    
    res.json(submissions);
  });
};

// GET /submissions/by-assignment/:id/mine → returns current user's submission_id for given report_assignment_id
export const getMySubmissionForAssignment = (req, res) => {
  const userId = req.user?.user_id;
  const { id } = req.params; // report_assignment_id
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const sql = `SELECT submission_id FROM submission WHERE report_assignment_id = ? AND submitted_by = ? LIMIT 1`;
  db.query(sql, [id, userId], (err, rows) => {
    if (err) return res.status(500).send('Database error: ' + err);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Submission not found' });
    res.json({ submission_id: rows[0].submission_id });
  });
};