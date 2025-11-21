import db from '../db.js';
import pool from '../db.js';
import { createNotification } from './notificationsController.js';
import { sendEmail } from "../services/emailService.js";
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

const sendEmailToUser = (userId, subject, message) => {
  if (!userId) return;
  const sql = `SELECT email FROM user_details WHERE user_id = ? LIMIT 1`;
  db.query(sql, [userId], async (_err, rows) => {
    const to = rows?.[0]?.email;
    if (!to) return;
    try {
      await sendEmail({
        to,
        subject,
        html: `<p>${message}</p>`,
        text: message
      });
    } catch (e) {
      console.error('Email send failed:', e?.message || e);
    }
  });
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
  const { year, quarter } = req.query;
  
  let sql = `
    SELECT s.submission_id, s.category_id, s.submitted_by, s.status,
           s.number_of_submission, s.value,
           DATE_FORMAT(s.date_submitted, '%m/%d/%Y %H:%i:%s') AS date_submitted,
           s.fields, s.report_assignment_id,
           ra.year as assignment_year, ra.quarter as assignment_quarter,
           c.category_name
    FROM submission s
    LEFT JOIN report_assignment ra ON s.report_assignment_id = ra.report_assignment_id
    LEFT JOIN category c ON s.category_id = c.category_id
    WHERE s.submitted_by = ?
  `;
  
  const params = [id];
  
  // Add year and quarter filtering if provided
  if (year && quarter) {
    // Handle inconsistent year values: year=1 maps to 2025, year=2025 maps to 2025
    const yearValue = parseInt(year);
    const quarterValue = parseInt(quarter);
    
    if (yearValue === 2025) {
      // For 2025, check both year=1 and year=2025
      sql += ` AND (ra.year = ? OR ra.year = ?) AND ra.quarter = ?`;
      params.push(1, 2025, quarterValue);
    } else {
      sql += ` AND ra.year = ? AND ra.quarter = ?`;
      params.push(yearValue, quarterValue);
    }
  }
  // If no year/quarter filter, show all submissions
  
  sql += ` ORDER BY s.date_submitted DESC`;
  
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).send('Database error: ' + err);
    
    // Debug logging
    console.log('getSubmissionsByUser query:', sql);
    console.log('getSubmissionsByUser params:', params);
    console.log('getSubmissionsByUser results count:', results.length);
    if (results.length > 0) {
      console.log('First result:', {
        submission_id: results[0].submission_id,
        assignment_year: results[0].assignment_year,
        assignment_quarter: results[0].assignment_quarter,
        value: results[0].value
      });
    }
    
    // Log all results to see year/quarter values
    console.log('All results year/quarter values:');
    results.forEach((result, index) => {
      console.log(`Result ${index + 1}: year=${result.assignment_year}, quarter=${result.assignment_quarter}`);
    });
    
    res.json(results.map(normalizeFields)); // 200 with [] if none
  });
};

