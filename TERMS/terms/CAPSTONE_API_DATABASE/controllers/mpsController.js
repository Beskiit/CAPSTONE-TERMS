import db from "../db.js";

const TRAITS = ["Masipag","Matulungin","Masunurin","Magalang","Matapat","Matiyaga"];
const COLS   = ["m","f","total","mean","median","pl","mps","sd","target","hs","ls"];

const emptyRow = () => COLS.reduce((o,k)=> (o[k]=null, o), {});

/** Build initial blank JSON payload for a submission */
function buildInitialMpsFields(grade=1) {
  return JSON.stringify({
    type: "MPS",
    grade,
    rows: TRAITS.map(trait => ({ trait, ...emptyRow() })),
    totals: COLS.reduce((o,k)=> (o[k]=0, o), {}),
    meta: { createdAt: new Date().toISOString() }
  });
}

/**
 * POST /mps/assign  (Give MPS Report) — FIXED
 * Creates a report_assignment and seeds 1 blank submission per assignee/teacher,
 * linking each submission via report_assignment_id (FK).
 */
export const giveMPSReport = (req, res) => {
  // Get the authenticated user's ID
  const authenticatedUserId = req.user?.user_id;
  if (!authenticatedUserId) {
    return res.status(401).send('Authentication required');
  }

  const {
    category_id,                     // required
    sub_category_id,                 // optional (keep if your UI/categories use it)
    given_by = authenticatedUserId,
    quarter,                         // required
    year,                            // required
    from_date,                       // optional (YYYY-MM-DD)
    to_date,                         // required (YYYY-MM-DD)
    instruction = null,
    is_given = 1,
    is_archived = 0,
    allow_late = 0,

    // recipients
    submitted_by,
    assignees,

    // MPS metadata
    title,                           // required (e.g., "MPS - Grade 1")
    grade = 1,

    // number-of-submission picker
    number_of_submission,            // single value or "unlimited"/"auto"
    number_of_submissions            // array aligned with assignees
  } = req.body || {};

  // ---- Validation ----
  if (category_id == null || quarter == null || year == null || !to_date) {
    return res.status(400).send("category_id, quarter, year, and to_date are required.");
  }
  if (!title || typeof title !== "string") {
    return res.status(400).send("title is required (string).");
  }

  const recipients =
    Array.isArray(assignees) && assignees.length
      ? assignees
      : (submitted_by != null ? [submitted_by] : []);

  if (!recipients.length) {
    return res.status(400).send("Provide submitted_by or a non-empty assignees array.");
  }

  // Accept number_of_submissions array; lengths must match
  const hasPerRecipientNos = Array.isArray(number_of_submissions);
  if (hasPerRecipientNos && number_of_submissions.length !== recipients.length) {
    return res.status(400).send("number_of_submissions length must match assignees length.");
  }

  // If UI accidentally sends number_of_submission as [3], unwrap it
  let _number_of_submission = number_of_submission;
  if (Array.isArray(_number_of_submission)) {
    _number_of_submission = _number_of_submission.length ? _number_of_submission[0] : undefined;
  }

  const fromDateVal = from_date
    ? new Date(from_date).toISOString().slice(0,10)
    : new Date().toISOString().slice(0,10);

  // Normalize booleans to 0/1 to avoid NULL/boolean issues
  const _is_given    = Number(Boolean(is_given));
  const _is_archived = Number(Boolean(is_archived));
  const _allow_late  = Number(Boolean(allow_late));

  // ---- Build initial MPS fields ----
  const initialFields = buildInitialMpsFields(grade);

  // Helper: next available slot PER (submitted_by, report_assignment_id)
  const computeNextNum = (userId, reportAssignmentId, cb) => {
    const nextNumSql = `
      SELECT COALESCE(MAX(number_of_submission), 0) + 1 AS next_num
      FROM submission
      WHERE submitted_by = ? AND report_assignment_id = ?
    `;
    db.query(nextNumSql, [userId, reportAssignmentId], (err, rows) => {
      if (err) return cb(err);
      cb(null, rows?.[0]?.next_num || 1);
    });
  };

  // Treat null/empty/"unlimited"/"auto" as auto-next
  const isAutoLike = (v) => {
    if (v == null || v === '') return true;
    const s = String(v).toLowerCase();
    return s === 'unlimited' || s === 'auto';
  };

  const assigned = []; // [{ user_id, number_of_submission }]

  db.query("START TRANSACTION", (txErr) => {
    if (txErr) return res.status(500).send("Failed to start transaction: " + txErr);

    // 1) Insert the assignment (include sub_category_id if you use it)
    const insertReportSql = `
      INSERT INTO report_assignment
        (category_id, sub_category_id, given_by, quarter, year, from_date, to_date, instruction, is_given, is_archived, allow_late, title)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const reportVals = [
      category_id,
      sub_category_id ?? null,
      given_by,
      quarter,
      year,
      fromDateVal,
      to_date,
      instruction,
      _is_given,
      _is_archived,
      _allow_late,
      title
    ];

    db.query(insertReportSql, reportVals, (insErr, insRes) => {
      if (insErr) {
        return db.query("ROLLBACK", () =>
          res.status(500).send("Failed to insert report: " + insErr)
        );
      }

      const report_assignment_id = insRes.insertId;

      // 2) Insert one blank submission per recipient — with FK
      const insertForIdx = (i) => {
        if (i >= recipients.length) {
          return db.query("COMMIT", (cErr) => {
            if (cErr) {
              return db.query("ROLLBACK", () =>
                res.status(500).send("Commit failed: " + cErr)
              );
            }
            return res.status(201).json({
              report_assignment_id,
              submissions_created: recipients.length,
              assigned
            });
          });
        }

        const teacherId = recipients[i];

        // Decide slot: per-recipient array → single value → auto
        const desiredRaw = hasPerRecipientNos
          ? number_of_submissions[i]
          : _number_of_submission;

        const proceedInsert = (finalNo) => {
          const insertSubmissionSql = `
            INSERT INTO submission
              (report_assignment_id, category_id, submitted_by, status, number_of_submission, value, date_submitted, fields)
            VALUES
              (?, ?, ?, 1, ?, ?, NOW(), ?)
          `;
          const subVals = [
            report_assignment_id, // ✅ real FK
            category_id,
            teacherId,
            finalNo,
            title,
            initialFields
          ];

          db.query(insertSubmissionSql, subVals, (subErr) => {
            if (subErr) {
              return db.query("ROLLBACK", () =>
                res.status(500).send("Failed to insert submission: " + subErr)
              );
            }
            assigned.push({ user_id: teacherId, number_of_submission: finalNo });
            insertForIdx(i + 1);
          });
        };

        if (isAutoLike(desiredRaw)) {
          computeNextNum(teacherId, report_assignment_id, (nErr, nextNum) => {
            if (nErr) {
              return db.query("ROLLBACK", () =>
                res.status(500).send("Failed to compute next submission number: " + nErr)
              );
            }
            proceedInsert(nextNum);
          });
        } else {
          const n = Number(desiredRaw);
          if (Number.isFinite(n) && n > 0) {
            proceedInsert(n);
          } else {
            return db.query("ROLLBACK", () =>
              res.status(400).send("Invalid number_of_submission value.")
            );
          }
        }
      };

      insertForIdx(0);
    });
  });
};


/**
 * GET /submissions/mps/:id
 * Return the submission (including parsed fields JSON).
 */
export const getMPSSubmission = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT submission_id, report_assignment_id, category_id, submitted_by, status, number_of_submission,
           value, DATE_FORMAT(date_submitted,'%Y-%m-%d %H:%i:%s') AS date_submitted,
           fields
    FROM submission
    WHERE submission_id = ?
  `;
  db.query(sql, [id], (err, rows) => {
    if (err) return res.status(500).send("DB error: " + err);
    if (!rows.length) return res.status(404).send("Submission not found.");
    const row = rows[0];
    let parsed;
    try { parsed = JSON.parse(row.fields || "{}"); } catch { parsed = {}; }
    res.json({ ...row, fields: parsed });
  });
};

export const patchMPSSubmission = (req, res) => {
  const { id } = req.params;
  const { rows, totals, status } = req.body || {};  // editing form data and status

  if (!Array.isArray(rows) || !rows.length) {
    return res.status(400).send("rows array is required.");
  }

  // Validate/normalize rows
  const traitNames = new Set(TRAITS);
  const normRows = rows.map((r) => {
    if (!r || !r.trait || !traitNames.has(r.trait)) {
      throw new Error("Invalid rows format (unknown trait).");
    }
    const copy = { trait: r.trait };
    COLS.forEach(k => {
      const v = r[k];
      copy[k] = (v == null || v === "") ? null : Number(v);
    });
    return copy;
  });

  const safeTotals = COLS.reduce((o, k) => {
    const v = totals?.[k];
    o[k] = (v == null || v === "") ? 0 : Number(v);
    return o;
  }, {});

  const selectSql = `SELECT fields FROM submission WHERE submission_id = ?`;
  db.query(selectSql, [id], (selErr, rowsDb) => {
    if (selErr) return res.status(500).send("DB error: " + selErr);
    if (!rowsDb.length) return res.status(404).send("Submission not found.");

    let current = {};
    try { current = JSON.parse(rowsDb[0].fields || "{}"); } catch {}

    const next = {
      ...(current || {}),
      type: "MPS",
      rows: normRows,
      totals: safeTotals,
      meta: {
        ...(current?.meta || {}),
        updatedAt: new Date().toISOString(),
      }
    };

    const newFields = JSON.stringify(next);

    // Handle status update if provided
    let updateSql = `UPDATE submission SET fields = ?`;
    let params = [newFields];
    
    if (typeof status === 'number') {
      updateSql += `, status = ?, date_submitted = NOW()`;
      params.push(status);
    }
    
    updateSql += ` WHERE submission_id = ?`;
    params.push(id);

    db.query(updateSql, params, (updErr) => {
      if (updErr) return res.status(500).send("Update failed: " + updErr);
      res.json({ ok: true, status: status });
    });
  });
};
