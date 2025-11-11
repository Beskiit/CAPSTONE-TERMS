import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../../components/shared/SidebarAdmin";
import "./AssignUser.css";
import Header from "../../components/shared/Header";
import Breadcrumb from "../../components/Breadcrumb";
import Modal from "react-modal";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function AssignUser() {
  const [user, setUser] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [gradeLevels, setGradeLevels] = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formValues, setFormValues] = useState({
    grade_level_id: "",
    coordinator_user_id: "",
    advisory_user_id: "",
  });

  useEffect(() => {
    Modal.setAppElement("#root");
  }, []);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        }
      } catch (err) {
        console.error("Failed to fetch current user:", err);
      }
    };

    const fetchAssignments = async () => {
      try {
        setLoadingAssignments(true);
        const res = await fetch(`${API_BASE}/reports/laempl-mps/assignments`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }
        const data = await res.json();
        setAssignments(data);
      } catch (err) {
        console.error("Failed to fetch assignments:", err);
      } finally {
        setLoadingAssignments(false);
      }
    };

    const fetchGradeLevels = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/grade-levels`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setGradeLevels(data);
        }
      } catch (err) {
        console.error("Failed to fetch grade levels:", err);
      }
    };

    const fetchCoordinators = async () => {
      try {
        const res = await fetch(`${API_BASE}/users/coordinators`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setCoordinators(data);
        }
      } catch (err) {
        console.error("Failed to fetch coordinators:", err);
      }
    };

    const fetchTeachers = async () => {
      try {
        const res = await fetch(`${API_BASE}/users/teachers`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setTeachers(data);
        }
      } catch (err) {
        console.error("Failed to fetch teachers:", err);
      }
    };

    fetchCurrentUser();
    fetchAssignments();
    fetchGradeLevels();
    fetchCoordinators();
    fetchTeachers();
  }, []);

  const gradeLevelMap = useMemo(() => {
    return gradeLevels.reduce((acc, item) => {
      acc[item.grade_level_id] = item.grade_level;
      return acc;
    }, {});
  }, [gradeLevels]);

  const refreshAssignments = async () => {
    try {
      setLoadingAssignments(true);
      const res = await fetch(`${API_BASE}/reports/laempl-mps/assignments`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = await res.json();
      setAssignments(data);
    } catch (err) {
      console.error("Failed to refresh assignments:", err);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const openAssignModal = (assignment) => {
    setSelectedAssignment(assignment);
    setFormValues({
      grade_level_id: assignment.grade_level_id ? String(assignment.grade_level_id) : "",
      coordinator_user_id: assignment.coordinator_user_id ? String(assignment.coordinator_user_id) : "",
      advisory_user_id: assignment.advisory_user_id ? String(assignment.advisory_user_id) : "",
    });
    setFormError("");
    setAssignModalOpen(true);
  };

  const closeAssignModal = () => {
    setAssignModalOpen(false);
    setSelectedAssignment(null);
    setFormError("");
    setFormValues({ grade_level_id: "", coordinator_user_id: "", advisory_user_id: "" });
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveAssignment = async () => {
    if (!selectedAssignment) return;

    if (!formValues.grade_level_id || !formValues.coordinator_user_id || !formValues.advisory_user_id) {
      setFormError("Grade level, coordinator, and adviser are required.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const res = await fetch(`${API_BASE}/reports/laempl-mps/assignments/${selectedAssignment.report_assignment_id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grade_level_id: Number(formValues.grade_level_id),
          coordinator_user_id: Number(formValues.coordinator_user_id),
          advisory_user_id: Number(formValues.advisory_user_id),
        }),
      });

      const responseData = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(responseData.error || responseData.message || "Failed to save assignment.");
      }

      closeAssignModal();
      await refreshAssignments();
    } catch (err) {
      console.error("Failed to save assignment:", err);
      setFormError(err.message || "Failed to save assignment.");
    } finally {
      setSaving(false);
    }
  };

  const handleClearAssignment = async (assignment) => {
    if (!assignment) return;
    const confirmed = window.confirm("Clear the grade, coordinator, and adviser for this assignment?");
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/reports/laempl-mps/assignments/${assignment.report_assignment_id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grade_level_id: null,
          coordinator_user_id: null,
          advisory_user_id: null,
        }),
      });

      const responseData = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(responseData.error || responseData.message || "Failed to clear assignment.");
      }

      await refreshAssignments();
    } catch (err) {
      console.error("Failed to clear assignment:", err);
      window.alert(err.message || "Failed to clear assignment.");
    }
  };

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        <Sidebar activeLink="Assign User/Principal" />
        <div className="dashboard-content">
          <Breadcrumb />
          <div className="dashboard-main">
            <h2>Assign LAEMPL &amp; MPS Coordinators</h2>
          </div>

          <div className="content">
            {loadingAssignments ? (
              <div>Loading assignments...</div>
            ) : (
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>Grade</th>
                    <th>Coordinator</th>
                    <th>Adviser</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-row">No LAEMPL &amp; MPS assignments found.</td>
                    </tr>
                  ) : (
                    assignments.map((assignment) => {
                      const gradeLabel = assignment.grade_level_id
                        ? `Grade ${gradeLevelMap[assignment.grade_level_id] || assignment.grade_level_id}`
                        : "Unassigned";

                      return (
                        <tr key={assignment.report_assignment_id}>
                          <td className="file-cell">
                            <span className="file-name">{assignment.title || "LAEMPL & MPS"}</span>
                          </td>
                          <td>{gradeLabel}</td>
                          <td>{assignment.coordinator_name || "—"}</td>
                          <td>{assignment.advisory_name || "—"}</td>
                          <td>
                            <div className="action-buttons">
                              <button
                                type="button"
                                className="btn-action"
                                onClick={() => openAssignModal(assignment)}
                              >
                                {assignment.grade_level_id ? "Edit" : "Assign"}
                              </button>
                              {assignment.grade_level_id && (
                                <button
                                  type="button"
                                  className="btn-action secondary"
                                  onClick={() => handleClearAssignment(assignment)}
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          <Modal
            isOpen={assignModalOpen}
            onRequestClose={closeAssignModal}
            className="modal"
            overlayClassName="overlay"
            contentLabel="Assign coordinator"
          >
            <div className="popup-header">
              <h2>{selectedAssignment?.grade_level_id ? "Update Assignment" : "Assign Coordinator"}</h2>
              <button className="close-button" onClick={closeAssignModal} aria-label="Close">
                ×
              </button>
            </div>
            <hr />

            {selectedAssignment ? (
              <form
                className="user-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSaveAssignment();
                }}
              >
                <div className="form-row">
                  <label htmlFor="gradeLevel">Grade Level</label>
                  <select
                    id="gradeLevel"
                    name="grade_level_id"
                    value={formValues.grade_level_id}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">Select grade level</option>
                    {gradeLevels.map((grade) => (
                      <option key={grade.grade_level_id} value={grade.grade_level_id}>
                        Grade {grade.grade_level}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <label htmlFor="coordinator">Grade Coordinator</label>
                  <select
                    id="coordinator"
                    name="coordinator_user_id"
                    value={formValues.coordinator_user_id}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">Select coordinator</option>
                    {coordinators.map((coord) => (
                      <option key={coord.user_id} value={coord.user_id}>
                        {coord.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <label htmlFor="adviser">Grade Adviser</label>
                  <select
                    id="adviser"
                    name="advisory_user_id"
                    value={formValues.advisory_user_id}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">Select adviser</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.user_id} value={teacher.user_id}>
                        {teacher.name}
                      </option>
                    ))}
                  </select>
                </div>

                {formError && <p className="form-error">{formError}</p>}

                <div className="modal-actions">
                  <button className="btn" type="button" onClick={closeAssignModal} disabled={saving}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            ) : (
              <div>Loading...</div>
            )}
          </Modal>
        </div>
      </div>
    </>
  );
}

export default AssignUser;
