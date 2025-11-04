import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CoordinatorDeadlineActionModal } from "../../components/CoordinatorDeadlineActionModal";

export default function CoordinatorDeadlineComponent({ deadlines = [] }) {
  const navigate = useNavigate();
  const [selectedDeadline, setSelectedDeadline] = useState(null);
  const [showModal, setShowModal] = useState(false);

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
  // If is_given = 1: go directly to template (already assigned, no modal needed)
  // If is_given = 0: show modal with options (from principal, needs scheduling decision)
  const handleDeadlineClick = (deadline) => {
    // New rule: If this assignment has 2+ recipients and coordinator is one of them (this list item is theirs),
    // behave like teacher (go straight to template), regardless of is_given.
    const recipientsCount = Number(deadline?.recipients_count || 0);
    if (recipientsCount >= 2) {
      // Force teacher-like view in the template
      handleAccessDirectly({ ...deadline, __forceTeacherView: true });
      return;
    }

    // Check if is_given = 1, then go directly without modal
    if (deadline.is_given === 1 || deadline.is_given === '1') {
      handleAccessDirectly(deadline);
      return;
    }
    
    // For is_given = 0, show modal with options
    setSelectedDeadline(deadline);
    setShowModal(true);
  };

  // Option 1: Set as Report to Teachers - redirect to SetReport with principal's data
  const handleSetAsReport = () => {
    if (!selectedDeadline) return;
    
    // Navigate to SetReport with the report assignment ID and flag
    navigate(`/SetReport?reportId=${selectedDeadline.report_assignment_id}&isPrincipalReport=true`);
  };

  // Option 2: Access Directly - go straight to the template
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
      sub_category_id: targetDeadline.sub_category_id,
      forceTeacherView: Boolean(targetDeadline.__forceTeacherView),
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

      {/* Modal for action selection */}
      <CoordinatorDeadlineActionModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedDeadline(null);
        }}
        onSetAsReport={handleSetAsReport}
        onAccessDirectly={handleAccessDirectly}
        deadlineTitle={selectedDeadline?.title || "Untitled Report"}
      />
    </>
  );
}

