import "./ViewReports.css";
import React, { useState, useEffect } from "react";
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import axios from "axios";

function ViewReports() {
  const [user, setUser] = useState(null);
  const [openPopup, setOpenPopup] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [instruction, setInstruction] = useState("");

  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");

  // ✅ define & populate users so users.map() doesn't crash
  const [users, setUsers] = useState([]);

  const defaultGivenBy = 5;
  const defaultQuarter = 1;
  const defaultYear = 1;

  // Fetch current user once
  useEffect(() => {
    (async () => {
      try {
        const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }
    })();
  }, []);

  // Fetch categories once
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get("https://terms-api.kiri8tives.com/categories");
        setCategories(data);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    })();
  }, []);

  // Fetch subcategories when category changes
  useEffect(() => {
    (async () => {
      if (!selectedCategory) return setSubCategories([]);
      try {
        const { data } = await axios.get(
          `https://terms-api.kiri8tives.com/subcategories/${selectedCategory}`
        );
        setSubCategories(data);
      } catch (error) {
        console.error("Error fetching sub-categories:", error);
      }
    })();
  }, [selectedCategory]);

  // ✅ stub/fetch teachers (replace with your real endpoint if you have one)
  useEffect(() => {
    // Example static list; swap for axios.get('/teachers') if you have it
    setUsers([
      { user_id: "t1", name: "Mr. Smith" },
      { user_id: "t2", name: "Ms. Johnson" },
    ]);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCategory || !selectedSubCategory || !startDate || !dueDate) {
      alert("Please fill in all required fields.");
      return;
    }
    try {
      await axios.post("https://terms-api.kiri8tives.com/reports", {
        category_id: selectedCategory,
        given_by: defaultGivenBy,
        quarter: defaultQuarter,
        year: defaultYear,
        from_date: startDate,
        to_date: dueDate,
        instruction,
        is_given: 1,
        is_archived: 0,
        allow_late: 0,
        // optionally include selectedTeacher if your API expects it
        // assigned_to: selectedTeacher,
      });
      alert("Report schedule set successfully!");
      setOpenPopup(false);
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("Failed to set report schedule.");
    }
  };

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        <Sidebar activeLink="View Reports" />
        <div className="dashboard-content">
          <div className="dashboard-main">
            <h2>View Reports</h2>

            <div className="report-schedule">
              <button className="report-button" onClick={() => setOpenPopup(true)}>
                + Set Report Schedule
              </button>
            </div>

            <div className="set-report-schedule-container">
              <div
                className="set-report-schedule popup"
                style={{ display: openPopup ? "block" : "none" }}
              >
                <div className="popup-header">
                  <h2>Set Report Schedule</h2>
                  <button className="close-button" onClick={() => setOpenPopup(false)}>
                    X
                  </button>
                </div>
                <hr />

                <form className="schedule-form" onSubmit={handleSubmit}>
                  <div className="form-row">
                    <label>Title:</label>
                    <input type="text" placeholder="Enter report title" disabled />
                  </div>

                  <div className="form-row">
                    <label>Category:</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                      <option value="">Select Category</option>
                      {categories.map((c) => (
                        <option key={c.category_id} value={c.category_id}>
                          {c.category_name}
                        </option>
                      ))}
                    </select>

                    <label>Select Teacher:</label>
                    <select
                      value={selectedTeacher}
                      onChange={(e) => setSelectedTeacher(e.target.value)}
                    >
                      <option value="">Select Teacher</option>
                      {users.map((t) => (
                        <option key={t.user_id} value={t.user_id}>
                          {t.name}
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
                    />
                  </div>

                  <div className="form-actions">
                    <button type="submit">Set Schedule</button>
                  </div>
                </form>
              </div>
            </div>
            {/* end popup */}
          </div>
        </div>
      </div>
    </>
  );
}

export default ViewReports;
