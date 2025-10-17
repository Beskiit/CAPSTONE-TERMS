import React, { useState, useEffect, useRef } from "react";
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarPrincipal.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import "../Teacher/LAEMPLReport.css";
import "./ForApprovalData.css";
import Modal from "react-modal";

const API_BASE = import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com";

// Get submission ID from URL - use multiple methods for reliability
const getSubmissionId = () => {
  // Method 1: URLSearchParams
  const urlParams = new URLSearchParams(window.location.search);
  const idFromParams = urlParams.get("id");
  
  // Method 2: Direct URL parsing
  const urlMatch = window.location.href.match(/[?&]id=(\d+)/);
  const idFromUrl = urlMatch ? urlMatch[1] : null;
  
  // Method 3: Check if we're in a React Router context
  const idFromHash = window.location.hash.match(/[?&]id=(\d+)/);
  const idFromHashMatch = idFromHash ? idFromHash[1] : null;
  
  console.log('URL parsing debug:');
  console.log('- Full URL:', window.location.href);
  console.log('- Search params:', window.location.search);
  console.log('- Hash:', window.location.hash);
  console.log('- ID from URLSearchParams:', idFromParams);
  console.log('- ID from URL regex:', idFromUrl);
  console.log('- ID from hash regex:', idFromHashMatch);
  
  return idFromParams || idFromUrl || idFromHashMatch;
};

const SUBMISSION_ID = getSubmissionId();

const TRAITS = ["Masipag","Matulungin","Masunurin","Magalang","Matapat","Matiyaga"];

const COLS = [
  { key: "m",        label: "M" },
  { key: "f",        label: "F" },
  { key: "gmrc",     label: "GMRC (15 - 25 points)" },
  { key: "math",     label: "Mathematics (15 - 25 points)" },
  { key: "lang",     label: "Language (15 - 25 points)" },
  { key: "read",     label: "Reading and Literacy (15 - 25 points)" },
  { key: "makabasa", label: "MAKABASA (15 - 25 points)" },
];

const COL_RULES = {
  m: [0, 9999],
  f: [0, 9999],
  gmrc: [15, 25],
  math: [15, 25],
  lang: [15, 25],
  read: [15, 25],
  makabasa: [15, 25],
};

