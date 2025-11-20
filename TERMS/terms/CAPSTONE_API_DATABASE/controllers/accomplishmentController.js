import db from "../db.js";
import { createNotificationsBulk, createNotification } from './notificationsController.js';
import { sendEmail } from "../services/emailService.js";

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
    parent_report_assignment_id, // for parent-child linking
    coordinator_user_id, // for coordinator assignments
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

  // Allow empty recipients if coordinator_user_id is set (coordinator assignment without assignees)
  // The coordinator will distribute to teachers later
  if (!recipients.length && !coordinator_user_id) {
    return res
      .status(400)
      .send("Provide submitted_by, a non-empty assignees array, or coordinator_user_id.");
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

  // Helper: send emails to a list of user IDs (best-effort, non-blocking)
  const emailUsers = (userIds, subject, messageHtml, messageText) => {
    if (!Array.isArray(userIds) || userIds.length === 0) return;
    const placeholders = userIds.map(() => '?').join(',');
    const sql = `SELECT email FROM user_details WHERE user_id IN (${placeholders}) AND email IS NOT NULL AND email <> ''`;
    db.query(sql, userIds, async (_e, rows) => {
      if (!rows || !rows.length) return;
      for (const r of rows) {
        try {
          await sendEmail({ to: r.email, subject, html: messageHtml, text: messageText || undefined });
        } catch (err) {
          console.error('Email send failed:', err?.message || err);
        }
      }
    });
  };

  // Determine auto is_given rules for principal-given assignments
  const idsToCheck = [...new Set([...(recipients || []), given_by].filter(Boolean))];
  const placeholders = idsToCheck.map(() => '?').join(',');
  const rolesSql = `SELECT user_id, LOWER(role) AS role FROM user_details WHERE user_id IN (${placeholders})`;

  db.query(rolesSql, idsToCheck, (rolesErr, rolesRows = []) => {
    if (rolesErr) return res.status(500).send("Failed to read roles: " + rolesErr);

    const idToRole = new Map();
    for (const r of rolesRows) idToRole.set(Number(r.user_id), r.role);
    const giverRoleDetected = idToRole.get(Number(given_by)) || '';
    const hasTeacher = recipients.some(uid => (idToRole.get(Number(uid)) || '') === 'teacher');
    const hasCoordinator = recipients.some(uid => (idToRole.get(Number(uid)) || '') === 'coordinator');

    // CRITICAL: Never set coordinator_user_id when assigner is a coordinator
    // When coordinator assigns to Teacher(s) + Coordinator, recipient coordinator should act as teacher
    // This matches the behavior of Principal → Teacher(s) + Coordinator
    let finalCoordinatorUserId = coordinator_user_id;
    if (giverRoleDetected === 'coordinator') {
      // Coordinator is assigning - recipient coordinator should act as teacher (no coordinator_user_id)
      finalCoordinatorUserId = null;
    } else if (giverRoleDetected === 'principal' && hasTeacher && hasCoordinator) {
      // Principal → Teacher(s) + Coordinator: coordinator should act as teacher (no coordinator_user_id)
      finalCoordinatorUserId = null;
    } else if (giverRoleDetected === 'principal' && hasCoordinator && !hasTeacher) {
      // Principal → Coordinator (only): coordinator acts as coordinator (keep coordinator_user_id if provided)
      // finalCoordinatorUserId already set from request body
    }

    // Default respects inbound flag; override only for principal
    let computedIsGiven = _is_given;
    if (giverRoleDetected === 'principal') {
      if (hasTeacher) computedIsGiven = 1;            // principal -> teacher(s) (with/without coordinator)
      else if (hasCoordinator && !hasTeacher) computedIsGiven = 0; // principal -> coordinator only
    }
    db.getConnection((connErr, conn) => {
      if (connErr) return res.status(500).send("DB connect error: " + connErr.message);

      conn.beginTransaction((txErr) => {
        if (txErr) { conn.release(); return res.status(500).send("Failed to start transaction: " + txErr.message); }

        const insertReportSql = `
          INSERT INTO report_assignment
            (category_id, sub_category_id, given_by, quarter, year, from_date, to_date, instruction, is_given, is_archived, allow_late, title, parent_report_assignment_id, coordinator_user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          computedIsGiven,
          _is_archived,
          _allow_late,
          title,
          parent_report_assignment_id ?? null,
          finalCoordinatorUserId ?? null, // Use finalCoordinatorUserId instead of coordinator_user_id
        ];
        conn.query(insertReportSql, reportVals, (insErr, insRes) => {
          if (insErr) {
            return conn.rollback(() => { conn.release(); res.status(500).send("Failed to insert report: " + insErr); });
          }

          const report_assignment_id = insRes.insertId;

          // If no recipients but coordinator_user_id is set, skip creating submissions
          // The coordinator will distribute to teachers later
          if (recipients.length === 0 && coordinator_user_id) {
            // Skip submission creation, just commit the assignment
            conn.commit((commitErr) => {
              if (commitErr) {
                return conn.rollback(() => { conn.release(); res.status(500).send("Failed to commit: " + commitErr); });
              }
              conn.release();
              res.json({
                report_assignment_id,
                message: "Accomplishment Report assignment created for coordinator (no submissions created yet)",
              });
            });
            return;
          }

          computeNextNums(recipients, report_assignment_id, (nErr, nextNums) => {
            if (nErr) {
              return conn.rollback(() => { conn.release(); res.status(500).send("Failed to compute next submission numbers: " + nErr); });
            }

            const createdSubmissionIds = [];
            const insertOne = (userId, cb) => {
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
                nextNums[userId],
                title,
                initialFields,
              ];
              conn.query(insertSubmissionSql, subVals, (subErr, subRes) => {
                if (subErr) return cb(subErr);
                if (subRes?.insertId) createdSubmissionIds.push(subRes.insertId);
                cb();
              });
            };

            // Insert submissions sequentially
            const runSeq = (i = 0) => {
              if (i >= recipients.length) return afterSubmissions();
              insertOne(recipients[i], (e) => {
                if (e) return conn.rollback(() => { conn.release(); res.status(500).send("Failed to create submissions: " + e); });
                runSeq(i + 1);
              });
            };

            const afterSubmissions = () => {
              // Always record distribution rows for recipients
              if (recipients.length > 0) {
                const values = recipients.map(() => '(?, ?)').join(',');
                const params = [];
                recipients.forEach(uid => { params.push(report_assignment_id, uid); });
                const distSql = `INSERT IGNORE INTO assignment_distribution (report_assignment_id, user_id) VALUES ${values}`;
                conn.query(distSql, params, (dErr) => {
                  if (dErr) return conn.rollback(() => { conn.release(); res.status(500).send("Failed to write assignment distribution: " + dErr); });
                  // If the giver is a principal and assigning to 2+ recipients,
                  // ensure the principal also gets their own submission so they can act on it.
                  const roleSql = `SELECT LOWER(role) AS role FROM user_details WHERE user_id = ? LIMIT 1`;
                  conn.query(roleSql, [given_by], (rErr, rRows) => {
                    if (rErr) return conn.rollback(() => { conn.release(); res.status(500).send("Failed to read giver role: " + rErr); });
                    const giverRole = (rRows && rRows[0] && rRows[0].role) ? rRows[0].role : '';
                    if (giverRole === 'principal' && recipients.length >= 2) {
                      // Compatible with ONLY_FULL_GROUP_BY: do not select non-aggregated columns
                      const checkPrincipalSql = `SELECT COUNT(*) AS cnt, COALESCE(MAX(number_of_submission),0)+1 AS next_num
                                                FROM submission
                                                WHERE report_assignment_id = ? AND submitted_by = ?`;
                      conn.query(checkPrincipalSql, [report_assignment_id, given_by], (cErr, cRows) => {
                        if (cErr) return conn.rollback(() => { conn.release(); res.status(500).send("Failed to check principal submission: " + cErr); });
                        const alreadyExists = Array.isArray(cRows) && cRows.length && Number(cRows[0].cnt) > 0;
                        const nextNum = (Array.isArray(cRows) && cRows[0] && cRows[0].next_num) ? cRows[0].next_num : 1;
                        if (alreadyExists) return finalize();
                        const insertPrincipalSql = `
                          INSERT INTO submission
                            (report_assignment_id, category_id, submitted_by, status, number_of_submission, value, date_submitted, fields)
                          VALUES
                            (?, ?, ?, 1, ?, ?, NOW(), ?)
                        `;
                        const pVals = [
                          report_assignment_id,
                          category_id,
                          given_by,
                          nextNum,
                          title,
                          initialFields,
                        ];
                        conn.query(insertPrincipalSql, pVals, (pErr, pRes) => {
                          if (pErr) return conn.rollback(() => { conn.release(); res.status(500).send("Failed to create principal submission: " + pErr); });
                          if (pRes?.insertId) createdSubmissionIds.push(pRes.insertId);
                          finalize();
                        });
                      });
                    } else {
                      finalize();
                    }
                  });
                });
              } else {
                finalize();
              }
            };

            const finalize = () => {
              // Notifications + emails (best-effort outside of transaction)
              conn.commit((cErr) => {
                if (cErr) return conn.rollback(() => { conn.release(); res.status(500).send("Commit failed: " + cErr); });
                conn.release();

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
                    const subject = `New report assigned: ${title}`;
                    const html = `<p>Assigned by ${giverName} — due on ${to_date}.</p>`;
                    const text = `Assigned by ${giverName} — due on ${to_date}.`;
                    emailUsers(recipients, subject, html, text);
                  });
                });

                return res.status(201).json({ report_assignment_id, submissions_created: recipients.length, submission_ids: createdSubmissionIds });
              });
            };

            runSeq(0);
          });
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
           s.fields, ud.name AS submitted_by_name,
           st.value AS status_text
    FROM submission s
    LEFT JOIN user_details ud ON s.submitted_by = ud.user_id
    LEFT JOIN status st ON s.status = st.status_id
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
      // If newly submitted (status 2), notify principal appropriately
      if (newStatus === 2) {
        const metaSql = `
          SELECT 
            ra.report_assignment_id,
            ra.given_by,
            ra.title,
            (
              SELECT COUNT(*) 
              FROM assignment_distribution ad 
              JOIN user_details udt ON udt.user_id = ad.user_id
              WHERE ad.report_assignment_id = ra.report_assignment_id
                AND LOWER(udt.role) = 'teacher'
            ) AS teacher_recipients
          FROM submission s
          JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
          WHERE s.submission_id = ?
        `;
        db.query(metaSql, [id], (mErr, mRows) => {
          if (!mErr && mRows?.length) {
            const meta = mRows[0];
            const hasTeacherRecipients = Number(meta.teacher_recipients || 0) >= 1;
            const payload = hasTeacherRecipients
              ? {
                  title: `Report submitted: ${meta.title}`,
                  message: `A report was submitted and is ready to view.`,
                  type: 'report_submitted',
                  ref_type: 'submission',
                  ref_id: Number(id),
                }
              : {
                  title: `For approval: ${meta.title}`,
                  message: `A coordinator/teacher submitted a report for your approval.`,
                  type: 'for_approval',
                  ref_type: 'submission',
                  ref_id: Number(id),
                };

            createNotification(meta.given_by, payload, (err) => {
              if (err) console.error('Failed to create principal notification:', err);
            });
            // Email principal (best-effort)
            const subj = hasTeacherRecipients ? `Report submitted: ${meta.title}` : `For approval: ${meta.title}`;
            const msg = hasTeacherRecipients ? 'A report was submitted and is ready to view.' : 'A coordinator/teacher submitted a report for your approval.';
            const userSql = `SELECT email FROM user_details WHERE user_id = ? LIMIT 1`;
            db.query(userSql, [meta.given_by], async (_ue, uRows) => {
              const to = uRows?.[0]?.email;
              if (to) {
                try { await sendEmail({ to, subject: subj, html: `<p>${msg}</p>`, text: msg }); } catch(e) { console.error('Email send failed:', e?.message || e); }
              }
            });
          }
        });
      }

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
            createNotification(meta.submitted_by, {
              title,
              message,
              type: newStatus === 3 ? 'submission_approved' : 'submission_rejected',
              ref_type: 'submission',
              ref_id: Number(id),
            }, (err, result) => {
              if (err) console.error('Failed to create notification:', err);
            });
            // Email submitter (best-effort)
            const userSql = `SELECT email FROM user_details WHERE user_id = ? LIMIT 1`;
            db.query(userSql, [meta.submitted_by], async (_ue, uRows) => {
              const to = uRows?.[0]?.email;
              if (to) {
                try { await sendEmail({ to, subject: title, html: `<p>${message}</p>`, text: message }); } catch(e) { console.error('Email send failed:', e?.message || e); }
              }
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
  const pra = req.query.pra; // optional parent_report_assignment_id for strict separation
  const includeConsolidated = req.query.includeConsolidated === 'true'; // Include consolidated items if requested

  console.log("getAccomplishmentPeers:", { id, ra, pra, includeConsolidated });

  const fetchSqlFromSubmission = `
    SELECT s2.submission_id, s2.report_assignment_id, s2.value AS title, s2.status, s2.fields, ud.name AS teacher_name
    FROM submission s
    JOIN submission s2 ON s2.report_assignment_id = s.report_assignment_id
    JOIN user_details ud ON s2.submitted_by = ud.user_id
    WHERE s.submission_id = ? AND s2.status >= 2
  `;

  // Build role filter: 
  // - Principal can see coordinator+teacher
  // - Coordinators can see teacher + other coordinators (but exclude accomplishment coordinators)
  // - Teachers can only see teachers
  const requesterRole = (req.user?.role || '').toLowerCase();
  let roleClause;
  if (requesterRole === 'principal') {
    roleClause = "LOWER(ud.role) IN ('teacher','coordinator')";
  } else if (requesterRole === 'coordinator') {
    // Coordinators can see teachers and other coordinators
    // But exclude accomplishment coordinators (those with coordinator_user_id for category_id = 0)
    roleClause = `(
      LOWER(ud.role) = 'teacher' 
      OR (
        LOWER(ud.role) = 'coordinator' 
        AND NOT EXISTS (
          SELECT 1 FROM report_assignment ra_check 
          WHERE ra_check.coordinator_user_id = ud.user_id 
          AND ra_check.category_id = 0
        )
      )
    )`;
  } else {
    roleClause = "LOWER(ud.role) = 'teacher'";
  }

  // NOTE: exclude current submission when ra= is provided
  // Look for submitted peers from the specific report_assignment_id
  // If includeConsolidated is true, don't filter out consolidated items
  const consolidatedFilter = includeConsolidated 
    ? '' 
    : `AND (JSON_EXTRACT(s.fields, '$.meta.consolidatedInto') IS NULL OR JSON_EXTRACT(s.fields, '$.meta.consolidatedInto') = 'null')`;
  
  const fetchSqlFromRA = `
    SELECT s.submission_id, s.report_assignment_id, s.value AS title, s.status, s.fields, ud.name AS teacher_name
    FROM submission s
    JOIN user_details ud ON s.submitted_by = ud.user_id
    JOIN report_assignment ra ON s.report_assignment_id = ra.report_assignment_id
    WHERE s.submission_id <> ?
      AND s.status >= 2
      AND ${roleClause}
      AND s.report_assignment_id = ?
      ${consolidatedFilter}
  `;

  // Parent-child query: get teacher submissions from child assignments of the parent
  const fetchSqlFromParent = `
    SELECT s.submission_id, s.report_assignment_id, s.value AS title, s.status, s.fields, ud.name AS teacher_name
    FROM submission s
    JOIN user_details ud ON s.submitted_by = ud.user_id
    JOIN report_assignment ra_child ON s.report_assignment_id = ra_child.report_assignment_id
    WHERE s.submission_id <> ?
      AND s.status >= 2
      AND ${roleClause}
      AND ra_child.parent_report_assignment_id = ?
      ${consolidatedFilter}
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
        db.query(sql, [id, ra], (err, rows) => {
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
            const answers = fieldsObj?._answers || {};
            const narrativeText = String(
              fieldsObj.narrative ||
              fieldsObj.text ||
              answers.narrative ||
              answers.text ||
              innerForm.narrative ||
              innerForm.text ||
              innerFields.narrative ||
              innerFields.text ||
              ""
            ).trim();
            g.submissions.push({ 
              submission_id: r.submission_id, 
              images: imgs, 
              narrative: narrativeText, 
              fields: fieldsObj,
              teacher_name: r.teacher_name || null
            });
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
          const answers = fieldsObj?._answers || {};
          const narrativeText = String(
            fieldsObj.narrative ||
            fieldsObj.text ||
            answers.narrative ||
            answers.text ||
            innerForm.narrative ||
            innerForm.text ||
            innerFields.narrative ||
            innerFields.text ||
            ""
          ).trim();
          g.submissions.push({ 
            submission_id: r.submission_id, 
            images: imgs, 
            narrative: narrativeText, 
            fields: fieldsObj,
            teacher_name: r.teacher_name || null
          });
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

  if (pra) return run(fetchSqlFromParent, [id, pra]);
  if (ra) return run(fetchSqlFromRA, [id, ra]);
  return run(fetchSqlFromSubmission, [id]);
};

/**
 * POST /reports/accomplishment/:id/consolidate
 * Body: { title: string }
 * Merges images from all submitted peer submissions sharing the same normalized title into the current submission's images array.
 */
export const consolidateAccomplishmentByTitle = (req, res) => {
  const { id } = req.params;
  const { title, parent_assignment_id, report_assignment_id, submission_ids } = req.body || {};
  if (!title) return res.status(400).json({ error: "title is required" });
  
  // If submission_ids is provided, only consolidate those specific submissions
  // Otherwise, consolidate all submissions with the same title (backward compatibility)
  const filterBySubmissionIds = Array.isArray(submission_ids) && submission_ids.length > 0;

  const requesterRole = (req.user?.role || '').toLowerCase();
  let roleClause;
  if (requesterRole === 'principal') {
    roleClause = "LOWER(ud.role) IN ('teacher','coordinator')";
  } else if (requesterRole === 'coordinator') {
    // Coordinators can see teachers and other coordinators
    // But exclude accomplishment coordinators (those with coordinator_user_id for category_id = 0)
    roleClause = `(
      LOWER(ud.role) = 'teacher' 
      OR (
        LOWER(ud.role) = 'coordinator' 
        AND NOT EXISTS (
          SELECT 1 FROM report_assignment ra_check 
          WHERE ra_check.coordinator_user_id = ud.user_id 
          AND ra_check.category_id = 0
        )
      )
    )`;
  } else {
    roleClause = "LOWER(ud.role) = 'teacher'";
  }

  // Prefer exact same assignment when provided (principal single-assignment flow)
  // Fallback to parent-child filtering when parent_assignment_id is provided
  const peersSql = report_assignment_id ? `
    SELECT s.submission_id, s.report_assignment_id, s.value AS title, s.status, s.fields, ud.name AS teacher_name
    FROM submission s
    JOIN user_details ud ON s.submitted_by = ud.user_id
    JOIN report_assignment ra ON s.report_assignment_id = ra.report_assignment_id
    WHERE s.submission_id <> ?
      AND s.status >= 2
      AND ${roleClause}
      AND s.report_assignment_id = ?
  ` : parent_assignment_id ? `
    SELECT s.submission_id, s.report_assignment_id, s.value AS title, s.status, s.fields, ud.name AS teacher_name
    FROM submission s
    JOIN user_details ud ON s.submitted_by = ud.user_id
    JOIN report_assignment ra_child ON s.report_assignment_id = ra_child.report_assignment_id
    WHERE s.submission_id <> ?
      AND s.status >= 2
      AND ${roleClause}
      AND ra_child.parent_report_assignment_id = ?
  ` : `
    SELECT s.submission_id, s.report_assignment_id, s.value AS title, s.status, s.fields, ud.name AS teacher_name
    FROM submission s
    JOIN user_details ud ON s.submitted_by = ud.user_id
    JOIN report_assignment ra ON s.report_assignment_id = ra.report_assignment_id
    WHERE s.submission_id <> ?
      AND s.status >= 2
      AND ${roleClause}
  `;
  const queryParams = report_assignment_id
    ? [id, report_assignment_id]
    : parent_assignment_id
    ? [id, parent_assignment_id]
    : [id];
  db.query(peersSql, queryParams, (err, rows) => {
    if (err) return res.status(500).send("DB error: " + err);
    const targetKey = String(title).replace(/\s+/g, ' ').trim().toLowerCase();
    const combinedMap = new Map();
    const addImage = (img) => {
      if (img == null) return;
      const key = typeof img === 'string' ? img : (img.filename || img.url || JSON.stringify(img));
      if (!combinedMap.has(key)) combinedMap.set(key, img);
    };
    for (const r of rows || []) {
      let fieldsObj = {};
      try {
        fieldsObj = typeof r.fields === "string" ? JSON.parse(r.fields) : r.fields || {};
      } catch {}

      // Prefer images in _answers.images, but also support legacy fields.images/photos
      const imgsArr = Array.isArray(fieldsObj?._answers?.images)
        ? fieldsObj._answers.images
        : Array.isArray(fieldsObj?.images)
        ? fieldsObj.images
        : Array.isArray(fieldsObj?.photos)
        ? fieldsObj.photos
        : [];

      const t = (r.title || fieldsObj.title || fieldsObj?._answers?.title || "")
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      
      // Check if this submission should be included:
      // 1. If submission_ids is provided, only include if it's in the list
      // 2. Otherwise, include if title matches (backward compatibility)
      const shouldInclude = filterBySubmissionIds 
        ? submission_ids.includes(r.submission_id)
        : t === targetKey;
      
      console.log('[Consolidate] Row:', {
        submission_id: r.submission_id,
        report_assignment_id: r.report_assignment_id,
        rowTitle: r.title,
        parsedTitle: fieldsObj.title,
        normalizedTitle: t,
        matchesTarget: t === targetKey,
        inSubmissionIds: filterBySubmissionIds ? submission_ids.includes(r.submission_id) : 'N/A',
        shouldInclude,
        imgsCandidates: imgsArr,
      });
      
      if (shouldInclude) {
        imgsArr.forEach((nm) => addImage(nm));
        // Mark this peer submission as consolidated into the current submission
        const peerFields = fieldsObj || {};
        const peerMeta = peerFields.meta || {};
        const updatedPeerFields = {
          ...peerFields,
          meta: {
            ...peerMeta,
            consolidatedInto: id, // Mark which submission this was consolidated into
            consolidatedAt: new Date().toISOString()
          }
        };
        // Update the peer submission to mark it as consolidated
        const updatePeerSql = `UPDATE submission SET fields = ? WHERE submission_id = ?`;
        db.query(updatePeerSql, [JSON.stringify(updatedPeerFields), r.submission_id], (peerUpdErr) => {
          if (peerUpdErr) {
            console.error(`[Consolidate] Failed to mark peer submission ${r.submission_id} as consolidated:`, peerUpdErr);
          } else {
            console.log(`[Consolidate] Marked peer submission ${r.submission_id} as consolidated into ${id}`);
          }
        });
      }
    }

  // Fallback: if no images matched by exact title (due to formatting/whitespace differences),
  // include all discovered images from the rows. This mirrors the coordinator experience where
  // a single peer row is typically the intended target.
  // Only apply fallback if not filtering by submission_ids
  if (!filterBySubmissionIds && combinedMap.size === 0 && Array.isArray(rows) && rows.length > 0) {
    for (const r of rows) {
      let fieldsObj = {};
      try {
        fieldsObj = typeof r.fields === "string" ? JSON.parse(r.fields) : r.fields || {};
      } catch {}
      const imgsArr = Array.isArray(fieldsObj?._answers?.images)
        ? fieldsObj._answers.images
        : Array.isArray(fieldsObj?.images)
        ? fieldsObj.images
        : Array.isArray(fieldsObj?.photos)
        ? fieldsObj.photos
        : [];
      imgsArr.forEach((nm) => addImage(nm));
      // Mark this peer submission as consolidated into the current submission
      const peerFields = fieldsObj || {};
      const peerMeta = peerFields.meta || {};
      const updatedPeerFields = {
        ...peerFields,
        meta: {
          ...peerMeta,
          consolidatedInto: id, // Mark which submission this was consolidated into
          consolidatedAt: new Date().toISOString()
        }
      };
      // Update the peer submission to mark it as consolidated
      const updatePeerSql = `UPDATE submission SET fields = ? WHERE submission_id = ?`;
      db.query(updatePeerSql, [JSON.stringify(updatedPeerFields), r.submission_id], (peerUpdErr) => {
        if (peerUpdErr) {
          console.error(`[Consolidate] Failed to mark peer submission ${r.submission_id} as consolidated:`, peerUpdErr);
        } else {
          console.log(`[Consolidate] Marked peer submission ${r.submission_id} as consolidated into ${id}`);
        }
      });
    }
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
      console.log('[Consolidate] Current submission images before merge:', currImgs);
      
      // If filtering by submission_ids (re-consolidation), we need to:
      // 1. Get images from all previously consolidated submissions
      // 2. Remove images that came from unselected submissions
      // 3. Keep only images from selected submissions + original images
      if (filterBySubmissionIds) {
        // Get all images from previously consolidated submissions that are NOT in the selected list
        // First, get all submissions that were previously consolidated into this one
        const previouslyConsolidatedIds = rows
          .filter(r => {
            let f = {};
            try {
              f = typeof r.fields === "string" ? JSON.parse(r.fields) : r.fields || {};
            } catch {}
            const consolidatedInto = f?.meta?.consolidatedInto;
            return consolidatedInto === id;
          })
          .map(r => r.submission_id);
        
        // Find which of those are NOT selected
        const unselectedSubmissionIds = previouslyConsolidatedIds.filter(subId => !submission_ids.includes(subId));
        
        console.log('[Consolidate] Previously consolidated IDs:', previouslyConsolidatedIds);
        console.log('[Consolidate] Selected IDs:', submission_ids);
        console.log('[Consolidate] Unselected IDs to remove:', unselectedSubmissionIds);
        
        // Get images from unselected previously consolidated submissions
        const imagesToRemove = new Set();
        rows.forEach(r => {
          if (unselectedSubmissionIds.includes(r.submission_id)) {
            let f = {};
            try {
              f = typeof r.fields === "string" ? JSON.parse(r.fields) : r.fields || {};
            } catch {}
            const imgsArr = Array.isArray(f?._answers?.images)
              ? f._answers.images
              : Array.isArray(f?.images)
              ? f.images
              : Array.isArray(f?.photos)
              ? f.photos
              : [];
            imgsArr.forEach(img => {
              const key = typeof img === 'string' ? img : (img.filename || img.url || JSON.stringify(img));
              imagesToRemove.add(key);
            });
          }
        });
        
        console.log('[Consolidate] Images to remove (from unselected):', Array.from(imagesToRemove));
        
        // Only add current images that are NOT from unselected consolidated submissions
        currImgs.forEach((img) => {
          const key = typeof img === 'string' ? img : (img.filename || img.url || JSON.stringify(img));
          if (!imagesToRemove.has(key)) {
            addImage(img);
          } else {
            console.log('[Consolidate] Skipping image (from unselected submission):', key);
          }
        });
        console.log('[Consolidate] Removed images from unselected submissions:', imagesToRemove.size);
      } else {
        // Original behavior: add all current images
        currImgs.forEach((nm) => addImage(nm));
      }

      const next = {
        ...(current || {}),
        type: "ACCOMPLISHMENT",
        images: Array.from(combinedMap.values()),
        meta: {
          ...(current?.meta || {}),
          consolidatedAt: new Date().toISOString(),
          consolidatedImagesCount: Array.from(combinedMap.values()).length, // Track how many images were consolidated
        },
      };
      const updSql = `UPDATE submission SET fields = ? WHERE submission_id = ?`;
      console.log('[Consolidate] Final combined images list:', Array.from(combinedMap.values()));
      db.query(updSql, [JSON.stringify(next), id], (updErr) => {
        if (updErr) return res.status(500).send("Update failed: " + updErr);
        res.json({ ok: true, images: next.images, count: next.images.length });
      });
    });
  });
};

/**
 * POST /reports/accomplishment/link-parent
 * Links a teacher assignment to a coordinator's parent assignment
 */
export const linkParentAssignment = (req, res) => {
  const { teacher_assignment_id, coordinator_assignment_id } = req.body || {};
  
  if (!teacher_assignment_id || !coordinator_assignment_id) {
    return res.status(400).json({ error: "teacher_assignment_id and coordinator_assignment_id are required" });
  }

  const updateSql = `
    UPDATE report_assignment 
    SET parent_report_assignment_id = ? 
    WHERE report_assignment_id = ?
  `;

  db.query(updateSql, [coordinator_assignment_id, teacher_assignment_id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Failed to link parent assignment: " + err.message });
    }
    
    res.json({ 
      success: true, 
      message: "Parent assignment linked successfully",
      affectedRows: result.affectedRows 
    });
  });
};