export const getSubmission = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT s.submission_id, s.report_assignment_id, s.category_id, s.submitted_by, s.status,
           s.number_of_submission, s.value,
           DATE_FORMAT(s.date_submitted, '%m/%d/%Y %H:%i:%s') AS date_submitted,
           s.fields,
           ra.title AS assignment_title,
           ra.instruction,
           DATE_FORMAT(ra.from_date, '%m/%d/%Y') AS from_date,
           DATE_FORMAT(ra.to_date, '%m/%d/%Y') AS to_date,
           ra.allow_late,
           c.category_name,
           sc.sub_category_name,
           ud.name AS submitted_by_name,
           st.value AS status_text
    FROM submission s
    JOIN report_assignment ra ON s.report_assignment_id = ra.report_assignment_id
    LEFT JOIN category c ON ra.category_id = c.category_id
    LEFT JOIN sub_category sc ON ra.sub_category_id = sc.sub_category_id
    LEFT JOIN user_details ud ON s.submitted_by = ud.user_id
    LEFT JOIN status st ON s.status = st.status_id
    WHERE s.submission_id = ?
  `;
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).send('Database error: ' + err);
    if (!results.length) return res.status(404).send('No submission found for the given ID.');
    
    const normalized = normalizeFields(results[0]);
    
    // Log what's being returned for LAEMPL submissions
    if (normalized.fields && (normalized.fields.type === 'LAEMPL' || normalized.fields.type === 'LAEMPL_COORDINATOR' || normalized.fields.type === 'LAEMPL_TEACHER')) {
      console.log("\n=== BACKEND LAEMPL GET DEBUG ===");
      console.log(`[BACKEND] Loading submission ID: ${id}`);
      console.log(`[BACKEND] Submission status: ${normalized.status}`);
      console.log(`[BACKEND] Fields type: ${normalized.fields.type}`);
      if (normalized.fields.rows && Array.isArray(normalized.fields.rows)) {
        console.log(`[BACKEND] Rows count: ${normalized.fields.rows.length}`);
        console.log("[BACKEND] Rows data:");
        normalized.fields.rows.forEach((row, idx) => {
          console.log(`  Row ${idx + 1} (${row.trait || 'no trait'}):`, JSON.stringify(row, null, 2));
        });
      } else {
        console.log("[BACKEND] No rows found in fields");
      }
      if (normalized.fields.meta) {
        console.log("[BACKEND] Meta:", JSON.stringify(normalized.fields.meta, null, 2));
      }
      console.log("=== END BACKEND LAEMPL GET DEBUG ===\n");
    }
    
    res.json(normalized);
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
              }, (err, result) => {
                if (err) console.error('Failed to create notification:', err);
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
  let TRAITS = ["Masipag","Matulungin","Masunurin","Magalang","Matapat","Matiyaga"];
  let COLS = [
    { key: "m",        type: "count", min: 0,  max: 9999 },
    { key: "f",        type: "count", min: 0,  max: 9999 },
    { key: "gmrc",     type: "score", min: 0,  max: 9999 },
    { key: "math",     type: "score", min: 0,  max: 9999 },
    { key: "lang",     type: "score", min: 0,  max: 9999 },
    { key: "read",     type: "score", min: 0,  max: 9999 },
    { key: "makabasa", type: "score", min: 0,  max: 9999 },
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
  
  console.log("\n=== BACKEND LAEMPL SUBMIT DEBUG ===");
  console.log("Submission ID:", id);
  console.log("Requested status:", requestedStatus);
  console.log("Grade:", grade);
  console.log("\n[BACKEND] Rows received:", JSON.stringify(body.rows, null, 2));
  console.log("\n[BACKEND] Totals received:", JSON.stringify(body.totals, null, 2));
  if (body.rows && Array.isArray(body.rows)) {
    console.log("\n[BACKEND] Row details:");
    body.rows.forEach((row, idx) => {
      console.log(`  Row ${idx + 1} (${row.trait || 'no trait'}):`, JSON.stringify(row, null, 2));
    });
  }
  console.log("=== END BACKEND LAEMPL SUBMIT DEBUG ===\n");

  const rowsInput = body.rows ?? body.data ?? {};
  let rowsNormalized;
  try {
    const obj = typeof rowsInput === 'string' ? JSON.parse(rowsInput) : rowsInput;
    if (Array.isArray(obj)) {
      rowsNormalized = obj;
      // Extract dynamic traits from the rows data
      TRAITS = obj.map(row => row.trait).filter(Boolean);
    } else if (obj && typeof obj === 'object') {
      // Use dynamic traits from the object keys
      TRAITS = Object.keys(obj).filter(key => key !== 'totals' && key !== 'meta');
      rowsNormalized = TRAITS.map(trait => ({ trait, ...(obj[trait] || {}) }));
    } else {
      rowsNormalized = [];
    }
  } catch { rowsNormalized = []; }

  // Extract dynamic columns from the first row if available
  if (rowsNormalized.length > 0) {
    const firstRow = rowsNormalized[0];
    COLS = Object.keys(firstRow)
      .filter(key => key !== 'trait')
      .map(key => ({
        key,
        type: key === 'm' || key === 'f' ? 'count' : 'score',
        min: key === 'm' || key === 'f' ? 0 : 0,  // Allow 0 for subject columns
        max: key === 'm' || key === 'f' ? 9999 : 9999  // Allow higher values for subject columns
      }));
  }

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
    
    // Add MPS data if provided
    if (body.mps_rows && body.mps_totals) {
      nextFields.mps_rows = body.mps_rows;
      nextFields.mps_totals = body.mps_totals;
    }
    
    // Add subject information if available from the request
    if (body.subject_id) {
      nextFields.subject_id = body.subject_id;
    }
    if (body.subject_name) {
      nextFields.subject_name = body.subject_name;
    }
    
    console.log("\n=== BACKEND FINAL DATA STRUCTURE ===");
    console.log("[BACKEND] Clean rows being saved:");
    cleanRows.forEach((row, idx) => {
      console.log(`  Row ${idx + 1} (${row.trait || 'no trait'}):`, JSON.stringify(row, null, 2));
    });
    console.log("\n[BACKEND] Totals:", JSON.stringify(totals, null, 2));
    console.log("\n[BACKEND] Full nextFields structure:");
    console.log(JSON.stringify(nextFields, null, 2));
    console.log("=== END BACKEND FINAL DATA STRUCTURE ===\n");

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
      db.query(fetchSql, [id], async (fErr, fRes) => {
        if (fErr) return res.status(500).send('Database error: ' + fErr);
        const out = { ...fRes[0] };
        try { out.fields = typeof out.fields === 'string' ? JSON.parse(out.fields) : out.fields; } catch {}

        const finalStatus = Number(out?.status);
        const becameSubmitted = Number.isInteger(requestedStatus)
          ? requestedStatus === 2
          : (currentStatus < 2);

        if (becameSubmitted || finalStatus === 3 || finalStatus === 4) {
          const metaSql = `
            SELECT s.submitted_by, ra.given_by, ra.title
            FROM submission s
            JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
            WHERE s.submission_id = ?
          `;
          db.query(metaSql, [id], (metaErr, metaRows) => {
            if (metaErr || !metaRows?.length) return;
            const meta = metaRows[0];

            if (becameSubmitted) {
              const payload = {
                title: `Report submitted: ${meta.title}`,
                message: 'A teacher submitted a LAEMPL report for your review.',
                type: 'report_submitted',
                ref_type: 'submission',
                ref_id: Number(id)
              };
              createNotification(meta.given_by, payload, (err) => {
                if (err) console.error('Failed to create notification:', err);
              });
              sendEmailToUser(
                meta.given_by,
                `Report submitted: ${meta.title}`,
                'A report was submitted and is ready to view.'
              );
            }

            if (finalStatus === 3) {
              const approver = (req.user?.name || req.user?.email || 'Principal').toString();
              const msg = `${approver} approved your report ${meta.title}`;
              sendEmailToUser(meta.submitted_by, `Submission approved: ${meta.title}`, msg);
            } else if (finalStatus === 4) {
              const approver = (req.user?.name || req.user?.email || 'Principal').toString();
              const msg = `${approver} rejected your report ${meta.title}. Please review the feedback.`;
              sendEmailToUser(meta.submitted_by, `Submission rejected: ${meta.title}`, msg);
            }
          });
        }

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
        const finalStatus = Number(out?.status);
        const becameSubmitted = Number.isInteger(requestedStatus) ? requestedStatus === 2 : (currentStatus < 2);

        if (becameSubmitted || finalStatus === 3 || finalStatus === 4) {
          const metaSql = `
            SELECT s.submitted_by, ra.given_by, ra.title
            FROM submission s
            JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
            WHERE s.submission_id = ?
          `;
          db.query(metaSql, [id], (mErr, mRows) => {
            if (mErr || !mRows?.length) return;
            const meta = mRows[0];

            if (becameSubmitted) {
              const payload = {
                title: `Report submitted: ${meta.title}`,
                message: `A teacher submitted an MPS report for your review.`,
                type: 'report_submitted',
                ref_type: 'submission',
                ref_id: Number(id)
              };
              createNotification(meta.given_by, payload, (err) => {
                if (err) console.error('Failed to create notification:', err);
              });
              sendEmailToUser(
                meta.given_by,
                `Report submitted: ${meta.title}`,
                'A report was submitted and is ready to view.'
              );
            }

            if (finalStatus === 3) {
              const approver = (req.user?.name || req.user?.email || 'Principal').toString();
              const msg = `${approver} approved your report ${meta.title}`;
              sendEmailToUser(meta.submitted_by, `Submission approved: ${meta.title}`, msg);
            } else if (finalStatus === 4) {
              const approver = (req.user?.name || req.user?.email || 'Principal').toString();
              const msg = `${approver} rejected your report ${meta.title}. Please review the feedback.`;
              sendEmailToUser(meta.submitted_by, `Submission rejected: ${meta.title}`, msg);
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
    // For LAEMPL reports, allow coordinator to submit consolidated reports even if individual teacher status < 2
    if (currentStatus < 2) {
      // Check if this is a LAEMPL report by looking at the fields
      const fields = submission.fields ? JSON.parse(submission.fields) : {};
      if (fields.type !== 'LAEMPL') {
        return res.status(400).send('Submission must be completed by teacher before coordinator can submit to principal.');
      }
      // Allow LAEMPL coordinator submission for consolidated reports
      console.log('LAEMPL coordinator submission - allowing override for consolidated report');
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
        createNotification(meta.given_by, payload, (err, result) => {
          if (err) console.error('Failed to create notification for assigner:', err);
        });
        // Also notify all principals (fallback), excluding the assigner to avoid duplicates
        db.query(`SELECT user_id FROM user_details WHERE LOWER(role)='principal'`, [], (pErr, pRows) => {
          if (pErr || !pRows?.length) return;
          pRows.forEach((row) => {
            if (Number(row.user_id) !== Number(meta.given_by)) {
              createNotification(row.user_id, payload, (err, result) => {
                if (err) console.error('Failed to create notification for principal:', err);
              });
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
      ra.given_by as assigned_by_principal,
      ra.year as assignment_year,
      ra.quarter as assignment_quarter,
      st.value AS status_text
    FROM submission s
    LEFT JOIN user_details ud ON s.submitted_by = ud.user_id
    LEFT JOIN category c ON s.category_id = c.category_id
    LEFT JOIN report_assignment ra ON s.report_assignment_id = ra.report_assignment_id
    LEFT JOIN status st ON s.status = st.status_id
    WHERE s.status = 2 
      AND ra.given_by = ?
    ORDER BY s.date_submitted DESC
  `;

  db.query(sql, [principalId], (err, results) => {
    if (err) {
      console.error('Error fetching submissions for principal approval:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    
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

/**
 * GET /submissions/approved-by-principal
 * Returns submissions that were assigned BY the current principal and have been approved (status 3)
 */
export const getApprovedSubmissionsByPrincipal = (req, res) => {
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
      ra.given_by as assigned_by_principal,
      ra.year as assignment_year,
      ra.quarter as assignment_quarter,
      sy.school_year,
      qp.quarter AS quarter_name
    FROM submission s
    LEFT JOIN user_details ud ON s.submitted_by = ud.user_id
    LEFT JOIN category c ON s.category_id = c.category_id
    LEFT JOIN report_assignment ra ON s.report_assignment_id = ra.report_assignment_id
    LEFT JOIN school_year sy ON sy.year_id = ra.year
    LEFT JOIN quarter_period qp ON qp.quarter_period_id = ra.quarter
    WHERE s.status = 3 
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

/**
 * GET /submissions/rejected-by-principal
 * Returns submissions that were assigned BY the current principal and have been rejected (status 4)
 */
export const getRejectedSubmissionsByPrincipal = (req, res) => {
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
      ra.given_by as assigned_by_principal,
      ra.year as assignment_year,
      ra.quarter as assignment_quarter,
      sy.school_year,
      qp.quarter AS quarter_name
    FROM submission s
    LEFT JOIN user_details ud ON s.submitted_by = ud.user_id
    LEFT JOIN category c ON s.category_id = c.category_id
    LEFT JOIN report_assignment ra ON s.report_assignment_id = ra.report_assignment_id
    LEFT JOIN school_year sy ON sy.year_id = ra.year
    LEFT JOIN quarter_period qp ON qp.quarter_period_id = ra.quarter
    WHERE s.status = 4 
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

// GET /submissions/by-assignment/:id → returns all submissions for a given report_assignment_id
export const getSubmissionsByAssignment = (req, res) => {
  const { id } = req.params; // report_assignment_id
  const sql = `
    SELECT 
      submission_id,
      report_assignment_id,
      category_id,
      submitted_by,
      status,
      number_of_submission,
      value,
      date_submitted,
      fields
    FROM submission 
    WHERE report_assignment_id = ?
    ORDER BY submitted_by
  `;
  db.query(sql, [id], (err, rows) => {
    if (err) return res.status(500).send('Database error: ' + err);
    res.json(rows || []);
  });
};

/**
 * PATCH /submissions/:id
 * Generic endpoint for updating submission status and other fields
 */
export const patchSubmission = (req, res) => {
  const { id } = req.params;
  const { status, rejection_reason, coordinator_notes, fields } = req.body;

  console.log('PATCH submission request:', {
    id,
    status,
    rejection_reason,
    coordinator_notes,
    hasFields: !!fields,
    body: req.body
  });

  if (!id) {
    return res.status(400).send('Submission ID is required');
  }

  // Build update query dynamically
  const updates = [];
  const values = [];

  if (status !== undefined) {
    updates.push('status = ?');
    values.push(status);
  }

  if (rejection_reason !== undefined) {
    console.log('Adding rejection_reason to update:', rejection_reason);
    updates.push('fields = JSON_SET(COALESCE(fields, "{}"), "$.rejection_reason", ?)');
    values.push(rejection_reason);
  }

  if (coordinator_notes !== undefined) {
    updates.push('fields = JSON_SET(COALESCE(fields, "{}"), "$.coordinator_notes", ?)');
    values.push(coordinator_notes);
  }

  // Handle full fields object update (for consolidation flags, etc.)
  if (fields !== undefined && typeof fields === 'object') {
    // Get current fields first, then merge
    const selectSql = `SELECT fields FROM submission WHERE submission_id = ?`;
    db.query(selectSql, [id], (selErr, selRows) => {
      if (selErr) {
        console.error('Error fetching current fields:', selErr);
        return res.status(500).send('Database error: ' + selErr);
      }
      
      if (!selRows.length) {
        return res.status(404).send('Submission not found');
      }

      let current = {};
      try {
        current = typeof selRows[0].fields === 'string' 
          ? JSON.parse(selRows[0].fields || '{}')
          : (selRows[0].fields || {});
      } catch (parseErr) {
        console.error('Error parsing current fields:', parseErr);
        current = {};
      }

      // Merge new fields with current fields
      const merged = {
        ...current,
        ...fields,
        // Preserve meta object structure
        meta: {
          ...(current.meta || {}),
          ...(fields.meta || {})
        }
      };

      // Build updates array for this specific case
      const fieldUpdates = [];
      const fieldValues = [];

      if (status !== undefined) {
        fieldUpdates.push('status = ?');
        fieldValues.push(status);
      }

      fieldUpdates.push('fields = ?');
      fieldValues.push(JSON.stringify(merged));
      
      fieldValues.push(id);
      const sql = `UPDATE submission SET ${fieldUpdates.join(', ')} WHERE submission_id = ?`;
      
      console.log('Final SQL query (with fields):', sql);
      console.log('Final values (with fields):', fieldValues);

      db.query(sql, fieldValues, (err, result) => {
        if (err) {
          console.error('Error updating submission:', err);
          return res.status(500).send('Database error: ' + err);
        }

        if (result.affectedRows === 0) {
          return res.status(404).send('Submission not found');
        }

        // If status is 4 (rejected), implement rejection workflow
        if (status === 4) {
          handleRejectionWorkflow(req, res, id, rejection_reason);
        } else {
          // Return success
          return res.json({ 
            ok: true, 
            message: 'Submission updated successfully',
            submission_id: id
          });
        }
      });
    });
    return; // Exit early since we're handling the update in the callback
  }

  if (updates.length === 0) {
    return res.status(400).send('No fields provided for update');
  }

  // Add submission ID to values
  values.push(id);

  const sql = `UPDATE submission SET ${updates.join(', ')} WHERE submission_id = ?`;
  
  console.log('Final SQL query:', sql);
  console.log('Final values:', values);

  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).send('Update failed: ' + err);

    if (result.affectedRows === 0) {
      return res.status(404).send('Submission not found');
    }

    // If status is 4 (rejected), implement rejection workflow
  if (status === 4) {
      handleRejectionWorkflow(req, res, id, rejection_reason);
    } else {
      // Return updated submission
      const fetchSql = `
        SELECT s.submission_id, s.category_id, s.submitted_by, s.status, s.number_of_submission,
               s.value, DATE_FORMAT(s.date_submitted, '%Y-%m-%d %H:%i:%s') AS date_submitted,
               s.fields, ud.name as submitted_by_name
        FROM submission s
        LEFT JOIN user_details ud ON s.submitted_by = ud.user_id
        WHERE s.submission_id = ?
      `;

      db.query(fetchSql, [id], async (fErr, fRes) => {
        if (fErr) return res.status(500).send('Failed to fetch updated submission: ' + fErr);
        
        const submission = normalizeFields(fRes[0]);

        // If this update explicitly approved the submission, email the submitter (best-effort)
        if (status === 3) {
          try {
            const metaSql = `
              SELECT s.submitted_by, ra.title
              FROM submission s
              JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
              WHERE s.submission_id = ?
            `;
            db.query(metaSql, [id], (mErr, mRows) => {
              if (!mErr && mRows?.length) {
                const meta = mRows[0];
                const uSql = `SELECT email FROM user_details WHERE user_id = ? LIMIT 1`;
                db.query(uSql, [meta.submitted_by], async (_ue, uRows) => {
                  const to = uRows?.[0]?.email;
                  if (to) {
                    const approver = (req.user?.name || req.user?.email || 'Principal').toString();
                    const subj = `Submission approved: ${meta.title}`;
                    const msg  = `${approver} approved your report ${meta.title}`;
                    try { await sendEmail({ to, subject: subj, html: `<p>${msg}</p>`, text: msg }); } catch (e) { console.error('Email send failed:', e?.message || e); }
                  }
                });
              }
            });
          } catch (e) {
            console.error('Approval email failed:', e?.message || e);
          }
        }

        res.json({
          message: 'Submission updated successfully',
          submission: submission
        });
      });
    }
  });
};

/**
 * PATCH /submissions/:id/formdata
 * Handle FormData submissions (for coordinator forms with images)
 */
export const patchSubmissionFormData = (req, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).send('Submission ID is required');
  }

  // Debug: Log the received data
  console.log('Received FormData:', req.body);
  console.log('Files:', req.files);
  console.log('Files length:', req.files ? req.files.length : 'no files');

  // Extract form data from req.body (FormData is automatically parsed by express)
  const narrative = req.body.narrative;
  const title = req.body.title;
  const status = req.body.status;
  const activityName = req.body.activityName;
  const facilitators = req.body.facilitators;
  const objectives = req.body.objectives;
  const date = req.body.date;
  const time = req.body.time;
  const venue = req.body.venue;
  const keyResult = req.body.keyResult;
  const personsInvolved = req.body.personsInvolved;
  const expenses = req.body.expenses;
  const lessonLearned = req.body.lessonLearned;
  const existingImagesJson = req.body.existingImages;

  // Get current submission data
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
    } catch { 
      current = {}; 
    }

    // Build new answers object with coordinator data
    const newAnswers = {
      ...(current._answers || {}),
      ...(narrative && { narrative }),
      ...(title && { title }),
      ...(activityName && { activityName }),
      ...(facilitators && { facilitators }),
      ...(objectives && { objectives }),
      ...(date && { date }),
      ...(time && { time }),
      ...(venue && { venue }),
      ...(keyResult && { keyResult }),
      ...(personsInvolved && { personsInvolved }),
      ...(expenses && { expenses }),
      ...(lessonLearned && { lessonLearned })
    };

    const next = {
      _form: current._form || { title: '', fields: [] },
      _answers: newAnswers,
    };

    // Handle existing images (including consolidated ones)
    let finalImages = current._answers?.images || [];
    
    if (existingImagesJson) {
      try {
        const existingImages = JSON.parse(existingImagesJson);
        console.log('Received existing images:', existingImages);
        finalImages = existingImages;
      } catch (e) {
        console.error('Error parsing existing images:', e);
      }
    }
    
    // Handle new file uploads if any
    const files = req.files || [];
    console.log('Processing files:', files);
    if (files.length > 0) {
      const imageUrls = files.map(file => {
        console.log('File details:', {
          originalname: file.originalname,
          filename: file.filename,
          path: file.path,
          size: file.size
        });
        return {
          url: `/uploads/accomplishments/${file.filename}`,
          filename: file.filename
        };
      });
      console.log('Created image URLs:', imageUrls);
      finalImages = [...finalImages, ...imageUrls];
      console.log('Updated images array:', finalImages);
    } else {
      console.log('No files to process');
    }
    
    // Set the final images array
    next._answers.images = finalImages;

    // Decide the new status
    let newStatusClause = '';
    const params = [JSON.stringify(next)];
    if (Number.isInteger(Number(status))) {
      newStatusClause = ', status = ?';
      params.push(Number(status));
    } else if (currentStatus < 2) {
      newStatusClause = ', status = 2';
    }

    const updateSql = `UPDATE submission SET fields = ?, date_submitted = NOW()${newStatusClause} WHERE submission_id = ?`;
    params.push(id);

    console.log('Final data being stored:', JSON.stringify(next, null, 2));

    db.query(updateSql, params, (updErr) => {
      if (updErr) return res.status(500).send('Update failed: ' + updErr);

      // Determine final status after update
      const finalStatus = Number(status) || (currentStatus < 2 ? 2 : currentStatus);

      // Best-effort: on first submit (status becomes 2), email the assigner (principal)
      if (finalStatus === 2) {
        const metaSql = `
          SELECT ra.given_by, ra.title, ud.name AS submitter_name
          FROM submission s
          JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
          LEFT JOIN user_details ud ON ud.user_id = s.submitted_by
          WHERE s.submission_id = ?
        `;
        db.query(metaSql, [id], (mErr, mRows) => {
          if (!mErr && mRows?.length) {
            const meta = mRows[0];
            const userSql = `SELECT email, name FROM user_details WHERE user_id = ? LIMIT 1`;
            db.query(userSql, [meta.given_by], async (_ue, uRows) => {
              const to = uRows?.[0]?.email;
              if (to) {
                const subj = `Report submitted: ${meta.title}`;
                const submitter = meta.submitter_name || 'a user';
                const msg  = `A report was submitted by ${submitter}.`;
                try { await sendEmail({ to, subject: subj, html: `<p>${msg}</p>`, text: msg }); } catch (e) {
                  console.error('Email send failed:', e?.message || e);
                }
              }
            });
          }
        });
      }

      // Return success response with updated images
      res.json({
        message: 'Submission updated successfully',
        submission_id: id,
        status: finalStatus,
        images: finalImages // Include the updated images array
      });
    });
  });
};

