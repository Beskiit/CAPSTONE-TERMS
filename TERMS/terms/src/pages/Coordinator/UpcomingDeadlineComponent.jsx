import React from "react";
import { useNavigate } from "react-router-dom";

export default function UpcomingDeadlineComponent({ upcomingSubmissions = [] }) {
  const navigate = useNavigate();

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

  const goToSetReport = (submission) => {
    console.log('🔍 [DEBUG] Redirecting to SetReport for submission:', submission);
    navigate(`/SetReport?reportId=${submission.report_assignment_id}&isPrincipalReport=true`);
  };

  return (
    <div className="deadline-component">
      <h4>Upcoming Deadlines - Needs Scheduling</h4>
      <hr />

      <div className="deadline-box">
        <div className="deadline-list">
          {upcomingSubmissions.length > 0 ? (
            upcomingSubmissions.map((submission, idx) => {
              return (
                <a
                  key={submission.submission_id || submission.report_assignment_id || idx}
                  className="deadline-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => goToSetReport(submission)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      goToSetReport(submission);
                    }
                  }}
                >
                  <p className="deadline-title">
                    {submission.assignment_title || "Untitled Report"}
                  </p>
                  <div className="deadline-details">
                    <p>
                      <strong>Teacher:</strong> {submission.submitted_by_name || 'Unknown'}
                    </p>
                    <p>
                      <strong>Category:</strong> {submission.category_name || 'N/A'}
                      {submission.sub_category_name && ` - ${submission.sub_category_name}`}
                    </p>
                    <p style={{ fontSize: 12, opacity: 0.8 }}>
                      <strong>Assignment ID:</strong> {submission.report_assignment_id}
                    </p>
                    <p style={{ fontSize: 12, opacity: 0.8 }}>
                      <strong>School Year:</strong> {submission.school_year || 'N/A'} - Quarter {submission.quarter}
                    </p>
                  </div>
                </a>
              );
            })
          ) : (
            <p style={{ opacity: 0.8, margin: 0 }}>No upcoming deadlines to schedule 🎉</p>
          )}
        </div>
      </div>
    </div>
  );
}
