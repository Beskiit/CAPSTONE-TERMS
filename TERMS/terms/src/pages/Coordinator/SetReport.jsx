import React, { useState, useEffect, useMemo } from "react";
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarCoordinator.jsx";
import SidebarPrincipal from "../../components/shared/SidebarPrincipal.jsx";
import "./SetReport.css";
import Laempl from "../../assets/templates/LAEMPL.png";
import AccomplishmentReport from "../../assets/templates/accomplishment-report.png";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// Preview mapping (category_id → sub_category_id → image)
const TEMPLATE_MAP = {
  "1": { "10": AccomplishmentReport },
  "2": { "20": Laempl },
};

function SetReport() {
  const [user, setUser] = useState(null);
  const role = (user?.role || "").toLowerCase();
  const isCoordinator = role === "coordinator";

  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);

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
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_BASE}/users`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        // filter only teachers
        setUsers(data.filter((u) => u.role === "teacher"));
      } catch (err) {
        console.error("Failed to fetch users:", err);
      }
    };
    fetchUsers();
  }, []);

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


  // Handle form submit → connect to giveReport
  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      category_id: selectedCategory,
      sub_category_id: selectedSubCategory,
      submitted_by: Number(selectedTeacher),
      quarter: 1,
      year: new Date().getFullYear(),
      from_date: startDate,
      to_date: dueDate,
      instruction,
      title,
      is_given: 1,
      is_archived: 0,
      allow_late: 0,
    };

    try {
      const endpoint =
        selectedCategory === "2"
          ? `${API_BASE}/reports/laempl`
          : `${API_BASE}/reports/give`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!res.ok) {
        const errText = await res.text();
        alert("Failed to set report: " + errText);
        return;
      }

      const data = await res.json();
      alert("Report assigned successfully! ID: " + data.report_assignment_id);
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
              <div className="form-row">
                <label>Title:</label>
                <input
                  type="text"
                  placeholder="Enter report title"
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
                    {users
                      .filter((u) => u.role === "teacher") // only teachers
                      .map((u) => (
                        <option key={u.user_id} value={u.user_id}>
                          {u.name}   {/* 👈 this is what will show */}
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

              <div className="form-row-ins textarea-row">
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
