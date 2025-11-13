import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

export default function CoordinatorDeadlineComponent({ deadlines = [] }) {
  const navigate = useNavigate();
  const [selectedDeadline, setSelectedDeadline] = useState(null);
  const [coordinatorGradeLevelId, setCoordinatorGradeLevelId] = useState(null);
  const [user, setUser] = useState(null);

  // Fetch user and coordinator grade level
  useEffect(() => {
    const fetchUserAndGrade = async () => {
      try {
        // Fetch user
        const userRes = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include"
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
          
          // If user is a coordinator, fetch their assigned grade level
          if (userData?.role?.toLowerCase() === "coordinator") {
            const gradeRes = await fetch(`${API_BASE}/reports/laempl-mps/coordinator-grade`, {
              credentials: "include"
            });
            if (gradeRes.ok) {
              const gradeData = await gradeRes.json();
              console.log("🔍 [CoordinatorDeadlineComponent] Coordinator Grade Level Fetched:", {
                userId: userData.user_id,
                role: userData.role,
                gradeData: gradeData,
                grade_level_id: gradeData?.grade_level_id
              });
              if (gradeData?.grade_level_id != null) {
                setCoordinatorGradeLevelId(Number(gradeData.grade_level_id));
              }
            } else {
              console.warn("🔍 [CoordinatorDeadlineComponent] Failed to fetch coordinator grade level. Status:", gradeRes.status);
            }
          }
        }
      } catch (err) {
        console.warn("[CoordinatorDeadlineComponent] Failed to fetch user/grade:", err);
      }
    };
    
    fetchUserAndGrade();
  }, []);

  // The API already filters for upcoming deadlines, so we don't need to filter again
  const filteredDeadlines = deadlines;

  const fmtDateTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const detectType = (d) => {
    const title   = (d?.title || "").toLowerCase();
    const catName = (d?.category_name || "").toLowerCase();
    const subName = (d?.sub_category_name || "").toLowerCase();
    const subId   = Number(d?.sub_category_id);
    const catId   = Number(d?.category_id);

    const hay = `${title} ${catName} ${subName}`;
    if (hay.includes("laempl")) return "laempl";
    if (hay.includes("mps")) return "mps";
    if (hay.includes("accomplishment")) return "accomplishment";
    if (hay.includes("classification of grades") || hay.includes("classification")) return "cog";

    if (subId === 20) return "laempl";
    if (subId === 30) return "mps";
    if (catId === 1)  return "accomplishment";
    if (catId === 2)  return "laempl";
    return "generic";
  };

  const getSubmissionId = (d) =>
    d?.submission_id ?? d?.id ?? d?.report_assignment_id ?? null;

  // Handle clicking on a deadline
  // Always route to the instruction page; the Set-as-Report action now lives there.
  const handleDeadlineClick = async (deadline) => {
    const recipientsCount = Number(deadline?.recipients_count || 0);
    
    // For LAEMPL & MPS reports, check if coordinator should act as coordinator or teacher
    const reportType = detectType(deadline);
    const isLAEMPLMPS = reportType === "laempl" || reportType === "mps";
    const isCoordinator = user?.role?.toLowerCase() === "coordinator";
    
    let shouldForceTeacherView = recipientsCount >= 2;
    
    if (isLAEMPLMPS && isCoordinator) {
      // Fetch assignment data to check coordinator_user_id
      try {
        const assignmentId = deadline?.report_assignment_id || deadline?.id;
        if (assignmentId) {
          const res = await fetch(`${API_BASE}/reports/assignment/${assignmentId}`, {
            credentials: "include"
          });
          if (res.ok) {
            const assignment = await res.json();
            const assignmentCoordinatorId = assignment?.coordinator_user_id;
            const assignmentGradeLevelId = assignment?.grade_level_id;
            const currentUserId = user?.user_id;
            
            // Store assignment data in deadline for use in instruction page
            deadline.coordinator_user_id = assignmentCoordinatorId;
            deadline.grade_level_id = assignmentGradeLevelId;
            
            // Simple check: Compare coordinator_user_id with current user's ID
            // If coordinator_user_id is null OR doesn't match current user, act as teacher
            if (assignmentCoordinatorId == null || Number(assignmentCoordinatorId) !== Number(currentUserId)) {
              shouldForceTeacherView = true;
              console.log("[CoordinatorDeadlineComponent] Coordinator acting as teacher:", {
                assignmentCoordinatorId: assignmentCoordinatorId,
                currentUserId: currentUserId,
                reason: assignmentCoordinatorId == null ? "coordinator_user_id is null" : "coordinator_user_id doesn't match"
              });
            } else {
              // coordinator_user_id matches current user - act as coordinator
              shouldForceTeacherView = false;
              console.log("[CoordinatorDeadlineComponent] Coordinator is assigned coordinator - coordinator view", {
                coordinatorUserId: assignmentCoordinatorId,
                currentUserId: currentUserId
              });
            }
          }
        }
      } catch (err) {
        console.warn("[CoordinatorDeadlineComponent] Failed to fetch assignment data:", err);
      }
    }
    
    if (shouldForceTeacherView) {
      handleAccessDirectly({ ...deadline, __forceTeacherView: true });
      return;
    }
    handleAccessDirectly(deadline);
  };

  // Go straight to the template/instruction
  // Can be called with or without selectedDeadline (for direct navigation)
  const handleAccessDirectly = (deadline = null) => {
    const targetDeadline = deadline || selectedDeadline;
    if (!targetDeadline) return;
    
    const kind = detectType(targetDeadline);
    const submissionId = getSubmissionId(targetDeadline);

    const commonState = {
      submission_id: submissionId,
      report_assignment_id: targetDeadline.report_assignment_id || targetDeadline.id,
      title: targetDeadline.title || targetDeadline.assignment_title,
      instruction: targetDeadline.instruction,
      from_date: targetDeadline.from_date,
      to_date: targetDeadline.to_date,
      number_of_submission: targetDeadline.number_of_submission,
      allow_late: targetDeadline.allow_late,
      category_id: targetDeadline.category_id,
      category_name: targetDeadline.category_name,
      sub_category_id: targetDeadline.sub_category_id,
      sub_category_name: targetDeadline.sub_category_name,
      is_given: targetDeadline.is_given,
      recipients_count: targetDeadline.recipients_count,
      forceTeacherView: Boolean(targetDeadline.__forceTeacherView),
      coordinator_user_id: targetDeadline.coordinator_user_id,
      grade_level_id: targetDeadline.grade_level_id,
    };

    if (kind === "laempl")         return navigate("/LAEMPLInstruction", { state: commonState });
    if (kind === "mps")            return navigate("/MPSInstruction", { state: commonState });
    if (kind === "accomplishment") return navigate("/AccomplishmentReportInstruction", { state: commonState });
    if (kind === "cog")            return navigate("/ClassificationOfGradesInstruction", { state: commonState });
    return navigate("/SubmittedReport");
  };

  // show all deadlines
  const visible = filteredDeadlines;

  return (
    <>
      <div className="deadline-component">
        <h4>Upcoming Deadlines</h4>
        <hr />

        <div className="deadline-box">
          {/* Always-scrollable list */}
          <div className="deadline-list">
            {visible.length > 0 ? (
              visible.map((d, idx) => {
                const isRejected = d.status === 4;
                const extendedDueDate = d.extended_due_date ? new Date(d.extended_due_date) : null;
                const displayDueDate = extendedDueDate || new Date(d.to_date);
                
                return (
                  <a
                    key={d.submission_id || d.report_assignment_id || idx}
                    className={`deadline-item ${isRejected ? 'rejected' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleDeadlineClick(d)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleDeadlineClick(d);
                      }
                    }}
                  >
                    <p className="deadline-title">
                      {d.title || "Untitled Report"}
                      {isRejected && <span className="rejected-badge">REJECTED</span>}
                    </p>
                    <div className="deadline-details">
                      <p>
                        Due: {fmtDateTime(displayDueDate)}
                        {isRejected && extendedDueDate && (
                          <span className="extended-info"> (Extended)</span>
                        )}
                      </p>
                      {isRejected && d.rejection_reason && (
                        <p className="rejection-reason" style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
                          Reason: {d.rejection_reason}
                        </p>
                      )}
                      <p style={{ fontSize: 12, opacity: 0.8 }}>
                        Opens: {fmtDateTime(d.from_date)}
                      </p>
                    </div>
                  </a>
                );
              })
            ) : (
              <p style={{ opacity: 0.8, margin: 0 }}>No upcoming deadlines 🎉</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal removed: action now handled in instruction screen */}
    </>
  );
}

