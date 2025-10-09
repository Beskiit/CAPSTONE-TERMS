import React, { useState, useEffect, useRef } from "react";
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarPrincipal.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import "../Teacher/LAEMPLReport.css";
import Modal from "react-modal";

const API_BASE = import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com";

const SUBMISSION_ID =
  new URLSearchParams(window.location.search).get("id") || "10";

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

  useEffect(() => {
    Modal.setAppElement("#root");
  }, []);

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

  // NEW: modal confirms (no API)
  const handleRejectSubmit = (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      setReasonErr("Please provide a reason.");
      return;
    }
    setMsg("Submission rejected (local state only).");
    setIsRejectOpen(false);
  };

  const handleApproveConfirm = () => {                                  // NEW
    setMsg("Submission approved (local state only).");
    setIsApproveOpen(false);
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
            <h2>LAEMPL - (Teacher's Name)</h2>
          </div>

          <div className="content">
            {loading && <div className="ok-text" style={{ marginTop: 8 }}>Loading...</div>}
            {!!msg && <div className="ok-text" style={{ marginTop: 8 }}>{msg}</div>}
            {!!err && <div className="error-text" style={{ marginTop: 8 }}>{err}</div>}

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

            {/* Approve and Reject buttons */}
            <div className="table-actions">
              <button type="button" onClick={openRejectModal}>Reject</button>
            <button type="button" onClick={openApproveModal}>Approve</button>
            </div>
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
            <button type="button" onClick={closeRejectModal}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              Submit Feedback
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
          <button type="button" onClick={closeApproveModal}>
            Cancel
          </button>
          <button type="button" onClick={handleApproveConfirm}>
            Yes
          </button>
        </div>
      </Modal>
    </>
  );
}

export default ForApprovalData;
