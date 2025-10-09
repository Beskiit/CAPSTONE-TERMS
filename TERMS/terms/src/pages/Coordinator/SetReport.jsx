import React, { useState, useEffect, useMemo } from "react";
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarCoordinator.jsx";
import SidebarPrincipal from "../../components/shared/SidebarPrincipal.jsx";
import "./SetReport.css";
import Laempl from "../../assets/templates/LAEMPL.png";
import AccomplishmentReport from "../../assets/templates/accomplishment-report.png";
//import MpsTemplate from "../../assets/templates/mps.png";

const API_BASE = import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com";

// Preview mapping (category_id → sub_category_id → image)
const TEMPLATE_MAP = {
  "1": { "10": AccomplishmentReport },
  "2": { "20": Laempl },
  //"3": { "30": MpsTemplate },
};

function SetReport() {
  const [user, setUser] = useState(null);
  const role = (user?.role || "").toLowerCase();
  const isCoordinator = role === "coordinator";

  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [attempts, setAttempts] = useState("");
  const [allowLate, setAllowLate] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");

  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [instruction, setInstruction] = useState("");
  const [title, setTitle] = useState("");

  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Preview image resolver
  const previewSrc = useMemo(() => {
    if (!selectedCategory || !selectedSubCategory) return "";
    const cat = TEMPLATE_MAP[String(selectedCategory)];
    return cat ? cat[String(selectedSubCategory)] || "" : "";
  }, [selectedCategory, selectedSubCategory]);

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
      const res = await fetch(`${API_BASE}/users/list/teachers`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch teachers");
      const data = await res.json(); // [{ user_id, name }]
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };
  fetchTeachers();
}, [API_BASE]);


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
  // load subcategories whenever selectedCategory changes
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
      setSubCategories(data); // ✅ data must be [{sub_category_id, sub_category_name}, ...]
    } catch (err) {
      console.error("Failed to fetch subcategories:", err);
    }
  };
  fetchSubCategories();
}, [selectedCategory]);

// --- ADD THIS HELPER ABOVE handleSubmit ---
// Decide report type using sub-category name (preferred) or known IDs (fallback)
function detectReportType(subCategories, selectedSubCategoryId) {
  const sub = subCategories.find(
    s => String(s.sub_category_id) === String(selectedSubCategoryId)
  );
  const name = (sub?.sub_category_name || "").toLowerCase();

  if (name.includes("laempl")) return "laempl";
  if (name.includes("mps")) return "mps";

  // Optional fallback by ID (adjust to match your DB if you like)
  const id = Number(selectedSubCategoryId);
  if ([20].includes(id)) return "laempl"; // e.g., 20 = LAEMPL
  if ([30].includes(id)) return "mps";    // e.g., 30 = MPS

  return "generic";
}

  // Handle form submit → connect to giveReport
 // --- REPLACE YOUR handleSubmit WITH THIS ---
const handleSubmit = async (e) => {
  e.preventDefault();

  // quick form guardrails
  if (!selectedCategory || !selectedSubCategory || !selectedTeacher || !dueDate) {
    alert("Please complete Category, Sub-Category, Teacher, and Due Date.");
    return;
  }

  // detect report type from the chosen sub-category
  const reportType = detectReportType(subCategories, selectedSubCategory);

  // map the attempts picker to number_of_submission
  // (blank -> "unlimited" so backend auto-assigns next slot)
  const numberValue =
    attempts === "" ? "unlimited" : isNaN(Number(attempts)) ? attempts : Number(attempts);

  // shared payload fields
  const base = {
    category_id: Number(selectedCategory),
    sub_category_id: Number(selectedSubCategory),
    submitted_by: Number(selectedTeacher), // single teacher
    quarter: 1,
    year: 1,
    from_date: startDate || null,
    to_date: dueDate,
    instruction,
    is_given: 1,
    is_archived: 0,
    allow_late: allowLate ? 1 : 0,
  };

  // choose endpoint & payload by type
  let endpoint = "";
  let body = {};
  const fallbackTitle =
    (title && title.trim()) ||
    (reportType === "laempl" ? "LAEMPL Report" : reportType === "mps" ? "MPS Report" : "Report");

  if (reportType === "laempl") {
    endpoint = `${API_BASE}/reports/laempl`; // adjust if your backend path differs
    body = {
      ...base,
      title: fallbackTitle,
      grade: 1, // hardcoded for now; add a UI field later if needed
      number_of_submission: numberValue,
    };
  } else if (reportType === "mps") {
    endpoint = `${API_BASE}/mps/give`; // adjust if your backend path differs
    body = {
      ...base,
      title: fallbackTitle,
      grade: 1,
      number_of_submission: numberValue,
    };
  } else {
    // generic (schema-based) assign
    endpoint = `${API_BASE}/reports/give`;
    body = {
      ...base,
      title: fallbackTitle,
      field_definitions: [], // add if you use dynamic fields
      number_of_submission: numberValue,
    };
  }

  try {
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
    alert(`Report assigned successfully! ID: ${data.report_assignment_id ?? "(created)"}`);
  } catch (err) {
    console.error("Error submitting report:", err);
    alert("Error submitting report. Check console.");
  }
};

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
                <input type="text" 
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
                    <option key={category.category_id} value={category.category_id}>
                      {category.category_name}
                    </option>
                  ))}
                </select>

                <label>Select Teacher:</label>
                  <select
                    value={selectedTeacher}
                    onChange={(e) => setSelectedTeacher(e.target.value)}
                  >
                    <option value="">Select Teacher</option>
                    {users.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.name}
                      </option>
                    ))}
                  </select>

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
                      <option key={sub.sub_category_id} value={sub.sub_category_id}>
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
                  <option value="" disabled>Select Number of Attempts</option>
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
                <button type="submit">Set Schedule</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default SetReport;
