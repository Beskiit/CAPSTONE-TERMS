import db from "../db.js";
import { createNotificationsBulk } from './notificationsController.js';

/** Build initial blank JSON for the accomplishment submission */
function buildInitialAccFields() {
  return JSON.stringify({
    type: "ACCOMPLISHMENT",
    narrative: "",
    images: [], // store file names (or relative paths)
    meta: { createdAt: new Date().toISOString() },
  });
}

/**
 * POST /reports/accomplishment/give
 * Creates 1 report_assignment and seeds 1 blank submission per assignee/teacher.
 */
export const giveAccomplishmentReport = (req, res) => {
  const {
    category_id,
    sub_category_id,
    given_by = 5,
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
    title, // e.g. "Activity Completion Report"
  } = req.body || {};

  if (category_id == null || quarter == null || year == null || !to_date) {
    return res
      .status(400)
      .send("category_id, quarter, year, and to_date are required.");
  }
  if (!title || typeof title !== "string") {
    return res.status(400).send("title is required (string).");
  }

  const recipients =
    Array.isArray(assignees) && assignees.length
      ? assignees
      : submitted_by != null
      ? [submitted_by]
      : [];

  if (!recipients.length) {
    return res
      .status(400)
      .send("Provide submitted_by or a non-empty assignees array.");
  }

  const fromDateVal = from_date
    ? new Date(from_date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const _is_given = Number(Boolean(is_given));
  const _is_archived = Number(Boolean(is_archived));
  const _allow_late = Number(Boolean(allow_late));

  const initialFields = buildInitialAccFields();

  // Helper: get next attempt numbers for all recipients at once
  const computeNextNums = (userIds, reportAssignmentId, cb) => {
    if (userIds.length === 0) return cb(null, {});
    
    const placeholders = userIds.map(() => '?').join(',');
    const sql = `
      SELECT submitted_by, COALESCE(MAX(number_of_submission), 0) + 1 AS next_num
      FROM submission
      WHERE submitted_by IN (${placeholders}) AND report_assignment_id = ?
      GROUP BY submitted_by
    `;
    
    db.query(sql, [...userIds, reportAssignmentId], (err, rows) => {
      if (err) return cb(err);
      
      const nextNums = {};
      rows.forEach(row => {
        nextNums[row.submitted_by] = row.next_num;
      });
      
      // Set default value of 1 for users not found
      userIds.forEach(userId => {
        if (!(userId in nextNums)) {
          nextNums[userId] = 1;
        }
      });
      
      cb(null, nextNums);
    });
  };

  db.query("START TRANSACTION", (txErr) => {
    if (txErr) return res.status(500).send("Failed to start transaction: " + txErr);

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
      title,
    ];

    db.query(insertReportSql, reportVals, (insErr, insRes) => {
      if (insErr) {
        return db.query("ROLLBACK", () =>
          res.status(500).send("Failed to insert report: " + insErr)
        );
      }

      const report_assignment_id = insRes.insertId;

      // Get next submission numbers for all recipients at once
      computeNextNums(recipients, report_assignment_id, (nErr, nextNums) => {
        if (nErr) {
          return db.query("ROLLBACK", () =>
            res.status(500).send("Failed to compute next submission numbers: " + nErr)
          );
        }

        // Create all submissions in parallel
        const submissionPromises = recipients.map(teacherId => {
          return new Promise((resolve, reject) => {
            const insertSubmissionSql = `
              INSERT INTO submission
                (report_assignment_id, category_id, submitted_by, status, number_of_submission, value, date_submitted, fields)
              VALUES
                (?, ?, ?, 1, ?, ?, NOW(), ?)
            `;
            const subVals = [
              report_assignment_id,
              category_id,
              teacherId,
              nextNums[teacherId],
              title,
              initialFields,
            ];

            db.query(insertSubmissionSql, subVals, (subErr) => {
              if (subErr) {
                reject(subErr);
              } else {
                resolve();
              }
            });
          });
        });

        // Wait for all submissions to be created
        Promise.all(submissionPromises)
          .then(() => {
            // Create notifications
            const nameSql = `SELECT name FROM user_details WHERE user_id = ? LIMIT 1`;
            db.query(nameSql, [given_by], (_e, nRows) => {
              const giverName = (nRows && nRows[0] && nRows[0].name) ? nRows[0].name : 'Coordinator';
              const notifications = recipients.map((uid) => ({
                user_id: uid,
                title: `New report assigned: ${title}`,
                message: `Assigned by ${giverName} — due on ${to_date}.`,
                type: 'report_assigned',
                ref_type: 'report_assignment',
                ref_id: report_assignment_id,
              }));
              
              createNotificationsBulk(notifications, () => {
                db.query("COMMIT", (cErr) => {
                  if (cErr) {
                    return db.query("ROLLBACK", () =>
                      res.status(500).send("Commit failed: " + cErr)
                    );
                  }
                  return res
                    .status(201)
                    .json({ report_assignment_id, submissions_created: recipients.length });
                });
              });
            });
          })
          .catch((err) => {
            db.query("ROLLBACK", () =>
              res.status(500).send("Failed to create submissions: " + err)
            );
          });
      });
    });
  });
};

