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
 * POST /reports/mps/give
 * Create a report_assignment and seed 1 blank submission per assignee/teacher.
 */
export const giveMPSReport = (req, res) => {
  const {
    category_id,                     // required
    given_by = 5,
    quarter,                         // required
    year,                            // required
    from_date,                       // optional (YYYY-MM-DD)
    to_date,                         // required (YYYY-MM-DD)
    instruction = null,
    is_given = 1,
    is_archived = 0,
    allow_late = 0,

    // recipients: either submitted_by (single) or assignees (array)
    submitted_by,
    assignees,

    // MPS metadata
    title,                           // required (e.g., "MPS - Grade 1")
    grade = 1
  } = req.body || {};

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

  const fromDateVal = from_date
    ? new Date(from_date).toISOString().slice(0,10)
    : new Date().toISOString().slice(0,10);

  const initialFields = buildInitialMpsFields(grade);

  db.query("START TRANSACTION", (txErr) => {
    if (txErr) return res.status(500).send("Failed to start transaction: " + txErr);

    const insertReportSql = `
      INSERT INTO report_assignment
        (category_id, given_by, quarter, year, from_date, to_date, instruction, is_given, is_archived, allow_late)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const reportVals = [
      category_id, given_by, quarter, year, fromDateVal, to_date,
      instruction, is_given, is_archived, allow_late
    ];

    db.query(insertReportSql, reportVals, (insErr, insRes) => {
      if (insErr) {
        return db.query("ROLLBACK", () =>
          res.status(500).send("Failed to insert report: " + insErr)
        );
      }

      const report_assignment_id = insRes.insertId;

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
              submissions_created: recipients.length
            });
          });
        }

        const teacherId = recipients[i];

        // Next number_of_submission for this teacher/category
        const nextNumSql = `
          SELECT COALESCE(MAX(number_of_submission), 0) + 1 AS next_num
          FROM submission
          WHERE submitted_by = ? AND category_id = ?
        `;
        db.query(nextNumSql, [teacherId, category_id], (numErr, numRes) => {
          if (numErr) {
            return db.query("ROLLBACK", () =>
              res.status(500).send("Failed to compute next submission number: " + numErr)
            );
          }

          const nextNum = numRes?.[0]?.next_num || 1;

          const insertSubmissionSql = `
            INSERT INTO submission
              (category_id, submitted_by, status, number_of_submission, value, date_submitted, fields)
            VALUES
              (?, ?, 1, ?, ?, NOW(), ?)
          `;
          const subVals = [
            category_id, teacherId, nextNum, title, initialFields
          ];

          db.query(insertSubmissionSql, subVals, (subErr) => {
            if (subErr) {
              return db.query("ROLLBACK", () =>
                res.status(500).send("Failed to insert submission: " + subErr)
              );
            }
            insertForIdx(i + 1);
          });
        });
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
    SELECT submission_id, category_id, submitted_by, status, number_of_submission,
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
  const { rows, totals } = req.body || {};  // 👈 removed status

  if (!Array.isArray(rows) || !rows.length) {
    return res.status(400).send("rows array is required.");
  }

  // Validate rows
  const traitNames = new Set(TRAITS);
  for (const r of rows) {
    if (!r || !r.trait || !traitNames.has(r.trait)) {
      return res.status(400).send("Invalid rows format (unknown trait).");
    }
    COLS.forEach(k => {
      if (r[k] == null || r[k] === "") r[k] = null;
      else r[k] = Number(r[k]);
    });
  }

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
      rows,
      totals: safeTotals,
      meta: {
        ...(current?.meta || {}),
        updatedAt: new Date().toISOString(),
      }
    };

    const newFields = JSON.stringify(next);

    const updateSql = `UPDATE submission SET fields = ? WHERE submission_id = ?`;
    db.query(updateSql, [newFields, id], (updErr) => {
      if (updErr) return res.status(500).send("Update failed: " + updErr);
      res.json({ ok: true });
    });
  });
};