const clampVal = (k, v) => {
  if (v === "" || v == null) return "";
  const n = Number(v);
  if (Number.isNaN(n)) return "";
  const [min, max] =
    COL_RULES[k] || [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
  return Math.max(min, Math.min(max, n)).toString();
};

const LOCK_STATUSES = new Set([1]); // e.g., 1=submitted

function ForApprovalData() {
  const [openPopup, setOpenPopup] = useState(false);

  // NEW: reject & approve modal state
  const [isRejectOpen, setIsRejectOpen] = useState(false);            // NEW
  const [rejectReason, setRejectReason] = useState("");               // NEW
  const [reasonErr, setReasonErr] = useState("");                     // NEW
  const [isApproveOpen, setIsApproveOpen] = useState(false);          // NEW

  // NEW: submission data state
  const [submissionData, setSubmissionData] = useState(null);
  const [submissionType, setSubmissionType] = useState(null); // 'LAEMPL' or 'ACCOMPLISHMENT'
  const [submissionLoading, setSubmissionLoading] = useState(true);
  const [submissionError, setSubmissionError] = useState(null);
  const [currentSubmissionId, setCurrentSubmissionId] = useState(SUBMISSION_ID);

  useEffect(() => {
    Modal.setAppElement("#root");
  }, []);

  // Re-check URL parameters on component mount
  useEffect(() => {
    const recheckId = getSubmissionId();
    console.log('Re-checking submission ID on mount:', recheckId);
    if (recheckId && recheckId !== currentSubmissionId) {
      setCurrentSubmissionId(recheckId);
    }
  }, []);

  // NEW: Fetch submission data and determine type
  useEffect(() => {
      const fetchSubmissionData = async () => {
        const submissionId = currentSubmissionId || SUBMISSION_ID;
        console.log('Using submission ID:', submissionId);
        
        if (!submissionId) {
          setSubmissionError("No submission ID provided in the URL. Please go back to the For Approval list and try again.");
          setSubmissionLoading(false);
          return;
        }

      try {
        setSubmissionLoading(true);
        setSubmissionError(null);

        // Try to fetch submission data from multiple endpoints
        let data = null;
        let response = null;
        let lastError = null;

        console.log(`URL: ${window.location.href}`);
        console.log(`URL Search Params: ${window.location.search}`);
        console.log(`Attempting to fetch submission with ID: ${submissionId}`);

        // First try accomplishment endpoint
        try {
          console.log(`Trying accomplishment endpoint: ${API_BASE}/reports/accomplishment/${submissionId}`);
          response = await fetch(`${API_BASE}/reports/accomplishment/${submissionId}`, {
            credentials: "include"
          });
          console.log(`Accomplishment endpoint response status: ${response.status}`);
          
          if (response.ok) {
            data = await response.json();
            setSubmissionType('ACCOMPLISHMENT');
            console.log('Successfully fetched from accomplishment endpoint');
          } else {
            lastError = `Accomplishment endpoint returned ${response.status}`;
          }
        } catch (error) {
          console.log("Accomplishment endpoint failed:", error.message);
          lastError = error.message;
        }

        // If accomplishment endpoint failed, try submissions endpoint
        if (!data) {
          try {
            console.log(`Trying submissions endpoint: ${API_BASE}/submissions/${submissionId}`);
            response = await fetch(`${API_BASE}/submissions/${submissionId}`, {
              credentials: "include"
            });
            console.log(`Submissions endpoint response status: ${response.status}`);
            
            if (response.ok) {
              data = await response.json();
              console.log('Successfully fetched from submissions endpoint');
              
              // Determine submission type based on fields
              const fields = data.fields || {};
              if (fields.type === 'ACCOMPLISHMENT') {
                setSubmissionType('ACCOMPLISHMENT');
              } else if (fields._form || fields._answers) {
                setSubmissionType('LAEMPL');
              } else {
                // Default to LAEMPL for backward compatibility
                setSubmissionType('LAEMPL');
              }
            } else {
              lastError = `Submissions endpoint returned ${response.status}`;
            }
          } catch (error) {
            console.log("Submissions endpoint also failed:", error.message);
            lastError = error.message;
          }
        }

        if (!data) {
          const errorMessage = `Failed to fetch submission with ID ${submissionId}. ${lastError || 'Unknown error'}`;
          console.error(errorMessage);
          throw new Error(errorMessage);
        }

        console.log('Submission data fetched successfully:', data);
        console.log('Fields data:', data.fields);
        console.log('Activity data:', data.fields?.activity);
        setSubmissionData(data);

      } catch (error) {
        console.error("Error fetching submission data:", error);
        setSubmissionError(error.message);
      } finally {
        setSubmissionLoading(false);
      }
    };

    fetchSubmissionData();
  }, [currentSubmissionId]);

  // table state
  const [data, setData] = useState(() =>
    Object.fromEntries(
      TRAITS.map((t) => [t, Object.fromEntries(COLS.map((c) => [c.key, ""]))])
    )
  );

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [status, setStatus] = useState(null);
  const locked = LOCK_STATUSES.has(Number(status));
  const [editOverride, setEditOverride] = useState(false);
  const isDisabled = locked && !editOverride;

  const touchedRef = useRef(false);
  const fileInput = useRef(null);

  const handleChange = (trait, colKey, value) => {
    touchedRef.current = true;
    const cleaned = value.replace(/[^\d.-]/g, "");
    setData((prev) => ({
      ...prev,
      [trait]: { ...prev[trait], [colKey]: clampVal(colKey, cleaned) },
    }));
  };

  const totals = COLS.reduce((acc, c) => {
    acc[c.key] = TRAITS.reduce(
      (sum, t) => sum + (Number(data[t][c.key]) || 0),
      0
    );
    return acc;
  }, {});

  const toRows = (obj) => TRAITS.map((trait) => ({ trait, ...obj[trait] }));

  const canSubmit = !!SUBMISSION_ID && !saving;

  // NOTE: keeping your existing onSubmit (it has API calls).
  // We won't use it for the modals since you asked for front-end only.

  // Prefill from backend (kept as-is from your code)
  useEffect(() => {
    const load = async () => {
      if (!SUBMISSION_ID) return;
      setLoading(true);
      try {
        const tryUrls = [
          `${API_BASE}/submissions/laempl/${SUBMISSION_ID}`,
          `${API_BASE}/submissions/${SUBMISSION_ID}`,
        ];
        let json = null;
        for (const url of tryUrls) {
          const r = await fetch(url, { credentials: "include" });
          if (r.ok) {
            json = await r.json();
            break;
          }
        }

        if (typeof json?.status !== "undefined") setStatus(json.status);

        const rows = json?.fields?.rows;
        if (Array.isArray(rows)) {
          if (touchedRef.current) return;

          const next = Object.fromEntries(
            TRAITS.map((t) => [
              t,
              Object.fromEntries(COLS.map((c) => [c.key, ""])),
            ])
          );
          rows.forEach((r) => {
            if (!r?.trait || !next[r.trait]) return;
            COLS.forEach((c) => {
              next[r.trait][c.key] = (r[c.key] ?? "").toString();
            });
          });
          setData(next);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Export / Template / Import / Clear (kept)
  const toCSV = () => {
    const header = ["Trait", ...COLS.map((c) => c.label)];
    const rows = TRAITS.map((trait) => [
      trait,
      ...COLS.map((c) => data[trait][c.key] || ""),
    ]);
    const totalRow = ["Total", ...COLS.map((c) => totals[c.key])];

    const lines = [header, ...rows, totalRow]
      .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "LAEMPL_Grade1.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateTemplate = () => {
    const header = ["Trait", ...COLS.map((c) => c.label)];
    const blank = TRAITS.map((trait) => [trait, ...COLS.map(() => "")]);
    const csv = [header, ...blank].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "LAEMPL_Template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file) => {
    try {
      const text = await file.text();
      const lines = text
        .trim()
        .split(/\r?\n/)
        .map((l) =>
          l
            .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
            .map((s) => s.replace(/^"|"$/g, "").replace(/""/g, '"'))
        );

      const body = lines.slice(1, 1 + TRAITS.length);
      const next = Object.fromEntries(
        TRAITS.map((t) => [
          t,
          Object.fromEntries(COLS.map((c) => [c.key, ""])),
        ])
      );

      body.forEach((row) => {
        const trait = row[0];
        if (!TRAITS.includes(trait)) return;
        COLS.forEach((c, i) => {
          const raw = row[i + 1] ?? "";
          next[trait][c.key] = clampVal(c.key, raw);
        });
      });

      touchedRef.current = true;
      setEditOverride(true);
      setData(next);
      setMsg("Imported file successfully.");
      setErr("");
      setOpenPopup(false);
    } catch (e) {
      setErr("Failed to import CSV. " + (e?.message || ""));
    }
  };

  const handleClear = () => {
    touchedRef.current = true;
    setEditOverride(true);
    const blank = Object.fromEntries(
      TRAITS.map((t) => [
        t,
        Object.fromEntries(COLS.map((c) => [c.key, ""])),
      ])
    );
    setData(blank);
  };

  const [open, setOpen] = useState(false);
  const [openSec, setOpenSec] = useState(false);

  const [user, setUser] = useState(null);
  const role = (user?.role || "").toLowerCase();
  const isPrincipal = role === "principal";

  // NEW: Component to display accomplishment report data
  const AccomplishmentReportDisplay = ({ submissionData }) => {
    if (!submissionData || !submissionData.fields) {
      return <div>No accomplishment data available</div>;
    }

    const fields = submissionData.fields;
    const activity = fields.activity || {};

    return (
      <div className="accomplishment-display">
        <h3>Accomplishment Report Details</h3>
        
        <div className="report-section">
          <h4>Activity Information</h4>
          <div className="field-group">
            <div className="field">
              <label>Activity Name:</label>
              <span>{activity.activityName || 'Not provided'}</span>
            </div>
            <div className="field">
              <label>Facilitators:</label>
              <span>{activity.facilitators || 'Not provided'}</span>
            </div>
            <div className="field">
              <label>Objectives:</label>
              <span>{activity.objectives || 'Not provided'}</span>
            </div>
            <div className="field">
              <label>Date:</label>
              <span>{activity.date || 'Not provided'}</span>
            </div>
            <div className="field">
              <label>Time:</label>
              <span>{activity.time || 'Not provided'}</span>
            </div>
            <div className="field">
              <label>Venue:</label>
              <span>{activity.venue || 'Not provided'}</span>
            </div>
            <div className="field">
              <label>Key Results:</label>
              <span>{activity.keyResult || 'Not provided'}</span>
            </div>
            <div className="field">
              <label>Persons Involved:</label>
              <span>{activity.personsInvolved || 'Not provided'}</span>
            </div>
            <div className="field">
              <label>Expenses:</label>
              <span>{activity.expenses || 'Not provided'}</span>
            </div>
          </div>
        </div>

        {fields.images && fields.images.length > 0 && (
          <div className="report-section">
            <h4>Images</h4>
            <div className="images-grid">
              {fields.images.map((image, index) => (
                <div key={index} className="image-item">
                  <img 
                    src={`${API_BASE}/uploads/accomplishments/${image}`} 
                    alt={`Activity image ${index + 1}`}
                    style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'cover' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {fields.narrative && (
          <div className="report-section">
            <h4>Narrative</h4>
            <div className="narrative-content">
              {fields.narrative}
            </div>
          </div>
        )}

        {fields.coordinator_notes && (
          <div className="report-section">
            <h4>Coordinator Notes</h4>
            <div className="coordinator-notes">
              {fields.coordinator_notes}
            </div>
          </div>
        )}
      </div>
    );
  };

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

  // NEW: open/close handlers (front-end only)
  const openRejectModal = (e) => {
    e.preventDefault();
    setReasonErr("");
    setRejectReason("");
    setIsRejectOpen(true);
  };
  const closeRejectModal = () => setIsRejectOpen(false);

  const openApproveModal = (e) => {                                    // NEW
    e.preventDefault();
    setIsApproveOpen(true);
  };
  const closeApproveModal = () => setIsApproveOpen(false);             // NEW

  // NEW: modal confirms with API calls
  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      setReasonErr("Please provide a reason.");
      return;
    }

    try {
      setSaving(true);
      
      // Update submission status to rejected (4) using PATCH
      const submissionId = currentSubmissionId || SUBMISSION_ID;
      const endpoint = submissionType === 'ACCOMPLISHMENT' 
        ? `${API_BASE}/reports/accomplishment/${submissionId}`
        : `${API_BASE}/submissions/${submissionId}`;
      
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          status: 4, // Rejected status
          rejection_reason: rejectReason
        })
      });

      if (!response.ok) {
        throw new Error('Failed to reject submission');
      }

      setMsg("Submission rejected successfully.");
      setIsRejectOpen(false);
      setRejectReason("");
      setReasonErr("");
    } catch (error) {
      console.error("Error rejecting submission:", error);
      setErr("Failed to reject submission. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleApproveConfirm = async () => {
    try {
      setSaving(true);
      
      // Update submission status to approved (3) using PATCH
      const submissionId = currentSubmissionId || SUBMISSION_ID;
      const endpoint = submissionType === 'ACCOMPLISHMENT' 
        ? `${API_BASE}/reports/accomplishment/${submissionId}`
        : `${API_BASE}/submissions/${submissionId}`;
      
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          status: 3 // Approved status
        })
      });

      if (!response.ok) {
        throw new Error('Failed to approve submission');
      }

      setMsg("Submission approved successfully.");
      setIsApproveOpen(false);
    } catch (error) {
      console.error("Error approving submission:", error);
      setErr("Failed to approve submission. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        {isPrincipal ? (
          <Sidebar activeLink="LAEMPL" />
        ) : (
          <SidebarCoordinator activeLink="LAEMPL" />
        )}
        <div className="dashboard-content">
          <div className="dashboard-main">
            <h2>
              {submissionType === 'ACCOMPLISHMENT' 
                ? 'Accomplishment Report' 
                : 'LAEMPL - (Teacher\'s Name)'
              }
            </h2>
          </div>

          <div className="content">
            {submissionLoading && <div className="ok-text" style={{ marginTop: 8 }}>Loading submission data...</div>}
            {submissionError && (
              <div className="error-container" style={{ marginTop: 8, padding: '20px', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '4px' }}>
                <div className="error-text" style={{ color: '#721c24', fontWeight: 'bold', marginBottom: '10px' }}>
                  Error: {submissionError}
                </div>
                <div style={{ color: '#721c24', marginBottom: '15px' }}>
                  The submission with ID {currentSubmissionId || SUBMISSION_ID} could not be found. This might be because:
                  <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
                    <li>The submission was deleted or doesn't exist</li>
                    <li>You don't have permission to view this submission</li>
                    <li>The submission ID is incorrect</li>
                  </ul>
                </div>
                <button 
                  onClick={() => window.history.back()} 
                  style={{ 
                    padding: '8px 16px', 
                    backgroundColor: '#007bff', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer' 
                  }}
                >
                  ← Go Back to For Approval
                </button>
              </div>
            )}
            {loading && <div className="ok-text" style={{ marginTop: 8 }}>Loading...</div>}
            {!!msg && <div className="ok-text" style={{ marginTop: 8 }}>{msg}</div>}
            {!!err && <div className="error-text" style={{ marginTop: 8 }}>{err}</div>}

            {submissionType === 'ACCOMPLISHMENT' ? (
              <AccomplishmentReportDisplay submissionData={submissionData} />
            ) : (
              <div className="table-wrap">
                <table className="laempl-table">
                  <caption>Grade 1 - LAEMPL</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="row-head">&nbsp;</th>
                      {COLS.map((col) => (
                        <th key={col.key} scope="col">{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TRAITS.map((trait) => (
                      <tr key={trait}>
                        <th scope="row" className="row-head">{trait}</th>
                        {COLS.map((col) => (
                          <td key={col.key}>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={COL_RULES[col.key]?.[0]}
                              max={COL_RULES[col.key]?.[1]}
                              step="1"
                              value={data[trait][col.key]}
                              onChange={(e) => handleChange(trait, col.key, e.target.value)}
                              className="cell-input"
                              disabled={isDisabled}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}

                    <tr className="total-row">
                      <th scope="row" className="row-head">Total</th>
                      {COLS.map((col) => (
                        <td key={col.key} className="total-cell">{totals[col.key]}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Approve and Reject buttons - only show if no error */}
            {!submissionError && (
              <div className="table-actions">
                <button type="button" onClick={openRejectModal} disabled={saving || submissionLoading}>
                  {saving ? "Processing..." : "Reject"}
                </button>
                <button type="button" onClick={openApproveModal} disabled={saving || submissionLoading}>
                  {saving ? "Processing..." : "Approve"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-sidebar">
          <div className="report-card">
            <h3 className="report-card-header">This is where the name of the report go</h3>
            <p className="report-card-text">Start Date</p>
            <p className="report-card-text">Due Date</p>
          </div>
          <div className="report-card">
            <h3 className="report-card-header">Submission</h3>
            <p className="report-card-text">Submissions: "Number of submission"</p>
            <p className="report-card-text">Max. Attempts: "Number of Maximum Attempts"</p>
            <p className="report-card-text">Allow late submissions: "logiccc"</p>
          </div>
        </div>
      </div>

      {/* Reject Modal (front-end only) */}
      <Modal
        isOpen={isRejectOpen}
        onRequestClose={closeRejectModal}
        contentLabel="Reject with reason"
        className="modal-action"
      >
        <h3 style={{ marginTop: 0 }}>Reject Submission</h3>
        <p style={{ margin: "6px 0 12px" }}>
          Please provide a reason for rejecting this submission.
        </p>

        <form onSubmit={handleRejectSubmit}>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={5}
            placeholder="Type your reason here…"
            style={{
              width: "100%",
              resize: "vertical",
              padding: "10px",
              borderRadius: 8,
              border: "1px solid #ccc",
              outline: "none",
            }}
          />
          {reasonErr && (
            <div style={{ color: "#c0392b", marginTop: 8, fontSize: 14 }}>
              {reasonErr}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
            <button type="button" onClick={closeRejectModal} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Rejecting..." : "Submit Feedback"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Approve Modal (front-end only) */}
      <Modal
        isOpen={isApproveOpen}
        onRequestClose={closeApproveModal}
        contentLabel="Approve confirmation"
        className="modal-action"
      >
        <h3 style={{ marginTop: 0 }}>Approve Submission</h3>
        <p>Are you sure you want to approve this submission?</p>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button type="button" onClick={closeApproveModal} disabled={saving}>
            Cancel
          </button>
          <button type="button" onClick={handleApproveConfirm} disabled={saving}>
            {saving ? "Approving..." : "Yes"}
          </button>
        </div>
      </Modal>
    </>
  );
}

export default ForApprovalData;
