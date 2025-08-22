import db from '../db.js';

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
    SELECT s.submission_id, s.category_id, s.submitted_by, s.status,
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
  const status = body.status;

  let answers = {};
  const input = body.answers ?? {};
  if (typeof input === 'string') {
    try { answers = JSON.parse(input); } catch { answers = {}; }
  } else if (input && typeof input === 'object') {
    answers = input;
  }

  const selectSql = `SELECT fields FROM submission WHERE submission_id = ?`;
  db.query(selectSql, [id], (selErr, selRes) => {
    if (selErr) return res.status(500).send('Database error: ' + selErr);
    if (!selRes.length) return res.status(404).send('Submission not found.');

    let current = {};
    try {
      current = typeof selRes[0].fields === 'string' ? JSON.parse(selRes[0].fields) : (selRes[0].fields || {});
    } catch { current = {}; }

    const next = {
      _form: current._form || { title: '', fields: [] },
      _answers: { ...(current._answers || {}), ...answers },
    };

    const sets = ['fields = ?'];
    const params = [JSON.stringify(next)];

    if (Number.isInteger(status)) { // <— ensure INT if schema expects it
      sets.push('status = ?');
      params.push(status);
    }

    const updateSql = `UPDATE submission SET ${sets.join(', ')} WHERE submission_id = ?`;
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
        res.json(normalizeFields(fRes[0]));
      });
    });
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

  // — Accept body as rows[] or data{} (string or object) —
  const body   = req.body || {};
  const status = body.status;      // optional numeric status (e.g., 2 = submitted)
  const grade  = body.grade;       // optional grade override

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
  } catch {
    rowsNormalized = [];
  }

  // — Normalize to exact shape and clamp —
  const cleanRows = TRAITS.map(trait => {
    const src = rowsNormalized.find(r => (r?.trait || '').toLowerCase() === trait.toLowerCase()) || {};
    const cleaned = { trait };
    COLS.forEach(c => { cleaned[c.key] = clamp(src[c.key], c.min, c.max); });
    return cleaned;
  });

  // — Totals (ignore nulls) —
  const totals = COLS.reduce((acc, c) => {
    acc[c.key] = cleanRows.reduce((sum, r) => sum + (r[c.key] ?? 0), 0);
    return acc;
  }, {});

  // — Fetch submission created by give step —
  const selectSql = `SELECT fields FROM submission WHERE submission_id = ?`;
  db.query(selectSql, [id], (selErr, selRes) => {
    if (selErr) return res.status(500).send('Database error: ' + selErr);
    if (!selRes.length) return res.status(404).send('Submission not found.');

    // Parse/initialize fields JSON
    let current = {};
    try {
      current = typeof selRes[0].fields === 'string'
        ? JSON.parse(selRes[0].fields)
        : (selRes[0].fields || {});
    } catch { current = {}; }

    // If this submission wasn’t seeded correctly, initialize a LAEMPL skeleton.
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
      rows: cleanRows.length ? cleanRows : ensureRows(), // if body empty, keep existing shape
      totals,
      meta: {
        ...(current.meta || {}),
        updatedAt: new Date().toISOString(),
      }
    };

    const sets = ['fields = ?', 'date_submitted = NOW()'];
    const params = [JSON.stringify(nextFields)];
    if (typeof status === 'number') {
      sets.push('status = ?');
      params.push(status);
    }

    const updateSql = `UPDATE submission SET ${sets.join(', ')} WHERE submission_id = ?`;
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


// DELETE submission
export const deleteSubmission = (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM submission WHERE submission_id = ?';
  db.query(sql, [id], (err) => {
    if (err) return res.status(500).send('Delete failed: ' + err);
    res.send(`Submission with ID ${id} has been deleted.`);
  });
};
