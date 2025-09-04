import React, { useState, useEffect, useMemo } from "react";
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarCoordinator.jsx"; // ✅ single import
import SidebarPrincipal from "../../components/shared/SidebarPrincipal.jsx";
import "./SetReport.css";
import Laempl from "../../assets/templates/LAEMPL.png";
import AccomplishmentReport from "../../assets/templates/accomplishment-report.png";

// Preview mapping (category_id → sub_category_id → image)
const TEMPLATE_MAP = {
  "1": { "10": AccomplishmentReport },
  "2": { "20": Laempl },
};

// --- Sample static data (no API needed) ---
const sampleCategories = [
  { category_id: "1", category_name: "Accomplishment Report" },
  { category_id: "2", category_name: "LAEMPL" },
];

const sampleSubCategories = {
  "1": [{ sub_category_id: "10", sub_category_name: "Default Accomplishment" }],
  "2": [{ sub_category_id: "20", sub_category_name: "Default LAEMPL" }],
};

function SetReport() {
  // ✅ add user state
  const [user, setUser] = useState(null);

  const role = (user?.role || "").toLowerCase();
  const isCoordinator = role === "coordinator";

  const [users, setUsers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [subCategories, setSubCategories] = useState([]);
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [instruction, setInstruction] = useState("");

  // Preview states
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);

  // Resolve preview image URL
  const previewSrc = useMemo(() => {
    if (!selectedCategory || !selectedSubCategory) return "";
    const cat = TEMPLATE_MAP[String(selectedCategory)];
    return cat ? cat[String(selectedSubCategory)] || "" : "";
  }, [selectedCategory, selectedSubCategory]);

  useEffect(() => {
    // Load static sample data
    setCategories(sampleCategories);
    setUsers([
      { user_id: "t1", name: "Mr. Smith" },
      { user_id: "t2", name: "Ms. Johnson" },
    ]);
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      setSubCategories(sampleSubCategories[selectedCategory] || []);
    } else {
      setSubCategories([]);
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (previewSrc) {
      setImgLoading(true);
      setImgError(false);
    } else {
      setImgLoading(false);
      setImgError(false);
    }
  }, [previewSrc]);

  // Close modal on ESC
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") setShowModal(false);
    };
    if (showModal) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showModal]);

  const handleSubmit = (e) => {
    e.preventDefault();
    // optional: console.log current form payload
    // console.log({ selectedCategory, selectedSubCategory, selectedTeacher, startDate, dueDate, instruction });
  };

  useEffect(() => {
      const fetchUser = async () => {
        try {
          const res = await fetch("http://localhost:5000/auth/me", {
            credentials: "include", // important so session cookie is sent
          });
          if (!res.ok) return; // not logged in
          const data = await res.json();
          setUser(data);
        } catch (err) {
          console.error("Failed to fetch user:", err);
        }
      };
      fetchUser();
    }, []);
    

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
                <input type="text" placeholder="Enter report title" />
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
                <select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)}>
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
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>

              <div className="form-row-ins textarea-row">
                <label>Instructions:</label>
                <textarea
                  placeholder="Enter instructions for the report"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                ></textarea>
              </div>

              {selectedCategory && selectedSubCategory && (
                <div className="template-preview-panel">
                  <div className="template-preview-header">
                    <span>Template Preview</span>
                    <small>{previewSrc ? "Click the image to enlarge" : "No preview available"}</small>
                  </div>

                  <div className="template-preview-body">
                    {!previewSrc && (
                      <div className="template-preview-empty">No preview for this selection.</div>
                    )}

                    {previewSrc && (
                      <>
                        {imgLoading && <div className="template-skeleton" />}
                        <img
                          key={previewSrc}
                          src={previewSrc}
                          alt="Template preview"
                          onClick={() => setShowModal(true)}
                          onLoad={() => setImgLoading(false)}
                          onError={() => {
                            setImgLoading(false);
                            setImgError(true);
                          }}
                          className={imgLoading ? "hidden" : "clickable-preview"}
                        />
                        {imgError && (
                          <div className="template-preview-error">
                            Couldn’t load the image. Check the path: <code>{previewSrc}</code>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button type="submit">Set Schedule</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ===== Image Modal (Lightbox) ===== */}
      {showModal && previewSrc && (
        <div
          className="image-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Template full view"
          onClick={() => setShowModal(false)}
        >
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <img src={previewSrc} alt="Template full view" />
            <button className="close-modal" onClick={() => setShowModal(false)} aria-label="Close">
              ×
            </button>
          </div>
        </div>
      )}
      {/* ===== End Modal ===== */}
    </>
  );
}

export default SetReport;
