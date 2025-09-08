import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import "./AccomplishmentReport.css";

// Always strip trailing slash on base, then build our own paths.
const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:5000").replace(/\/$/, "");
const BASE = `${API_BASE}/reports/accomplishment`; // <-- matches your Postman endpoint

function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images.map((img) => {
    if (typeof img === "string") {
      // If backend returns "uploads/accomplishments/123-file.jpg", make it absolute
      const isAbsolute = /^https?:\/\//i.test(img);
      const url = isAbsolute ? img : `${API_BASE}/${img.replace(/^\/+/, "")}`;
      return { url, filename: img.split("/").pop() || img };
    }
    const raw = img.url || img.path || img.src || "";
    const isAbsolute = /^https?:\/\//i.test(raw);
    const url = isAbsolute ? raw : (raw ? `${API_BASE}/${raw.replace(/^\/+/, "")}` : "");
    const filename = img.filename || (raw ? raw.split("/").pop() : "");
    return { url, filename };
  });
}

function AccomplishmentReport() {
  const [openPopup, setOpenPopup] = useState(false);
  const navigate = useNavigate();

  // --- Determine submission id from route or query (fallback to 17) ---
  const { id: idFromRoute } = useParams();
  const [sp] = useSearchParams();
  const idFromQuery = sp.get("id");
  const submissionId = useMemo(
    () => idFromRoute || idFromQuery || "18",
    [idFromRoute, idFromQuery]
  );

  // --- Auth / role ---
  const [user, setUser] = useState(null);
  const role = (user?.role || "").toLowerCase();
  const isTeacher = role === "teacher";
  const [loadingUser, setLoadingUser] = useState(true);

  // --- Form state (shared) ---
  const [narrative, setNarrative] = useState("");

  // Teacher/Coordinator uploads
  const [existingImages, setExistingImages] = useState([]); // {url, filename}[]
  const [newFiles, setNewFiles] = useState([]); // File[]

  // Coordinator-only fields (not required for save here)
  const [activity, setActivity] = useState({
    activityName: "",
    facilitators: "",
    objectives: "",
    date: "",
    time: "",
    venue: "",
    keyResult: "",
    personsInvolved: "",
    expenses: "",
  });

  // UI
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // --- Load user for role guard ---
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error("Failed to fetch user:", err);
      } finally {
        setLoadingUser(false);
      }
    })();
  }, []);

  // --- Load submission data ---
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setError("");
        setSuccess("");

        const res = await fetch(`${BASE}/${submissionId}`, { credentials: "include" });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`GET ${submissionId} failed: ${res.status} ${text}`);
        }
        const data = await res.json();

        // Narrative can be at top-level or inside fields.*
        const n =
          data?.narrative ??
          data?.fields?.narrative ??
          data?.fields?.text ??
          "";

        const imgs =
          data?.images ??
          data?.fields?.images ??
          data?.fields?.photos ??
          [];

        if (!alive) return;
        setNarrative(String(n || ""));
        setExistingImages(normalizeImages(imgs));

        // Prefill coordinator fields if your API returns them under fields.*
        setActivity((prev) => ({
          ...prev,
          activityName: data?.fields?.activityName || "",
          facilitators: data?.fields?.facilitators || "",
          objectives: data?.fields?.objectives || "",
          date: data?.fields?.date || "",
          time: data?.fields?.time || "",
          venue: data?.fields?.venue || "",
          keyResult: data?.fields?.keyResult || "",
          personsInvolved: data?.fields?.personsInvolved || "",
          expenses: data?.fields?.expenses || "",
        }));
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load submission");
      }
    })();
    return () => {
      alive = false;
    };
  }, [submissionId]);

  // --- Handlers ---
  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    setNewFiles((prev) => prev.concat(files));
    e.target.value = "";
  };

  const removeNewFileAt = (idx) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const fd = new FormData();
      fd.append("narrative", narrative);
      for (const f of newFiles) fd.append("images", f); // matches multer.array("images")

      const res = await fetch(`${BASE}/${submissionId}`, {
        method: "PATCH",
        body: fd,
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`PATCH ${submissionId} failed: ${res.status} ${text}`);
      }

      // optimistic: show newly added files as previews
      if (newFiles.length) {
        const appended = newFiles.map((f) => ({
          url: URL.createObjectURL(f),
          filename: f.name,
        }));
        setExistingImages((prev) => prev.concat(appended));
        setNewFiles([]);
      }

      setSuccess("Saved!");
    } catch (e2) {
      setError(e2.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Optional hooks
  const onGenerate = () => {
    alert("Generate Report: hook this to your generator when ready.");
  };
  const onExport = () => {
    alert("Export: hook this to your export endpoint when ready.");
  };
  const onSubmitFinal = () => onSubmit(); // reuse for now

  if (loadingUser) {
    return (
      <div className="dashboard-content">
        <div className="dashboard-main">
          <h2>Accomplishment Report</h2>
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        {isTeacher ? (
          <Sidebar activeLink="Accomplishment Report" />
        ) : (
          <SidebarCoordinator activeLink="Accomplishment Report" />
        )}

        <div className="dashboard-content">
          <div className="dashboard-main">
            <h2>Accomplishment Report</h2>
            <p style={{ opacity: 0.7, marginTop: 4 }}>Submission ID: {submissionId}</p>
          </div>

          <div className="content">
            {isTeacher ? (
              <>
            <div className="buttons">
              <button onClick={onGenerate}>Generate Report</button>

              {!isTeacher && (
                <button onClick={() => setOpenPopup(true)}>Upload Images</button>
              )}
              {openPopup && (
                <div className="modal-overlay">
                  <div className="import-popup">
                    <div className="popup-header">
                      <h2>Import File</h2>
                      <button
                        className="close-button"
                        onClick={() => setOpenPopup(false)}
                      >
                        X
                      </button>
                    </div>
                    <hr />
                    <form className="import-form" onSubmit={(e) => e.preventDefault()}>
                      <label htmlFor="fileInput" className="file-upload-label">
                        Click here to upload a file
                      </label>
                      <input
                        id="fileInput"
                        type="file"
                        multiple
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handleFiles}
                      />
                      <button type="submit">Upload</button>
                    </form>
                  </div>
                </div>
              )}

              <button onClick={onExport}>Export</button>
              <button onClick={onSubmitFinal} disabled={saving}>
                {saving ? "Saving…" : "Submit"}
              </button>
            </div>
            </>
            ):
            (
              <>
                <div className="buttons">
                  <button onClick={onGenerate}>Generate Report</button>
                  {openPopup && (
                    <div className="modal-overlay">
                      <div className="import-popup">
                        <div className="popup-header">
                          <h2>Import File</h2>
                          <button
                            className="close-button"
                            onClick={() => setOpenPopup(false)}
                          >
                            X
                          </button>
                        </div>
                        <hr />
                        <form className="import-form" onSubmit={(e) => e.preventDefault()}>
                          <label htmlFor="fileInput" className="file-upload-label">
                            Click here to upload a file
                          </label>
                          <input
                            id="fileInput"
                            type="file"
                            multiple
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={handleFiles}
                          />
                          <button type="submit">Upload</button>
                        </form>
                      </div>
                    </div>
                  )}

                  <button onClick={onExport}>Export</button>
                  <button onClick={onSubmitFinal} disabled={saving}>
                    {saving ? "Saving…" : "Submit"}
                  </button>
                  <button>Consolidate</button>
                </div>
              </>
            )
          }

            <div className="accomplishment-report-container">
              <h3>Activity Completion Report</h3>

              {/* Alerts */}
              {error && <div className="alert error" style={{ marginBottom: 12 }}>{error}</div>}
              {success && <div className="alert success" style={{ marginBottom: 12 }}>{success}</div>}

              <form onSubmit={onSubmit}>
                {isTeacher ? (
                  <>
                    {/* TEACHER VIEW */}
                    <div className="form-row">
                      <label htmlFor="teacherPictures">Upload Image(s):</label>
                      <input
                        type="file"
                        id="teacherPictures"
                        name="teacherPictures"
                        accept="image/*"
                        multiple
                        onChange={handleFiles}
                      />
                    </div>

                    {(existingImages.length > 0 || newFiles.length > 0) && (
                      <div className="thumbs">
                        {existingImages.map((img) => (
                          <div key={img.url + img.filename} className="thumb">
                            <img src={img.url} alt={img.filename} />
                            <div className="thumb-meta">
                              <span className="filename" title={img.filename}>
                                {img.filename}
                              </span>
                            </div>
                          </div>
                        ))}
                        {newFiles.map((f, i) => (
                          <div key={`new-${i}`} className="thumb">
                            <img src={URL.createObjectURL(f)} alt={f.name} />
                            <div className="thumb-meta">
                              <span className="filename" title={f.name}>
                                {f.name}
                              </span>
                              <button
                                type="button"
                                className="btn tiny"
                                onClick={() => removeNewFileAt(i)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="form-row">
                      <label htmlFor="teacherNarrative">Narrative:</label>
                      <textarea
                        id="teacherNarrative"
                        name="teacherNarrative"
                        rows="6"
                        value={narrative}
                        onChange={(e) => setNarrative(e.target.value)}
                        required
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* COORDINATOR VIEW */}
                    <div className="form-row">
                      <label htmlFor="activityName">Program/Activity Title:</label>
                      <input
                        type="text"
                        id="activityName"
                        name="activityName"
                        value={activity.activityName}
                        onChange={(e) => setActivity((p) => ({ ...p, activityName: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="form-row">
                      <label htmlFor="facilitators">Facilitator/s:</label>
                      <input
                        type="text"
                        id="facilitators"
                        name="facilitators"
                        value={activity.facilitators}
                        onChange={(e) => setActivity((p) => ({ ...p, facilitators: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="form-row">
                      <label htmlFor="objectives">Objectives:</label>
                      <input
                        type="text"
                        id="objectives"
                        name="objectives"
                        value={activity.objectives}
                        onChange={(e) => setActivity((p) => ({ ...p, objectives: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="form-row">
                      <label>Program/Activity Design:</label>
                      <div className="inner-form-row">
                        <div className="form-row">
                          <label htmlFor="date">Date:</label>
                          <input
                            type="date"
                            id="date"
                            name="date"
                            value={activity.date}
                            onChange={(e) => setActivity((p) => ({ ...p, date: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="form-row">
                          <label htmlFor="time">Time:</label>
                          <input
                            type="text"
                            id="time"
                            name="time"
                            value={activity.time}
                            onChange={(e) => setActivity((p) => ({ ...p, time: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="form-row">
                          <label htmlFor="venue">Venue:</label>
                          <input
                            type="text"
                            id="venue"
                            name="venue"
                            value={activity.venue}
                            onChange={(e) => setActivity((p) => ({ ...p, venue: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="form-row">
                          <label htmlFor="keyResult">Key Results:</label>
                          <input
                            type="text"
                            id="keyResult"
                            name="keyResult"
                            value={activity.keyResult}
                            onChange={(e) => setActivity((p) => ({ ...p, keyResult: e.target.value }))}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-row">
                      <label htmlFor="personsInvolved">Person/s Involved</label>
                      <input
                        type="text"
                        id="personsInvolved"
                        name="personsInvolved"
                        value={activity.personsInvolved}
                        onChange={(e) => setActivity((p) => ({ ...p, personsInvolved: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="form-row">
                      <label htmlFor="expenses">Expenses:</label>
                      <input
                        type="text"
                        id="expenses"
                        name="expenses"
                        value={activity.expenses}
                        onChange={(e) => setActivity((p) => ({ ...p, expenses: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="form-row">
                      <label htmlFor="coordPictures">Picture/s:</label>
                      <input
                        type="file"
                        id="coordPictures"
                        name="coordPictures"
                        accept="image/*"
                        multiple
                        onChange={handleFiles}
                      />
                    </div>

                    {(existingImages.length > 0 || newFiles.length > 0) && (
                      <div className="thumbs">
                        {existingImages.map((img) => (
                          <div key={img.url + img.filename} className="thumb">
                            <img src={img.url} alt={img.filename} />
                            <div className="thumb-meta">
                              <span className="filename" title={img.filename}>
                                {img.filename}
                              </span>
                            </div>
                          </div>
                        ))}
                        {newFiles.map((f, i) => (
                          <div key={`new-${i}`} className="thumb">
                            <img src={URL.createObjectURL(f)} alt={f.name} />
                            <div className="thumb-meta">
                              <span className="filename" title={f.name}>
                                {f.name}
                              </span>
                              <button
                                type="button"
                                className="btn tiny"
                                onClick={() => removeNewFileAt(i)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="form-row">
                      <label htmlFor="narrative">Narrative:</label>
                      <textarea
                        id="narrative"
                        name="narrative"
                        rows="6"
                        value={narrative}
                        onChange={(e) => setNarrative(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-row">
                      <button className="btn primary" disabled={saving}>
                        {saving ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                  </>
                )}

                {isTeacher && (
                  <div className="form-row">
                    <button className="btn primary" disabled={saving}>
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default AccomplishmentReport;
