// controllers/reportAssignmentCon.js
import db from '../db.js';
import { sendEmail } from '../services/emailService.js';

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

function emailUsers(userIds, subject, messageHtml, messageText) {
  if (!Array.isArray(userIds) || !userIds.length) return;
  const placeholders = userIds.map(() => '?').join(',');
  const sql = `SELECT email FROM user_details WHERE user_id IN (${placeholders}) AND email IS NOT NULL AND email <> ''`;
  db.query(sql, userIds, async (_e, rows) => {
    if (!rows || !rows.length) return;
    for (const r of rows) {
      try {
        await sendEmail({
          to: r.email,
          subject,
          html: messageHtml,
          text: messageText || undefined
        });
      } catch (err) {
        console.error('Email send failed:', err?.message || err);
      }
    }
  });
}

function sendAssignmentEmails({ recipientIds, givenBy, title, dueDate }) {
  const normalized = Array.isArray(recipientIds)
    ? Array.from(new Set(
        recipientIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id))
      ))
    : [];
  if (!normalized.length) return;

  const nameSql = `SELECT name FROM user_details WHERE user_id = ? LIMIT 1`;
  db.query(nameSql, [givenBy], (_err, rows) => {
    const giverName = rows?.[0]?.name || 'Coordinator';
    const subject = `New report assigned: ${title}`;
    const message = `Assigned by ${giverName} — due on ${dueDate || 'TBD'}.`;
    emailUsers(normalized, subject, `<p>${message}</p>`, message);
  });
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
    number_of_submissions,
    
    // parent linking
    parent_report_assignment_id = null
  } = req.body || {};

  // Validation
  if (category_id == null || quarter == null || year == null || !to_date) {
    return res.status(400).send('category_id, quarter, year, and to_date are required.');
  }
  if (!title || typeof title !== 'string') {
    return res.status(400).send('title is required (string).');
  }

  const recipientsRaw =
    Array.isArray(assignees) && assignees.length
      ? assignees
      : (submitted_by != null ? [submitted_by] : []);

  const recipients = recipientsRaw
    .map((id) => {
      if (id == null) return null;
      const num = Number(id);
      return Number.isFinite(num) ? num : null;
    })
    .filter((id) => id != null);

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
          (category_id, sub_category_id, given_by, quarter, year, from_date, to_date, instruction, is_given, is_archived, allow_late, title, parent_report_assignment_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        title,
        parent_report_assignment_id ?? null
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
    coordinator_user_id = null,
    subject_ids = [], // Array of subject IDs
    number_of_submission,
    number_of_submissions,
    parent_report_assignment_id = null // Parent assignment ID for linking child assignments
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

      // Determine coordinator recipient (if any) once per request
      // BUT: Skip this if parent_report_assignment_id is provided (coordinator assigning to teachers)
      // to avoid setting coordinator_user_id on child assignments
      // ALSO: Never set coordinator_user_id when assigner is a coordinator (coordinator assigning to coordinator/teachers)
      let coordinatorRecipientId = null;
      const computeCoordinatorRecipient = async () => {
        if (!recipients.length) return;
        
        // Get the assigner's role to check if they are a coordinator
        const assignerRoleSql = `SELECT LOWER(role) AS role FROM user_details WHERE user_id = ?`;
        const assignerRoleResult = await new Promise((resolve, reject) => {
          conn.query(assignerRoleSql, [authenticatedUserId], (err, results) => {
            if (err) reject(err);
            else resolve(results?.[0] || null);
          });
        }).catch(() => null);
        const assignerRole = assignerRoleResult?.role || '';
        const isAssignerCoordinator = assignerRole === 'coordinator';
        
        // If assigner is a coordinator, NEVER set coordinator_user_id (recipients should act as teachers)
        if (isAssignerCoordinator) {
          coordinatorRecipientId = null;
          return;
        }
        
        // If parent_report_assignment_id is provided, this is a child assignment from a coordinator
        // Don't automatically set coordinator_user_id - only use it if explicitly provided
        if (parent_report_assignment_id != null) {
          // Only set if explicitly provided in request
          if (coordinator_user_id != null && Number.isFinite(Number(coordinator_user_id))) {
            coordinatorRecipientId = Number(coordinator_user_id);
          }
          // Otherwise, leave it as null to avoid conflicts
          return;
        }
        
        // For principal assignments, compute coordinator recipient as before
        if (coordinator_user_id != null && Number.isFinite(Number(coordinator_user_id))) {
          coordinatorRecipientId = Number(coordinator_user_id);
          return;
        }
        const placeholders = recipients.map(() => '?').join(', ');
        const sql = `
          SELECT user_id
          FROM user_details
          WHERE user_id IN (${placeholders})
            AND LOWER(role) = 'coordinator'
          LIMIT 1
        `;
        const row = await new Promise((resolve, reject) => {
          conn.query(sql, recipients, (err, results) => {
            if (err) reject(err);
            else resolve(results?.[0] || null);
          });
        }).catch(() => null);
        if (row?.user_id != null) {
          coordinatorRecipientId = Number(row.user_id);
        } else {
          coordinatorRecipientId = Number(recipients[0]);
        }
      };

      // Create assignments for each subject
      const createAssignments = async () => {
        const results = [];
        await computeCoordinatorRecipient();
        const normalizedCoordinatorId =
          coordinatorRecipientId != null && Number.isFinite(coordinatorRecipientId)
            ? coordinatorRecipientId
            : null;
        
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
          
          // Check if title already contains the subject name (to avoid duplication when editing)
          // If title already ends with " - SubjectName", use it as-is, otherwise append the subject
          const titleEndsWithSubject = title.trim().endsWith(` - ${subjectName}`) || 
                                       title.trim().endsWith(`- ${subjectName}`) ||
                                       title.trim() === subjectName;
          
          const assignmentTitle = titleEndsWithSubject ? title : `${title} - ${subjectName}`;

          // Insert assignment for this subject
          const insertReportSql = `
            INSERT INTO report_assignment
              (category_id, sub_category_id, grade_level_id, coordinator_user_id, given_by, quarter, year, from_date, to_date, instruction, is_given, is_archived, allow_late, title, parent_report_assignment_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          const finalGradeLevelId = grade_level_id ?? null;
          let finalCoordinatorUserId = coordinator_user_id ?? null;

          // Only use normalizedCoordinatorId fallback if:
          // 1. coordinator_user_id is not explicitly provided, AND
          // 2. parent_report_assignment_id is NOT provided (not a child assignment from coordinator)
          // 3. normalizedCoordinatorId is not null (computed from recipients)
          // This prevents setting coordinator_user_id on child assignments when coordinator assigns to teachers
          // AND prevents setting it when assigner is a coordinator (already handled in computeCoordinatorRecipient)
          if ((finalCoordinatorUserId === null || Number.isNaN(Number(finalCoordinatorUserId))) 
              && parent_report_assignment_id == null
              && normalizedCoordinatorId != null) {
            finalCoordinatorUserId = normalizedCoordinatorId;
          }

          if (finalCoordinatorUserId != null) {
            finalCoordinatorUserId = Number(finalCoordinatorUserId);
            if (!Number.isFinite(finalCoordinatorUserId)) {
              finalCoordinatorUserId = null;
            }
          }

          let report_assignment_id;
          try {
            const assignmentResult = await new Promise((resolve, reject) => {
              conn.query(insertReportSql, [
                category_id,
                sub_category_id ?? null,
                finalGradeLevelId,
                finalCoordinatorUserId,
                given_by,
                quarter,
                year,
                fromDateValue,
                to_date,
                instruction,
                _is_given,
                _is_archived,
                _allow_late,
                assignmentTitle,
                parent_report_assignment_id // Link to parent assignment if provided
              ], (err, result) => {
                if (err) reject(err);
                else resolve(result);
              });
            });
            report_assignment_id = assignmentResult.insertId;
          } catch (err) {
            if (err.code === 'ER_DUP_ENTRY' && finalGradeLevelId != null) {
              console.warn('[giveLAEMPLMPSReport] Duplicate coordinator assignment detected, reusing existing record.', {
                grade_level_id: finalGradeLevelId,
                quarter,
                year,
                coordinator_user_id: finalCoordinatorUserId
              });

              const existingSql = `
                SELECT report_assignment_id, grade_level_id, coordinator_user_id
                FROM report_assignment
                WHERE category_id = ?
                  AND (sub_category_id = ? OR (sub_category_id IS NULL AND ? IS NULL))
                  AND grade_level_id = ?
                  AND quarter = ?
                  AND year = ?
                ORDER BY report_assignment_id DESC
                LIMIT 1
              `;

              const existingRows = await new Promise((resolve, reject) => {
                conn.query(
                  existingSql,
                  [
                    category_id,
                    sub_category_id ?? null,
                    sub_category_id ?? null,
                    finalGradeLevelId,
                    quarter,
                    year
                  ],
                  (selectErr, rows) => {
                    if (selectErr) reject(selectErr);
                    else resolve(rows);
                  }
                );
              });

              if (!existingRows || existingRows.length === 0) {
                throw err;
              }

              const existing = existingRows[0];
              report_assignment_id = existing.report_assignment_id;

              // Ensure coordinator_user_id and grade_level_id are up to date
              // BUT: Don't update coordinator_user_id if parent_report_assignment_id is provided
              // (coordinator assigning to teachers - child assignments shouldn't have coordinator_user_id)
              const shouldUpdateCoordinatorId = parent_report_assignment_id == null && 
                                                finalCoordinatorUserId != null && 
                                                existing.coordinator_user_id !== finalCoordinatorUserId;
              const shouldUpdateGradeLevel = existing.grade_level_id == null && finalGradeLevelId != null;
              
              if (shouldUpdateGradeLevel || shouldUpdateCoordinatorId) {
                await new Promise((resolve, reject) => {
                  conn.query(
                    `
                      UPDATE report_assignment
                      SET grade_level_id = ?, coordinator_user_id = ?
                      WHERE report_assignment_id = ?
                    `,
                    [finalGradeLevelId, finalCoordinatorUserId, report_assignment_id],
                    (updateErr) => {
                      if (updateErr) reject(updateErr);
                      else resolve();
                    }
                  );
                });
              }
            } else {
              throw err;
            }
          }

          // Create submissions for each recipient for this subject
          for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            const nos = hasPerRecipientNos ? number_of_submissions[i] : (number_of_submission || 1);

            // Check if submission already exists to prevent duplicates
            const checkSubmissionQuery = `
              SELECT submission_id FROM submission 
              WHERE report_assignment_id = ? AND submitted_by = ?
              LIMIT 1
            `;
            const existingSubmission = await new Promise((resolve, reject) => {
              conn.query(checkSubmissionQuery, [report_assignment_id, recipient], (err, results) => {
                if (err) reject(err);
                else resolve(results && results.length > 0 ? results[0] : null);
              });
            });

            // Skip if submission already exists
            if (existingSubmission) {
              console.log('[giveLAEMPLMPSReport] Submission already exists for recipient:', recipient, 'assignment:', report_assignment_id, '- skipping');
              continue;
            }

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
            sendAssignmentEmails({
              recipientIds: recipients,
              givenBy: given_by,
              title,
              dueDate: to_date
            });
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
    number_of_submissions,
    
    // parent linking
    parent_report_assignment_id = null
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

  // LAEMPL seed - Updated to new column structure
  const TRAITS = ["Masipag","Matulungin","Masunurin","Magalang","Matapat","Matiyaga"];
  const COLS   = [
    { key: "m" },
    { key: "f" },
    { key: "no_of_cases" },
    { key: "no_of_items" },
    { key: "total_score" },
    { key: "highest_score" },
    { key: "lowest_score" },
    { key: "male_passed" },
    { key: "male_mpl_percent" },
    { key: "female_passed" },
    { key: "female_mpl_percent" },
    { key: "total_passed" },
    { key: "total_mpl_percent" }
  ];
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
          (category_id, sub_category_id, given_by, quarter, year, from_date, to_date, instruction, is_given, is_archived, allow_late, title, parent_report_assignment_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        title,
        parent_report_assignment_id ?? null
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
                  sendAssignmentEmails({
                    recipientIds: recipients,
                    givenBy: given_by,
                    title,
                    dueDate: to_date
                  });
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

// GET /reports/laempl-mps/assignments
export const getLAEMPLMPSAssignments = (req, res) => {
  const sql = `
    SELECT
      ra.report_assignment_id,
      ra.title,
      ra.quarter,
      ra.year,
      ra.grade_level_id,
      gl.grade_level,
      ra.coordinator_user_id,
      coord.name AS coordinator_name,
      ra.advisory_user_id,
      adv.name AS advisory_name,
      ra.from_date,
      ra.to_date
    FROM report_assignment ra
    LEFT JOIN grade_level gl ON ra.grade_level_id = gl.grade_level_id
    LEFT JOIN user_details coord ON ra.coordinator_user_id = coord.user_id
    LEFT JOIN user_details adv ON ra.advisory_user_id = adv.user_id
    WHERE ra.category_id = 1 AND ra.sub_category_id = 3
    ORDER BY ra.year DESC, ra.quarter DESC, gl.grade_level, ra.report_assignment_id DESC
  `;

  console.log('[API] Fetching LAEMPL & MPS assignments with query:', sql);

  db.query(sql, (err, results) => {
    if (err) {
      console.error('[API] Failed to fetch LAEMPL & MPS assignments:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    console.log('[API] LAEMPL & MPS assignments query returned', results?.length || 0, 'results:', results);
    res.json(results || []);
  });
};

// PATCH /reports/laempl-mps/assignments/:id
export const updateLAEMPLMPSAssignment = (req, res) => {
  const { id } = req.params;
  const {
    grade_level_id: rawGradeLevelId,
    coordinator_user_id: rawCoordinatorId,
    advisory_user_id: rawAdvisoryId
  } = req.body || {};

  const normalize = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    if (!Number.isInteger(num)) {
      return NaN;
    }
    return num;
  };

  const grade_level_id = normalize(rawGradeLevelId);
  const coordinator_user_id = normalize(rawCoordinatorId);
  // advisory_user_id can be null, so only normalize if provided
  const advisory_user_id = rawAdvisoryId === null || rawAdvisoryId === undefined || rawAdvisoryId === '' 
    ? null 
    : normalize(rawAdvisoryId);

  const isClearing = [rawGradeLevelId, rawCoordinatorId, rawAdvisoryId].every((v) => v === null || v === undefined || v === '');

  if (!isClearing) {
    // grade_level_id and coordinator_user_id are required, advisory_user_id can be null
    if (grade_level_id === null || Number.isNaN(grade_level_id)) {
      return res.status(400).json({ error: 'grade_level_id is required and must be an integer.' });
    }
    if (coordinator_user_id === null || Number.isNaN(coordinator_user_id)) {
      return res.status(400).json({ error: 'coordinator_user_id is required and must be an integer.' });
    }
    // advisory_user_id can be null, but if provided, it must be a valid integer
    if (advisory_user_id !== null && Number.isNaN(advisory_user_id)) {
      return res.status(400).json({ error: 'advisory_user_id must be an integer if provided.' });
    }
  } else {
    // When clearing, all values should be null (not NaN)
    if (Number.isNaN(grade_level_id) || Number.isNaN(coordinator_user_id) || (advisory_user_id !== null && Number.isNaN(advisory_user_id))) {
      return res.status(400).json({ error: 'Invalid numeric value provided.' });
    }
  }

  const checkSql = `
    SELECT report_assignment_id, grade_level_id, coordinator_user_id, advisory_user_id, quarter, year
    FROM report_assignment
    WHERE report_assignment_id = ? AND category_id = 1 AND sub_category_id = 3
  `;

  db.query(checkSql, [id], (checkErr, rows) => {
    if (checkErr) {
      console.error('Failed to verify report assignment:', checkErr);
      return res.status(500).json({ error: 'Database error', details: checkErr.message });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'LAEMPL & MPS report assignment not found.' });
    }

    const updateSql = `
      UPDATE report_assignment
      SET grade_level_id = ?, coordinator_user_id = ?, advisory_user_id = ?
      WHERE report_assignment_id = ?
    `;

    const values = [
      isClearing ? null : grade_level_id,
      isClearing ? null : coordinator_user_id,
      isClearing ? null : advisory_user_id,
      id
    ];

    db.query(updateSql, values, (updateErr) => {
      if (updateErr) {
        if (updateErr.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({
            error: 'This grade already has a LAEMPL & MPS assignment for the selected quarter and year.'
          });
        }
        console.error('Failed to update LAEMPL & MPS assignment:', updateErr);
        return res.status(500).json({ error: 'Failed to update assignment', details: updateErr.message });
      }

      db.query(checkSql, [id], (reloadErr, updatedRows) => {
        if (reloadErr) {
          console.error('Failed to reload updated assignment:', reloadErr);
          return res.status(500).json({ error: 'Database error', details: reloadErr.message });
        }

        const updated = updatedRows?.[0] || null;
        res.json({
          message: isClearing
            ? 'LAEMPL & MPS assignment cleared.'
            : 'LAEMPL & MPS assignment updated successfully.',
          assignment: updated
        });
      });
    });
  });
};

// POST /reports/laempl-mps/assignments/create-or-update
// Creates or updates a LAEMPL & MPS assignment for a grade level
export const createOrUpdateLAEMPLMPSAssignment = (req, res) => {
  const authenticatedUserId = req.user?.user_id;
  if (!authenticatedUserId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const {
    grade_level_id: rawGradeLevelId,
    coordinator_user_id: rawCoordinatorId,
    quarter: rawQuarter,
    year: rawYear
  } = req.body || {};

  const normalize = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    if (!Number.isInteger(num)) return NaN;
    return num;
  };

  const grade_level_id = normalize(rawGradeLevelId);
  const coordinator_user_id = normalize(rawCoordinatorId);
  const quarter = normalize(rawQuarter);
  const year = normalize(rawYear);

  if (Number.isNaN(grade_level_id) || grade_level_id == null) {
    return res.status(400).json({ error: 'grade_level_id is required and must be an integer.' });
  }
  if (Number.isNaN(coordinator_user_id) || coordinator_user_id == null) {
    return res.status(400).json({ error: 'coordinator_user_id is required and must be an integer.' });
  }
  if (Number.isNaN(quarter) || quarter == null) {
    return res.status(400).json({ error: 'quarter is required and must be an integer.' });
  }
  if (Number.isNaN(year) || year == null) {
    return res.status(400).json({ error: 'year is required and must be an integer.' });
  }

  // Check if assignment already exists for this grade, quarter, and year
  const checkSql = `
    SELECT report_assignment_id, coordinator_user_id, grade_level_id
    FROM report_assignment
    WHERE category_id = 1 AND sub_category_id = 3 
      AND grade_level_id = ? AND quarter = ? AND year = ?
  `;

  db.query(checkSql, [grade_level_id, quarter, year], (checkErr, rows) => {
    if (checkErr) {
      console.error('Failed to check for existing assignment:', checkErr);
      return res.status(500).json({ error: 'Database error', details: checkErr.message });
    }

    if (rows && rows.length > 0) {
      // Assignment exists, update it
      const assignmentId = rows[0].report_assignment_id;
      const updateSql = `
        UPDATE report_assignment
        SET coordinator_user_id = ?, advisory_user_id = NULL
        WHERE report_assignment_id = ?
      `;

      db.query(updateSql, [coordinator_user_id, assignmentId], (updateErr) => {
        if (updateErr) {
          console.error('Failed to update assignment:', updateErr);
          return res.status(500).json({ error: 'Failed to update assignment', details: updateErr.message });
        }

        // Return the updated assignment
        db.query(checkSql, [grade_level_id, quarter, year], (reloadErr, updatedRows) => {
          if (reloadErr) {
            console.error('Failed to reload updated assignment:', reloadErr);
            return res.status(500).json({ error: 'Database error', details: reloadErr.message });
          }

          const updated = updatedRows?.[0] || null;
          res.json({
            message: 'LAEMPL & MPS assignment updated successfully.',
            assignment: updated
          });
        });
      });
    } else {
      // Assignment doesn't exist, create it
      const insertSql = `
        INSERT INTO report_assignment 
        (category_id, sub_category_id, grade_level_id, coordinator_user_id, advisory_user_id, 
         given_by, quarter, year, title, instruction, is_given, is_archived, allow_late, from_date, to_date)
        VALUES (1, 3, ?, ?, NULL, ?, ?, ?, 'LAEMPL & MPS', '', 0, 0, 0, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))
      `;

      db.query(insertSql, [grade_level_id, coordinator_user_id, authenticatedUserId, quarter, year], (insertErr, insertResult) => {
        if (insertErr) {
          if (insertErr.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
              error: 'This grade already has a LAEMPL & MPS assignment for the selected quarter and year.'
            });
          }
          console.error('Failed to create assignment:', insertErr);
          return res.status(500).json({ error: 'Failed to create assignment', details: insertErr.message });
        }

        const newAssignmentId = insertResult.insertId;
        db.query(checkSql, [grade_level_id, quarter, year], (reloadErr, newRows) => {
          if (reloadErr) {
            console.error('Failed to reload new assignment:', reloadErr);
            return res.status(500).json({ error: 'Database error', details: reloadErr.message });
          }

          const newAssignment = newRows?.[0] || null;
          res.json({
            message: 'LAEMPL & MPS assignment created successfully.',
            assignment: newAssignment
          });
        });
      });
    }
  });
};

// GET /reports/laempl-mps/coordinator-grade
// Get the coordinator's assigned grade level and subjects for LAEMPL & MPS (category_id=1, sub_category_id=3)
export const getCoordinatorLAEMPLMPSGrade = (req, res) => {
  const authenticatedUserId = req.user?.user_id;
  if (!authenticatedUserId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // First, get the grade level from report_assignment
  const gradeSql = `
    SELECT 
      ra.grade_level_id,
      gl.grade_level
    FROM report_assignment ra
    LEFT JOIN grade_level gl ON ra.grade_level_id = gl.grade_level_id
    WHERE ra.category_id = 1 
      AND ra.sub_category_id = 3
      AND ra.coordinator_user_id = ?
    ORDER BY ra.year DESC, ra.quarter DESC, ra.report_assignment_id DESC
    LIMIT 1
  `;

  db.query(gradeSql, [authenticatedUserId], (err, gradeResults) => {
    if (err) {
      console.error('[API] Failed to fetch coordinator LAEMPL & MPS grade:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    
    const gradeData = gradeResults && gradeResults.length > 0 ? gradeResults[0] : null;
    const gradeLevelId = gradeData?.grade_level_id;

    if (!gradeLevelId) {
      return res.json({ 
        grade_level_id: null, 
        grade_level: null,
        subject_ids: []
      });
    }

    // Get subjects from assignments where coordinator is assigned OR from submissions where coordinator is the submitter
    // These assignments have titles like "Title - SubjectName" (e.g., "mpl testing - GMRC")
    // First try: assignments where coordinator is directly assigned
    // Second try: submissions where coordinator submitted (they might have subject_id in fields)
    const subjectsSql = `
      SELECT DISTINCT s.subject_id, s.subject_name, ra.title as assignment_title, 'assignment' as source
      FROM report_assignment ra
      LEFT JOIN assignment_distribution ad ON ra.report_assignment_id = ad.report_assignment_id
      LEFT JOIN submission sub ON ra.report_assignment_id = sub.report_assignment_id
      JOIN subject s ON (
        -- Try exact match from title first
        s.subject_name = TRIM(SUBSTRING_INDEX(ra.title, ' - ', -1))
        -- Or try matching the beginning of subject name (handles cases like "GMRC (15 - 25 points)")
        OR s.subject_name LIKE CONCAT(TRIM(SUBSTRING_INDEX(ra.title, ' - ', -1)), '%')
        -- Or try matching if subject name is at the start of the extracted part
        OR TRIM(SUBSTRING_INDEX(ra.title, ' - ', -1)) LIKE CONCAT(s.subject_name, '%')
        -- Or match from submission fields JSON
        OR CAST(JSON_EXTRACT(sub.fields, '$.subject_id') AS UNSIGNED) = s.subject_id
      )
      WHERE ra.category_id = 1 
        AND ra.sub_category_id = 3
        AND ra.grade_level_id = ?
        AND (
          ra.coordinator_user_id = ?
          OR ad.user_id = ?
        )
        AND (
          ra.title LIKE '% - %'
          OR JSON_EXTRACT(sub.fields, '$.subject_id') IS NOT NULL
        )
        AND s.grade_level_id = ?
        AND s.is_active = 1
      
      UNION
      
      -- Also check submissions where coordinator submitted (they have subject_id in fields)
      SELECT DISTINCT s2.subject_id, s2.subject_name, ra2.title as assignment_title, 'submission' as source
      FROM submission sub2
      JOIN report_assignment ra2 ON sub2.report_assignment_id = ra2.report_assignment_id
      JOIN subject s2 ON CAST(JSON_EXTRACT(sub2.fields, '$.subject_id') AS UNSIGNED) = s2.subject_id
      WHERE ra2.category_id = 1
        AND ra2.sub_category_id = 3
        AND ra2.grade_level_id = ?
        AND sub2.submitted_by = ?
        AND JSON_EXTRACT(sub2.fields, '$.subject_id') IS NOT NULL
        AND s2.grade_level_id = ?
        AND s2.is_active = 1
      
      ORDER BY subject_name
    `;

    console.log('[API] Finding subjects for coordinator:', authenticatedUserId, 'grade:', gradeLevelId);
    
    db.query(subjectsSql, [gradeLevelId, authenticatedUserId, authenticatedUserId, gradeLevelId, gradeLevelId, authenticatedUserId, gradeLevelId], (subjErr, subjectResults) => {
      if (subjErr) {
        console.error('[API] Failed to fetch subjects:', subjErr);
        return res.json({
          grade_level_id: gradeLevelId,
          grade_level: gradeData.grade_level,
          subject_ids: []
        });
      }

      console.log('[API] Subject query returned', subjectResults?.length || 0, 'results');
      
      // Helper function to return response
      const returnResponse = (subjectIds) => {
        console.log('[API] Returning subject_ids:', subjectIds);
        res.json({
          grade_level_id: gradeLevelId,
          grade_level: gradeData.grade_level,
          subject_ids: subjectIds
        });
      };
      
      if (subjectResults && subjectResults.length > 0) {
        console.log('[API] Found subjects:', subjectResults.map(r => ({ 
          id: r.subject_id, 
          name: r.subject_name, 
          from_title: r.assignment_title,
          source: r.source
        })));
        
        const subjectIds = subjectResults.map(r => Number(r.subject_id)).filter(id => !isNaN(id));
        return returnResponse(subjectIds);
      }
      
      // Fallback: If no subjects found via assignments/submissions, 
      // check ALL assignments for this grade level and extract subjects from titles
      // This handles cases where assignments exist but aren't properly linked
      console.log('[API] No subjects found via assignments/submissions, trying fallback...');
      
      // First, let's check what assignments exist with the subject pattern, regardless of grade_level_id
      const checkAssignmentsSql = `
        SELECT ra.report_assignment_id, ra.title, ra.grade_level_id, ra.category_id, ra.sub_category_id
        FROM report_assignment ra
        WHERE ra.category_id = 1 
          AND ra.sub_category_id = 3
          AND ra.title LIKE '% - %'
        ORDER BY ra.report_assignment_id DESC
        LIMIT 20
      `;
      
      db.query(checkAssignmentsSql, [], (checkErr, checkRows) => {
        if (!checkErr && checkRows) {
          console.log('[API] Fallback debug - All assignments with subject pattern:', checkRows.map(r => ({
            id: r.report_assignment_id,
            title: r.title,
            grade_level_id: r.grade_level_id,
            category_id: r.category_id,
            sub_category_id: r.sub_category_id
          })));
        }
        
        // Now try the fallback query - first with grade_level_id filter
        const fallbackSql = `
          SELECT DISTINCT s.subject_id, s.subject_name, ra.title as assignment_title, ra.grade_level_id
          FROM report_assignment ra
          JOIN subject s ON (
            s.subject_name = TRIM(SUBSTRING_INDEX(ra.title, ' - ', -1))
            OR s.subject_name LIKE CONCAT(TRIM(SUBSTRING_INDEX(ra.title, ' - ', -1)), '%')
            OR TRIM(SUBSTRING_INDEX(ra.title, ' - ', -1)) LIKE CONCAT(s.subject_name, '%')
          )
          WHERE ra.category_id = 1 
            AND ra.sub_category_id = 3
            AND ra.grade_level_id = ?
            AND ra.title LIKE '% - %'
            AND s.grade_level_id = ?
            AND s.is_active = 1
          ORDER BY s.subject_name
          LIMIT 20
        `;
      
        db.query(fallbackSql, [gradeLevelId, gradeLevelId], (fallbackErr, fallbackResults) => {
          if (!fallbackErr && fallbackResults && fallbackResults.length > 0) {
            console.log('[API] Fallback found', fallbackResults.length, 'subjects from all assignments');
            console.log('[API] Fallback subjects:', fallbackResults.map(r => ({
              id: r.subject_id,
              name: r.subject_name,
              from_title: r.assignment_title,
              grade_level_id: r.grade_level_id
            })));
            
            // Use fallback results
            const fallbackSubjectIds = fallbackResults.map(r => Number(r.subject_id)).filter(id => !isNaN(id));
            return returnResponse(fallbackSubjectIds);
          }
          
          // If fallback with grade_level_id filter fails, try without grade_level_id filter
          // (in case assignments don't have grade_level_id set correctly)
          console.log('[API] Fallback with grade_level_id filter returned no results, trying without grade filter...');
          const fallbackNoGradeSql = `
            SELECT DISTINCT s.subject_id, s.subject_name, ra.title as assignment_title, ra.grade_level_id
            FROM report_assignment ra
            JOIN subject s ON (
              s.subject_name = TRIM(SUBSTRING_INDEX(ra.title, ' - ', -1))
              OR s.subject_name LIKE CONCAT(TRIM(SUBSTRING_INDEX(ra.title, ' - ', -1)), '%')
              OR TRIM(SUBSTRING_INDEX(ra.title, ' - ', -1)) LIKE CONCAT(s.subject_name, '%')
            )
            WHERE ra.category_id = 1 
              AND ra.sub_category_id = 3
              AND ra.title LIKE '% - %'
              AND s.grade_level_id = ?
              AND s.is_active = 1
            ORDER BY s.subject_name
            LIMIT 20
          `;
          
          db.query(fallbackNoGradeSql, [gradeLevelId], (fallbackNoGradeErr, fallbackNoGradeResults) => {
            if (!fallbackNoGradeErr && fallbackNoGradeResults && fallbackNoGradeResults.length > 0) {
              console.log('[API] Fallback (no grade filter) found', fallbackNoGradeResults.length, 'subjects');
              console.log('[API] Fallback (no grade filter) subjects:', fallbackNoGradeResults.map(r => ({
                id: r.subject_id,
                name: r.subject_name,
                from_title: r.assignment_title,
                grade_level_id: r.grade_level_id
              })));
              
              const fallbackSubjectIds = fallbackNoGradeResults.map(r => Number(r.subject_id)).filter(id => !isNaN(id));
              return returnResponse(fallbackSubjectIds);
            }
            
            // If fallback also fails, return empty and show debug info
            console.log('[API] All fallback queries returned no results');
            
            // Debug: Let's check what assignments exist for this coordinator
            const debugSql = `
              SELECT ra.report_assignment_id, ra.title, ra.coordinator_user_id, ra.parent_report_assignment_id, ra.given_by
              FROM report_assignment ra
              LEFT JOIN assignment_distribution ad ON ra.report_assignment_id = ad.report_assignment_id
              WHERE ra.category_id = 1 
                AND ra.sub_category_id = 3
                AND ra.grade_level_id = ?
                AND (
                  ra.coordinator_user_id = ?
                  OR ad.user_id = ?
                )
              ORDER BY ra.report_assignment_id DESC
              LIMIT 10
            `;
            
            db.query(debugSql, [gradeLevelId, authenticatedUserId, authenticatedUserId], (debugErr, debugRows) => {
              if (!debugErr && debugRows) {
                console.log('[API] Debug - All assignments for coordinator:', debugRows.map(r => ({
                  id: r.report_assignment_id,
                  title: r.title,
                  coordinator_id: r.coordinator_user_id,
                  parent_id: r.parent_report_assignment_id,
                  given_by: r.given_by
                })));
              }
            });
            
            // Also check ALL assignments for this grade level to see what exists
            const allAssignmentsSql = `
              SELECT ra.report_assignment_id, ra.title, ra.coordinator_user_id, ra.parent_report_assignment_id, ra.given_by
              FROM report_assignment ra
              WHERE ra.category_id = 1 
                AND ra.sub_category_id = 3
                AND ra.grade_level_id = ?
              ORDER BY ra.report_assignment_id DESC
              LIMIT 20
            `;
            
            db.query(allAssignmentsSql, [gradeLevelId], (allErr, allRows) => {
              if (!allErr && allRows) {
                console.log('[API] Debug - ALL assignments for grade level', gradeLevelId, ':', allRows.map(r => ({
                  id: r.report_assignment_id,
                  title: r.title,
                  coordinator_id: r.coordinator_user_id,
                  parent_id: r.parent_report_assignment_id,
                  given_by: r.given_by
                })));
                
                // Check assignment_distribution for these assignments
                if (allRows.length > 0) {
                  const assignmentIds = allRows.map(r => r.report_assignment_id);
                  const distCheckSql = `
                    SELECT ad.report_assignment_id, ad.user_id, ra.title
                    FROM assignment_distribution ad
                    JOIN report_assignment ra ON ad.report_assignment_id = ra.report_assignment_id
                    WHERE ad.report_assignment_id IN (${assignmentIds.join(',')})
                      AND ad.user_id = ?
                  `;
                  
                  db.query(distCheckSql, [authenticatedUserId], (distErr, distRows) => {
                    if (!distErr && distRows) {
                      console.log('[API] Debug - Assignments in assignment_distribution for coordinator:', distRows.map(r => ({
                        assignment_id: r.report_assignment_id,
                        title: r.title,
                        user_id: r.user_id
                      })));
                    }
                  });
                }
              }
              
              // Return empty if all queries failed
              return returnResponse([]);
            });
          });
        });
      });
    });
  });
};

// GET /reports/laempl-mps/coordinator-grade/:coordinatorId
// Principal lookup of a coordinator's assigned grade level for LAEMPL & MPS
export const getCoordinatorLAEMPLMPSGradeById = (req, res) => {
  const { coordinatorId } = req.params;
  const { year, quarter } = req.query;

  if (!coordinatorId) {
    return res.status(400).json({ error: 'coordinatorId is required.' });
  }

  const filters = [];
  const values = [Number(coordinatorId)];

  if (year) {
    filters.push('ra.year = ?');
    values.push(Number(year));
  }

  if (quarter) {
    filters.push('ra.quarter = ?');
    values.push(Number(quarter));
  }

  const whereClause = filters.length ? ` AND ${filters.join(' AND ')}` : '';

  const sql = `
    SELECT 
      ra.grade_level_id,
      gl.grade_level
    FROM report_assignment ra
    LEFT JOIN grade_level gl ON ra.grade_level_id = gl.grade_level_id
    WHERE ra.category_id = 1
      AND ra.sub_category_id = 3
      AND ra.coordinator_user_id = ?
      ${whereClause}
    ORDER BY ra.year DESC, ra.quarter DESC, ra.report_assignment_id DESC
    LIMIT 1
  `;

  db.query(sql, values, (err, rows) => {
    if (err) {
      console.error('[API] Failed to fetch coordinator grade by ID:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Coordinator grade not found for LAEMPL & MPS.' });
    }

    res.json(rows[0]);
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