/**
 * Handle rejection workflow: set status to 1 (draft), extend deadline, and notify
 */
const handleRejectionWorkflow = (req, res, submissionId, rejectionReason) => {
  console.log('Handling rejection workflow:', {
    submissionId,
    rejectionReason,
    rejectionReasonType: typeof rejectionReason
  });
  
  // Get submission details and assignment info
  const getDetailsSql = `
    SELECT s.submission_id, s.submitted_by, s.report_assignment_id, s.fields,
           ra.title as assignment_title,
           ud.name as submitted_by_name, ud.email as submitted_by_email
    FROM submission s
    JOIN report_assignment ra ON s.report_assignment_id = ra.report_assignment_id
    LEFT JOIN user_details ud ON s.submitted_by = ud.user_id
    WHERE s.submission_id = ?
  `;

  db.query(getDetailsSql, [submissionId], (err, results) => {
    if (err) return res.status(500).send('Failed to get submission details: ' + err);
    
    if (results.length === 0) {
      return res.status(404).send('Submission not found');
    }

    const submission = results[0];
    const rejectedAt = new Date().toISOString();

    // Ensure status is 4 and set rejection metadata (do not extend deadlines)
    const updateSql = `
      UPDATE submission 
      SET status = 4,
          fields = JSON_SET(
            COALESCE(fields, '{}'), 
            '$.rejection_reason', ?,
            '$.rejected_at', ?
          )
      WHERE submission_id = ?
    `;

    const updateValues = [
      rejectionReason,
      rejectedAt,
      submissionId
    ];

    db.query(updateSql, updateValues, (updateErr) => {
      if (updateErr) return res.status(500).send('Failed to update submission: ' + updateErr);

      // Notify the submitter
      const notificationPayload = {
        title: `Report Rejected: ${submission.assignment_title}`,
        message: `Your report has been rejected. Reason: ${rejectionReason}.`,
        type: 'submission_rejected',
        ref_type: 'submission',
        ref_id: Number(submissionId)
      };

      const rejectorName = (req.user?.name || req.user?.email || 'Principal').toString();

      createNotification(submission.submitted_by, notificationPayload)
        .then(async () => {
          // Best-effort email to submitter
          const to = submission.submitted_by_email;
          if (to) {
            const subj = `Report rejected: ${submission.assignment_title}`;
            const msg  = `Report was rejected by ${rejectorName}. The feedback: ${rejectionReason}`;
            try { await sendEmail({ to, subject: subj, html: `<p>${msg}</p>`, text: msg }); } catch (e) { console.error('Email send failed:', e?.message || e); }
          }
          res.json({ success: true, message: 'Report rejected successfully' });
        })
        .catch((notifErr) => {
          console.error('Failed to send rejection notification:', notifErr);
          res.json({ success: true, message: 'Report rejected successfully (notification failed)' });
        });
    });
  });
};