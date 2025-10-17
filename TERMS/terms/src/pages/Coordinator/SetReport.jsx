import React, { useState, useEffect, useMemo, useRef } from "react";
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarCoordinator.jsx";
import SidebarPrincipal from "../../components/shared/SidebarPrincipal.jsx";
import "./SetReport.css";
import Laempl from "../../assets/templates/LAEMPL.png";
import AccomplishmentReport from "../../assets/templates/accomplishment-report.png";
// import MpsTemplate from "../../assets/templates/mps.png";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:5000").replace(/\/$/, "");
console.log(import.meta.env.VITE_API_BASE);



// Preview mapping (category_id → sub_category_id → image)
const TEMPLATE_MAP = {
  "1": { "10": AccomplishmentReport },
  "2": { "20": Laempl },
  // "3": { "30": MpsTemplate },
};

function SetReport() {
  const [user, setUser] = useState(null);
  const role = (user?.role || "").toLowerCase();
  const isCoordinator = role === "coordinator";
  const isPrincipal = role === "principal";

  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [attempts, setAttempts] = useState("");
  const [allowLate, setAllowLate] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedTeachers, setSelectedTeachers] = useState([]); // For multiple teacher selection

  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [instruction, setInstruction] = useState("");
  const [title, setTitle] = useState("");

  const [showModal, setShowModal] = useState(false);

  // workflow management
  const [workflowType, setWorkflowType] = useState("direct"); // "direct" or "coordinated"
  const [selectedCoordinator, setSelectedCoordinator] = useState("");
  const [coordinators, setCoordinators] = useState([]);

  // NEW: prevent double-submit
  const [submitting, setSubmitting] = useState(false);
  const [teacherMenuOpen, setTeacherMenuOpen] = useState(false);
  const teacherMenuRef = useRef(null);

  // Preview image resolver
  const previewSrc = useMemo(() => {
    if (!selectedCategory || !selectedSubCategory) return "";
    const cat = TEMPLATE_MAP[String(selectedCategory)];
    return cat ? cat[String(selectedSubCategory)] || "" : "";
  }, [selectedCategory, selectedSubCategory]);

  // Merge teachers + coordinators for principals
  const selectableUsers = useMemo(() => {
    const base = Array.isArray(users) ? users : [];
    if (!isPrincipal) return base;
    const extra = Array.isArray(coordinators) ? coordinators : [];
    const byId = new Map();
    [...base, ...extra].forEach((u) => {
      if (!u || u.user_id == null) return;
      byId.set(u.user_id, u);
    });
    return Array.from(byId.values());
  }, [isPrincipal, users, coordinators]);

  // ✅ Load logged-in user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }
    };
    fetchUser();
  }, []);

  // ✅ Load teachers (users)
  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const res = await fetch(`${API_BASE}/users/teachers`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch teachers");
        const data = await res.json(); // [{ user_id, name }]
        setUsers(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTeachers();
  }, []);

  // ✅ Load coordinators (for principals to assign through coordinators)
  useEffect(() => {
    const fetchCoordinators = async () => {
      try {
        const res = await fetch(`${API_BASE}/users/coordinators`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch coordinators");
        const data = await res.json(); // [{ user_id, name }]
        setCoordinators(data);
      } catch (err) {
        console.error(err);
      }
    };
    if (isPrincipal) {
      fetchCoordinators();
    }
  }, [isPrincipal]);

  // ✅ Load categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_BASE}/categories`);
        if (!res.ok) return;
        const data = await res.json();
        setCategories(data);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      }
    };
    fetchCategories();
  }, []);

  // ✅ Load subcategories whenever category changes
  useEffect(() => {
    if (!selectedCategory) {
      setSubCategories([]);
      return;
    }
    const fetchSubCategories = async () => {
      try {
        const res = await fetch(`${API_BASE}/subcategories/${selectedCategory}`);
        if (!res.ok) return;
        const data = await res.json();
        setSubCategories(data); // expects [{sub_category_id, sub_category_name}, ...]
      } catch (err) {
        console.error("Failed to fetch subcategories:", err);
      }
    };
    fetchSubCategories();
  }, [selectedCategory]);

  // Decide report type using sub-category name (preferred) or known IDs (fallback)
  function detectReportType(subCategories, selectedSubCategoryId) {
    const sub = subCategories.find(
      (s) => String(s.sub_category_id) === String(selectedSubCategoryId)
    );
    const name = (sub?.sub_category_name || "").toLowerCase();

    if (name.includes("laempl")) return "laempl";
    if (name.includes("mps")) return "mps";

    // Optional fallback by ID (adjust to match your DB if you like)
    const id = Number(selectedSubCategoryId);
    if ([20].includes(id)) return "laempl"; // e.g., 20 = LAEMPL
    if ([30].includes(id)) return "mps"; // e.g., 30 = MPS

    return "generic";
  }

  // --- handleSubmit ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // guard against double-click
    setSubmitting(true);

    try {
      // Basic validation
      if (!user?.user_id) {
        alert("User not loaded yet. Please try again in a moment.");
        return;
      }
      if (!selectedCategory || !selectedSubCategory || !dueDate) {
        alert("Please complete Category, Sub-Category, and Due Date.");
        return;
      }

      // Validate teacher selection based on workflow
      if (workflowType === "direct") {
        if (!selectedTeacher && selectedTeachers.length === 0) {
          alert("Please select at least one teacher.");
          return;
        }
      } else if (workflowType === "coordinated") {
        if (!selectedCoordinator) {
          alert("Please select a coordinator for the coordinated workflow.");
          return;
        }
        if (!selectedTeacher && selectedTeachers.length === 0) {
          alert("Please select at least one teacher.");
          return;
        }
      }

      const reportType = detectReportType(subCategories, selectedSubCategory);

      // FIX: map attempts to INT or NULL (NULL = unlimited)
      const numberValue =
        attempts === "" || attempts === "unlimited" ? null : Number(attempts);

      const recipients =
        selectedTeachers.length > 0 ? selectedTeachers : [selectedTeacher];

      const givenBy =
        workflowType === "coordinated" ? Number(selectedCoordinator) : user.user_id;

      const base = {
        category_id: Number(selectedCategory),
        sub_category_id: Number(selectedSubCategory),
        given_by: Number(givenBy),
        assignees: recipients.map((x) => Number(x)),
        quarter: 1,
        year: 1,
        from_date: startDate || null,
        to_date: dueDate,
        instruction,
        is_given: 1,
        is_archived: 0,
        allow_late: allowLate ? 1 : 0,
      };

      let endpoint = "";
      let body = {};
      const fallbackTitle =
        (title && title.trim()) ||
        (reportType === "laempl"
          ? "LAEMPL Report"
          : reportType === "mps"
          ? "MPS Report"
          : "Report");

      if (reportType === "laempl") {
        endpoint = `${API_BASE}/reports/laempl`;
        body = {
          ...base,
          title: fallbackTitle,
          grade: 1,
          number_of_submission: numberValue, // INT or NULL
        };
      } else {
        // generic + MPS both go here (MPS rows filled by teacher UI later)
        endpoint = `${API_BASE}/reports/give`;
        body = {
          ...base,
          title: fallbackTitle,
          field_definitions: [],
          number_of_submission: numberValue, // INT or NULL
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        alert("Failed to set report: " + errText);
        return;
      }

      const data = await res.json();
      const workflowMessage =
        workflowType === "coordinated"
          ? "Report assigned to coordinator for distribution to teachers!"
          : "Report assigned directly to teachers!";

      // If backend returns submission_ids, great; otherwise we at least show RA id.
      const subCount = Array.isArray(data.submission_ids)
        ? ` Created ${data.submission_ids.length} submission record(s).`
        : "";

      alert(
        `${workflowMessage} Assignment ID: ${
          data.report_assignment_id ?? "(created)"
        }.${subCount}`
      );

      // Optional: reset form
      setSelectedTeacher("");
      setSelectedTeachers([]);
      setSelectedSubCategory("");
      setSelectedCategory("");
      setStartDate("");
      setDueDate("");
      setInstruction("");
      setTitle("");
      setAttempts("");
      setAllowLate(false);
    } catch (err) {
      console.error("Error submitting report:", err);
      alert("Error submitting report. Check console.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- Teacher multi-select helpers ---
  const toggleTeacher = (userId) => {
    setSelectedTeachers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : prev.concat(userId)
    );
  };
  const selectAllTeachers = () => setSelectedTeachers(selectableUsers.map((u) => u.user_id));
  const clearAllTeachers = () => setSelectedTeachers([]);

  // Close teacher menu on outside click
  useEffect(() => {
    function onDocClick(e) {
      if (!teacherMenuOpen) return;
      if (teacherMenuRef.current && !teacherMenuRef.current.contains(e.target)) {
        setTeacherMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [teacherMenuOpen]);

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container" style={{ overflowY: "auto" }}>
        {isCoordinator ? (
          <Sidebar activeLink="Set Report Schedule" />
        ) : (
          <SidebarPrincipal activeLink="Set Report Schedule" />
        )}

        <div className="dashboard-content">
          <div className="dashboard-main">
            <h2>Set Reports</h2>

            <form className="schedule-form" onSubmit={handleSubmit}>
              <div className="form-row allow-late-row">
                <label>Title:</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="form-row">
                <label>Category:</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedSubCategory("");
                  }}
                >
                  <option value="">Select Category</option>
                  {categories.map((category) => (
                    <option
                      key={category.category_id}
                      value={category.category_id}
                    >
                      {category.category_name}
                    </option>
                  ))}
                </select>

                {/* Teachers multi-select dropdown placed in same row */}
                <label>Teachers:</label>
                <div ref={teacherMenuRef} style={{ position: "relative", width: "100%" }}>
                  <button
                    type="button"
                    onClick={() => setTeacherMenuOpen((v) => !v)}
                    aria-haspopup="listbox"
                    aria-expanded={teacherMenuOpen}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "6px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#fff",
                      cursor: "pointer",
                    }}
                    title={selectedTeachers.length ? selectableUsers.filter(u => selectedTeachers.includes(u.user_id)).map(u => u.name).join(", ") : "Select Teacher"}
                  >
                    {selectedTeachers.length
                      ? selectableUsers.filter(u => selectedTeachers.includes(u.user_id)).map(u => u.name).join(", ")
                      : "Select Teacher"}
                  </button>
                  {teacherMenuOpen && (
                    <div
                      role="listbox"
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        width: "100%",
                        maxHeight: 260,
                        overflowY: "auto",
                        background: "#fff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                        zIndex: 20,
                        marginTop: 4,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderBottom: "1px solid #e5e7eb", background: "#f8fafc", whiteSpace: "nowrap" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", margin: 0 }}>
                          <input
                            type="checkbox"
                          checked={selectedTeachers.length === selectableUsers.length && selectableUsers.length > 0}
                            onChange={(e) => (e.target.checked ? selectAllTeachers() : clearAllTeachers())}
                          />
                          <span style={{ fontWeight: 600 }}>Select all</span>
                        </label>
                        <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>{selectedTeachers.length} selected</span>
                        <button type="button" onClick={clearAllTeachers} style={{ fontSize: 12, padding: "4px 6px" }}>Clear</button>
                      </div>
                      <div style={{ padding: "4px 6px" }}>
                        {selectableUsers.map((u) => {
                          const checked = selectedTeachers.includes(u.user_id);
                          return (
                            <div
                              key={u.user_id}
                              onClick={() => toggleTeacher(u.user_id)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "6px 8px",
                                cursor: "pointer",
                                borderRadius: 4,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                background: checked ? "#3b82f6" : "transparent",
                                color: checked ? "#ffffff" : "inherit",
                                marginBottom: 2,
                              }}
                            >
                              <input
                                type="checkbox"
                                readOnly
                                checked={checked}
                                style={{ pointerEvents: "none" }}
                              />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedCategory && (
                <div className="form-row">
                  <label>Sub-Category:</label>
                  <select
                    value={selectedSubCategory}
                    onChange={(e) => setSelectedSubCategory(e.target.value)}
                  >
                    <option value="">Select Sub-Category</option>
                    {subCategories.map((sub) => (
                      <option
                        key={sub.sub_category_id}
                        value={sub.sub_category_id}
                      >
                        {sub.sub_category_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-row">
                <label>Start Date:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />

                <label>Due Date:</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="form-row allow-late-row">
                <label>Allow Late:</label>
                <input
                  type="checkbox"
                  checked={allowLate}
                  onChange={(e) => setAllowLate(e.target.checked)}
                />

                <label>Number of Attempts:</label>
                <select
                  className="attempts-select"
                  value={attempts}
                  onChange={(e) => setAttempts(e.target.value)}
                >
                  <option value="" disabled>
                    Select Number of Attempts
                  </option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                  <option value="unlimited">Unlimited</option>
                </select>
              </div>

              <div className="form-row-ins form-row textarea-row">
                <label>Instructions:</label>
                <textarea
                  placeholder="Enter instructions for the report"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                ></textarea>
              </div>

              <div className="form-actions">
                <button type="submit" disabled={submitting}>
                  {submitting ? "Setting..." : "Set Schedule"}
                </button>
              </div>
            </form>

            {/* Optional: preview image */}
            {previewSrc && (
              <div className="template-preview">
                <img src={previewSrc} alt="Template preview" />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default SetReport;