/**
 * GET /reports/accomplishment/:id
 * Returns submission with parsed `fields`
 */
export const getAccomplishmentSubmission = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT s.submission_id, s.report_assignment_id, s.category_id, s.submitted_by, s.status, s.number_of_submission,
           s.value, DATE_FORMAT(s.date_submitted,'%Y-%m-%d %H:%i:%s') AS date_submitted,
           s.fields, ud.name AS submitted_by_name
    FROM submission s
    LEFT JOIN user_details ud ON s.submitted_by = ud.user_id
    WHERE s.submission_id = ?
  `;
  db.query(sql, [id], (err, rows) => {
    if (err) return res.status(500).send("DB error: " + err);
    if (!rows.length) return res.status(404).send("Submission not found.");
    const row = rows[0];
    let parsed;
    try {
      parsed = JSON.parse(row.fields || "{}");
    } catch {
      parsed = {};
    }
    res.json({ ...row, fields: parsed });
  });
};

/**
 * PATCH /reports/accomplishment/:id
 * Accepts narrative, removeImages[], images (multipart), and optional status.
 */
export const patchAccomplishmentSubmission = (req, res) => {
  const { id } = req.params;
  const { 
    narrative = null, 
    removeImages, 
    status,
    rejection_reason,
    // Activity fields from coordinator
    activityName,
    facilitators,
    objectives,
    date,
    time,
    venue,
    keyResult,
    personsInvolved,
    expenses
  } = req.body || {};
  const files = Array.isArray(req.files) ? req.files : [];

  const selectSql = `SELECT fields FROM submission WHERE submission_id = ?`;
  db.query(selectSql, [id], (selErr, rowsDb) => {
    if (selErr) return res.status(500).send("DB error: " + selErr);
    if (!rowsDb.length) return res.status(404).send("Submission not found.");

    let current = {};
    try {
      current = JSON.parse(rowsDb[0].fields || "{}");
    } catch {}

    const currImages = Array.isArray(current?.images) ? current.images : [];
    const addImages = files.map((f) => f.filename);

    const removeSet = new Set(
      Array.isArray(removeImages)
        ? removeImages
        : typeof removeImages === "string"
        ? [removeImages]
        : []
    );
    const kept = currImages.filter((nm) => !removeSet.has(nm));

    const next = {
      ...(current || {}),
      type: "ACCOMPLISHMENT",
      narrative:
        narrative != null ? String(narrative) : current?.narrative || "",
      images: [...kept, ...addImages],
      // Store rejection reason if provided
      ...(rejection_reason !== undefined && { rejection_reason }),
      // Store activity data from coordinator
      activity: {
        activityName: activityName || current?.activity?.activityName || "",
        facilitators: facilitators || current?.activity?.facilitators || "",
        objectives: objectives || current?.activity?.objectives || "",
        date: date || current?.activity?.date || "",
        time: time || current?.activity?.time || "",
        venue: venue || current?.activity?.venue || "",
        keyResult: keyResult || current?.activity?.keyResult || "",
        personsInvolved: personsInvolved || current?.activity?.personsInvolved || "",
        expenses: expenses || current?.activity?.expenses || "",
      },
      meta: { ...(current?.meta || {}), updatedAt: new Date().toISOString() },
    };

    const newFields = JSON.stringify(next);

    // Only update status if it's provided and valid
    const newStatus = Number.isFinite(Number(status)) ? Number(status) : null;
    const updateSql = newStatus !== null 
      ? `UPDATE submission SET fields = ?, status = ? WHERE submission_id = ?`
      : `UPDATE submission SET fields = ? WHERE submission_id = ?`;
    const updateParams = newStatus !== null ? [newFields, newStatus, id] : [newFields, id];
    
    db.query(updateSql, updateParams, (updErr) => {
      if (updErr) return res.status(500).send("Update failed: " + updErr);
      // If approved or rejected, notify submitter
      if (newStatus === 3 || newStatus === 4) {
        const metaSql = `
          SELECT s.submitted_by, ra.title
          FROM submission s
          JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
          WHERE s.submission_id = ?
        `;
        db.query(metaSql, [id], (mErr, mRows) => {
          if (!mErr && mRows?.length) {
            const meta = mRows[0];
            const title = newStatus === 3 ? `Submission approved: ${meta.title}` : `Submission rejected: ${meta.title}`;
            const message = newStatus === 3 ? 'Your submission has been approved.' : 'Your submission was rejected. Please review the feedback.';
            import('./notificationsController.js').then(({ createNotification }) => {
              createNotification(meta.submitted_by, {
                title,
                message,
                type: newStatus === 3 ? 'submission_approved' : 'submission_rejected',
                ref_type: 'submission',
                ref_id: Number(id),
              });
            });
          }
        });
      }
      res.json({
        ok: true,
        imagesAdded: addImages.length,
        imagesRemoved: removeSet.size,
      });
    });
  });
};

/**
 * GET /reports/accomplishment/:id/peers
 * Returns grouped peer submissions for the same report_assignment_id, with images grouped by normalized title.
 */
export const getAccomplishmentPeers = (req, res) => {
  const { id } = req.params;
  const ra = req.query.ra; // optional report_assignment_id

  console.log("getAccomplishmentPeers:", { id, ra });

  const fetchSqlFromSubmission = `
    SELECT s2.submission_id, s2.report_assignment_id, s2.value AS title, s2.status, s2.fields
    FROM submission s
    JOIN submission s2 ON s2.report_assignment_id = s.report_assignment_id
    WHERE s.submission_id = ? AND s2.status >= 2
  `;

  // NOTE: exclude current submission when ra= is provided
  // Only get submissions from TEACHERS (role = 'teacher'), not coordinators
  // Look for ALL teacher submissions with status >= 2, regardless of coordinator
  const fetchSqlFromRA = `
    SELECT s.submission_id, s.report_assignment_id, s.value AS title, s.status, s.fields
    FROM submission s
    JOIN user_details ud ON s.submitted_by = ud.user_id
    JOIN report_assignment ra ON s.report_assignment_id = ra.report_assignment_id
    WHERE s.submission_id <> ?
      AND s.status >= 2
      AND LOWER(ud.role) = 'teacher'
  `;
  
  console.log("=== DEBUGGING QUERY ===");
  console.log("Query:", fetchSqlFromRA);
  console.log("Parameters:", [ra, id]);
  
  // Debug: Check what coordinator created assignment 74
  const coordinatorCheckSql = `SELECT given_by FROM report_assignment WHERE report_assignment_id = ?`;
  db.query(coordinatorCheckSql, [ra], (err, coordinatorRows) => {
    if (err) {
      console.log("Error checking coordinator:", err);
    } else {
      console.log("=== COORDINATOR CHECK ===");
      console.log("Assignment 74 coordinator:", coordinatorRows);
      
      // Debug: Check what coordinator created assignment 75 (teacher's assignment)
      db.query(coordinatorCheckSql, ['75'], (err2, coordinatorRows2) => {
        if (err2) {
          console.log("Error checking coordinator for 75:", err2);
        } else {
          console.log("Assignment 75 coordinator:", coordinatorRows2);
          console.log("Are coordinators the same?", coordinatorRows[0]?.given_by === coordinatorRows2[0]?.given_by);
          
          // Debug: Let's also check what the actual query is looking for
          const testQuery = `
            SELECT s.submission_id, s.report_assignment_id, s.value AS title, s.status, s.fields, ud.role, ud.name, ra.given_by
            FROM submission s
            JOIN user_details ud ON s.submitted_by = ud.user_id
            JOIN report_assignment ra ON s.report_assignment_id = ra.report_assignment_id
            WHERE ra.given_by = ?
              AND s.status >= 2
              AND LOWER(ud.role) = 'teacher'
          `;
          
          db.query(testQuery, [coordinatorRows[0]?.given_by], (testErr, testRows) => {
            if (testErr) {
              console.log("Error in test query:", testErr);
            } else {
              console.log("=== TEST QUERY RESULTS ===");
              console.log(`Found ${testRows?.length || 0} teacher submissions for coordinator ${coordinatorRows[0]?.given_by}`);
              if (testRows && testRows.length > 0) {
                testRows.forEach((row, idx) => {
                  console.log(`Test Result ${idx + 1}:`, {
                    submission_id: row.submission_id,
                    report_assignment_id: row.report_assignment_id,
                    title: row.title,
                    status: row.status,
                    role: row.role,
                    name: row.name,
                    given_by: row.given_by
                  });
                });
              }
            }
          });
        }
      });
    }
  });

  // Debug: Let's also check what submissions exist for this assignment
  const debugSql = `
    SELECT s.submission_id, s.report_assignment_id, s.value AS title, s.status, s.fields, ud.role, ud.name
    FROM submission s
    LEFT JOIN user_details ud ON s.submitted_by = ud.user_id
    WHERE s.report_assignment_id = ?
  `;
  
  // Debug: Let's also check ALL teacher submissions regardless of report_assignment_id
  const debugAllTeachersSql = `
    SELECT s.submission_id, s.report_assignment_id, s.value AS title, s.status, s.fields, ud.role, ud.name
    FROM submission s
    LEFT JOIN user_details ud ON s.submitted_by = ud.user_id
    WHERE LOWER(ud.role) = 'teacher' AND s.status >= 2
  `;

  const run = (sql, params) => {
    console.log("Running query:", sql, "with params:", params);
    
    // First, let's debug what submissions exist for this assignment
    if (ra) {
      console.log("Debug: Checking all submissions for report_assignment_id:", ra);
      
      // Check ALL teacher submissions first
      db.query(debugAllTeachersSql, [], (allTeachersErr, allTeachersRows) => {
        console.log("=== ALL TEACHER SUBMISSIONS (status >= 2) ===");
        if (allTeachersErr) {
          console.log("Error fetching all teacher submissions:", allTeachersErr);
        } else {
          console.log(`Found ${allTeachersRows?.length || 0} teacher submissions with status >= 2`);
          if (allTeachersRows && allTeachersRows.length > 0) {
            console.log("=== DETAILED TEACHER SUBMISSIONS ===");
            allTeachersRows.forEach((row, idx) => {
              console.log(`Teacher Submission ${idx + 1}:`, {
                submission_id: row.submission_id,
                report_assignment_id: row.report_assignment_id,
                status: row.status,
                title: row.title,
                role: row.role,
                name: row.name,
                submitted_by: row.submitted_by,
                fields: row.fields ? JSON.parse(row.fields) : null
              });
            });
            
            // Check which teacher submissions match the current assignment
            const matchingTeachers = allTeachersRows.filter(row => row.report_assignment_id == ra);
            console.log(`=== TEACHER SUBMISSIONS FOR CURRENT ASSIGNMENT (${ra}) ===`);
            console.log(`Matching teacher submissions: ${matchingTeachers.length}`);
            if (matchingTeachers.length > 0) {
              matchingTeachers.forEach((row, idx) => {
                console.log(`Matching Teacher ${idx + 1}:`, {
                  submission_id: row.submission_id,
                  report_assignment_id: row.report_assignment_id,
                  status: row.status,
                  title: row.title,
                  name: row.name
                });
              });
            } else {
              console.log("NO teacher submissions found for current assignment!");
              console.log("Teacher submissions are for different assignments:");
              allTeachersRows.forEach((row, idx) => {
                console.log(`  Teacher ${idx + 1}: Assignment ${row.report_assignment_id} (not ${ra})`);
              });
            }
          } else {
            console.log("NO teacher submissions found anywhere in the system!");
          }
        }
        
        // Now check submissions for the specific assignment
        db.query(debugSql, [ra], (debugErr, debugRows) => {
          console.log("Debug query result:", { debugErr, debugRowCount: debugRows?.length, debugRows });
        
        // Show each submission's details
        if (debugRows && debugRows.length > 0) {
          console.log("=== ALL SUBMISSIONS FOR THIS ASSIGNMENT ===");
          debugRows.forEach((row, idx) => {
            console.log(`Submission ${idx + 1}:`, {
              submission_id: row.submission_id,
              status: row.status,
              title: row.title,
              role: row.role,
              name: row.name,
              submitted_by: row.submitted_by,
              fields: row.fields ? JSON.parse(row.fields) : null
            });
          });
          
          // Check specifically for teacher submissions
          const teacherSubmissions = debugRows.filter(row => row.role === 'teacher');
          const submittedTeacherSubmissions = teacherSubmissions.filter(row => row.status >= 2);
          
          console.log(`=== TEACHER SUBMISSIONS ANALYSIS ===`);
          console.log(`Total submissions: ${debugRows.length}`);
          console.log(`Teacher submissions: ${teacherSubmissions.length}`);
          console.log(`Submitted teacher submissions (status >= 2): ${submittedTeacherSubmissions.length}`);
          
          if (teacherSubmissions.length > 0) {
            console.log("Teacher submissions found:");
            teacherSubmissions.forEach((row, idx) => {
              console.log(`  Teacher ${idx + 1}: ID=${row.submission_id}, Status=${row.status}, Name=${row.name}`);
            });
          }
        } else {
          console.log("NO SUBMISSIONS FOUND for report_assignment_id:", ra);
        }
        
        // Now run the actual query
        db.query(sql, [ra, ra, id], (err, rows) => {
          console.log("Query result:", { err, rowCount: rows?.length, rows });
          if (err) return res.status(500).send("DB error: " + err);
          const groups = new Map();
          for (const r of rows || []) {
            let fieldsObj = {};
            try {
              fieldsObj =
                typeof r.fields === "string" ? JSON.parse(r.fields) : r.fields || {};
            } catch {}
            const imgs = Array.isArray(fieldsObj._answers?.images) ? fieldsObj._answers.images : [];
            const title = (r.title || fieldsObj.title || "Untitled").trim();
            const key = title.toLowerCase();
            const g =
              groups.get(key) || { title, submissions: [], images: new Set() };
            imgs.forEach((nm) => g.images.add(nm));
            const innerForm = fieldsObj?._form || {};
            const innerFields = innerForm.fields || {};
            const narrativeText = String(
              fieldsObj.narrative ||
              fieldsObj.text ||
              innerForm.narrative ||
              innerForm.text ||
              innerFields.narrative ||
              innerFields.text ||
              ""
            ).trim();
            g.submissions.push({ submission_id: r.submission_id, images: imgs, narrative: narrativeText, fields: fieldsObj });
            groups.set(key, g);
          }
          const out = Array.from(groups.values()).map((g) => ({
            title: g.title,
            images: Array.from(g.images),
            submissions: g.submissions,
          }));
          console.log("Final output:", out);
          res.json(out);
        });
        });
      });
    } else {
      // Original logic for non-RA queries
      db.query(sql, params, (err, rows) => {
        console.log("Query result:", { err, rowCount: rows?.length, rows });
        if (err) return res.status(500).send("DB error: " + err);
        const groups = new Map();
        for (const r of rows || []) {
          let fieldsObj = {};
          try {
            fieldsObj =
              typeof r.fields === "string" ? JSON.parse(r.fields) : r.fields || {};
          } catch {}
          const imgs = Array.isArray(fieldsObj.images) ? fieldsObj.images : [];
          const title = (r.title || fieldsObj.title || "Untitled").trim();
          const key = title.toLowerCase();
          const g =
            groups.get(key) || { title, submissions: [], images: new Set() };
          imgs.forEach((nm) => g.images.add(nm));
          const innerForm = fieldsObj?._form || {};
          const innerFields = innerForm.fields || {};
          const narrativeText = String(
            fieldsObj.narrative ||
            fieldsObj.text ||
            innerForm.narrative ||
            innerForm.text ||
            innerFields.narrative ||
            innerFields.text ||
            ""
          ).trim();
          g.submissions.push({ submission_id: r.submission_id, images: imgs, narrative: narrativeText, fields: fieldsObj });
          groups.set(key, g);
        }
        const out = Array.from(groups.values()).map((g) => ({
          title: g.title,
          images: Array.from(g.images),
          submissions: g.submissions,
        }));
        console.log("Final output:", out);
        res.json(out);
      });
    }
  };

  if (ra) return run(fetchSqlFromRA, [id]);
  return run(fetchSqlFromSubmission, [id]);
};

/**
 * POST /reports/accomplishment/:id/consolidate
 * Body: { title: string }
 * Merges images from all submitted peer submissions sharing the same normalized title into the current submission's images array.
 */
export const consolidateAccomplishmentByTitle = (req, res) => {
  const { id } = req.params;
  const { title } = req.body || {};
  if (!title) return res.status(400).json({ error: "title is required" });

  // Use the same logic as the peers query - find ALL teacher submissions with status >= 2
  const peersSql = `
    SELECT s.submission_id, s.report_assignment_id, s.value AS title, s.status, s.fields
    FROM submission s
    JOIN user_details ud ON s.submitted_by = ud.user_id
    JOIN report_assignment ra ON s.report_assignment_id = ra.report_assignment_id
    WHERE s.submission_id <> ?
      AND s.status >= 2
      AND LOWER(ud.role) = 'teacher'
  `;
  db.query(peersSql, [id], (err, rows) => {
    if (err) return res.status(500).send("DB error: " + err);
    const targetKey = String(title).trim().toLowerCase();
    const combined = new Set();
    for (const r of rows || []) {
      let fieldsObj = {};
      try {
        fieldsObj =
          typeof r.fields === "string" ? JSON.parse(r.fields) : r.fields || {};
      } catch {}
      const imgs = Array.isArray(fieldsObj._answers?.images) ? fieldsObj._answers.images : [];
      const t = (r.title || fieldsObj.title || "").trim().toLowerCase();
      if (t === targetKey) imgs.forEach((nm) => combined.add(nm));
    }

    // Load current fields
    const selectSelf = `SELECT fields FROM submission WHERE submission_id = ?`;
    db.query(selectSelf, [id], (selErr, selRows) => {
      if (selErr) return res.status(500).send("DB error: " + selErr);
      if (!selRows.length) return res.status(404).send("Submission not found");
      let current = {};
      try {
        current = JSON.parse(selRows[0].fields || "{}");
      } catch {}
      const currImgs = Array.isArray(current.images) ? current.images : [];
      currImgs.forEach((nm) => combined.add(nm));

      const next = {
        ...(current || {}),
        type: "ACCOMPLISHMENT",
        images: Array.from(combined),
        meta: {
          ...(current?.meta || {}),
          consolidatedAt: new Date().toISOString(),
        },
      };
      const updSql = `UPDATE submission SET fields = ? WHERE submission_id = ?`;
      db.query(updSql, [JSON.stringify(next), id], (updErr) => {
        if (updErr) return res.status(500).send("Update failed: " + updErr);
        res.json({ ok: true, images: next.images, count: next.images.length });
      });
    });
  });
};
