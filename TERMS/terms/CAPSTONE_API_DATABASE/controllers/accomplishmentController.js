import db from "../db.js";

/** Build initial blank JSON for the accomplishment submission */
function buildInitialAccFields() {
  return JSON.stringify({
    type: "ACCOMPLISHMENT",
    narrative: "",
    images: [],                  // store file names (or relative paths)
    meta: { createdAt: new Date().toISOString() }
  });
}

/**
 * POST /reports/accomplishment/give
 * Creates 1 report_assignment and seeds 1 blank submission per assignee/teacher.
 * Body:
 *  - category_id, quarter, year, to_date, title (required)
 *  - from_date (optional), instruction, is_given, is_archived, allow_late
 *  - submitted_by (single) OR assignees (array)
 */
export const giveAccomplishmentReport = (req, res) => {
  const {
    category_id, given_by = 5, quarter, year, from_date, to_date,
    instruction = null, is_given = 1, is_archived = 0, allow_late = 0,
    submitted_by, assignees,
    title // e.g. "Activity Completion Report"
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

  const initialFields = buildInitialAccFields();

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
          const subVals = [category_id, teacherId, nextNum, title, initialFields];

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
 * GET /submissions/accomplishment/:id
 * Returns submission with parsed `fields`
 */
export const getAccomplishmentSubmission = (req, res) => {
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

/**
 * PATCH /submissions/accomplishment/:id
 * Accepts:
 *  - narrative (string)
 *  - removeImages (array of file names to remove) [optional]
 *  - images (multipart files) to ADD to existing list [optional]
 *
 * Keeps status untouched. Only updates `fields`.
 */
export const patchAccomplishmentSubmission = (req, res) => {
  const { id } = req.params;
  const { narrative = null, removeImages } = req.body || {};
  const files = Array.isArray(req.files) ? req.files : [];

  const selectSql = `SELECT fields FROM submission WHERE submission_id = ?`;
  db.query(selectSql, [id], (selErr, rowsDb) => {
    if (selErr) return res.status(500).send("DB error: " + selErr);
    if (!rowsDb.length) return res.status(404).send("Submission not found.");

    let current = {};
    try { current = JSON.parse(rowsDb[0].fields || "{}"); } catch {}

    const currImages = Array.isArray(current?.images) ? current.images : [];
    const addImages = files.map(f => f.filename);

    // Remove requested images by exact file name
    const removeSet = new Set(
      Array.isArray(removeImages)
        ? removeImages
        : (typeof removeImages === "string" ? [removeImages] : [])
    );
    const kept = currImages.filter(nm => !removeSet.has(nm));

    const next = {
      ...(current || {}),
      type: "ACCOMPLISHMENT",
      narrative: narrative != null ? String(narrative) : (current?.narrative || ""),
      images: [...kept, ...addImages],
      meta: {
        ...(current?.meta || {}),
        updatedAt: new Date().toISOString(),
      }
    };

    const newFields = JSON.stringify(next);

    const updateSql = `UPDATE submission SET fields = ? WHERE submission_id = ?`;
    db.query(updateSql, [newFields, id], (updErr) => {
      if (updErr) return res.status(500).send("Update failed: " + updErr);
      res.json({ ok: true, imagesAdded: addImages.length, imagesRemoved: removeSet.size });
    });
  });
};
