import React, { useState, useEffect, useRef } from "react";
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import "./LAEMPLReport.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

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

// min/max rules for validation + clamping
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

// statuses that lock the UI (adjust as needed)
const LOCK_STATUSES = new Set([1]); // e.g., 1=submitted, add 2 if approved should also lock

function LAEMPLReport() {
  const [openPopup, setOpenPopup] = useState(false);

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

  // backend status -> compute locked
  const [status, setStatus] = useState(null);
  const locked = LOCK_STATUSES.has(Number(status));

  // FRONT-END override: allow editing after Clear/Import even if locked
  const [editOverride, setEditOverride] = useState(false);

  // single flag to disable inputs/actions
  const isDisabled = locked && !editOverride;

  // prevent late hydration from overwriting local edits/clears
  const touchedRef = useRef(false);

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

  const onSubmit = async () => {
    if (!SUBMISSION_ID) {
      setErr(
        "Missing submission id. Open this page with ?id=<submission_id> from the assignment link."
      );
      return;
    }
    if (isDisabled) {
      setErr("This submission is locked and cannot be changed.");
      return;
    }

    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const payload = {
        status: 1, // adjust to your "submitted" status id
        grade: 1,  // update if you drive this from UI
        rows: toRows(data),
      };
      const res = await fetch(
        `${API_BASE}/submissions/laempl/${SUBMISSION_ID}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setMsg("Saved successfully.");

      // reflect server-side status if provided
      if (typeof json?.status !== "undefined") setStatus(json.status);

      // optional rehydrate to reflect server-side clamping/merges
      if (json?.fields?.rows) {
        const next = Object.fromEntries(
          TRAITS.map((t) => [
            t,
            Object.fromEntries(COLS.map((c) => [c.key, ""])),
          ])
        );
        json.fields.rows.forEach((r) => {
          if (!r?.trait || !next[r.trait]) return;
          COLS.forEach((c) => {
            next[r.trait][c.key] = (r[c.key] ?? "").toString();
          });
        });
        setData(next);
      }

      // RE-LOCK after successful submit/save
      setEditOverride(false);
    } catch (e) {
      setErr(e.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  // Prefill from backend
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
          // don't overwrite if user already edited/cleared/imported
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

  // Export CSV
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

  // Generate blank template CSV
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

  // Import CSV (must match export shape)
  const onImport = async (file) => {
    try {
      const text = await file.text();
      const lines = text
        .trim()
        .split(/\r?\n/)
        .map((l) =>
          // split by commas outside quotes
          l
            .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
            .map((s) => s.replace(/^"|"$/g, "").replace(/""/g, '"'))
        );

      const body = lines.slice(1, 1 + TRAITS.length); // header + rows
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

      touchedRef.current = true; // user-intended change
      setEditOverride(true);     // allow editing even if locked
      setData(next);
      setMsg("Imported file successfully.");
      setErr("");
    } catch (e) {
      setErr("Failed to import CSV. " + (e?.message || ""));
    }
  };

  // CLEAR TABLE — also enable edit override
  const handleClear = () => {
    touchedRef.current = true; // prevent late hydration overwrite
    setEditOverride(true);     // unlock locally
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
  const isTeacher = role === "teacher";

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

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        {isTeacher ? (
          <Sidebar activeLink="LAEMPL" />
        ) : (
          <SidebarCoordinator activeLink="LAEMPL" />
        )}
        <div className="dashboard-content">
          <div className="dashboard-main">
            <h2>LAEMPL</h2>
          </div>

          <div className="content">
            <div className="buttons">
              <button onClick={handleGenerateTemplate}>Generate Template</button>

              {/* Import (disabled if locked without override) */}
              <button onClick={() => setOpenPopup(true)} disabled={isDisabled}>
                Import File
              </button>
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
                    <form
                      className="import-form"
                      onSubmit={(e) => e.preventDefault()}
                    >
                      <label htmlFor="fileInput" className="file-upload-label">
                        Click here to upload a file
                      </label>
                      <input
                        id="fileInput"
                        type="file"
                        accept=".csv"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onImport(f);
                        }}
                      />
                      <button type="submit">Upload</button>
                    </form>
                  </div>
                </div>
              )}

              {/* Export */}
              <button onClick={toCSV}>Export</button>
              {/* Clear */}
              <button onClick={handleClear}>Clear Table</button>
            </div>

            {/* Drop down for qtr and section*/}
            <div className="dropdown-container">
              <div className="dropdown">
                <button
                  className="dropdown-btn"
                  onClick={() => setOpen(!open)}
                >
                  Select Quarter {open ? "▲" : "▼"}
                </button>

                {open && (
                  <div className="dropdown-content">
                    <button>1st Quarter</button>
                    <button>2nd Quarter</button>
                    <button>3rd Quarter</button>
                    <button>4th Quarter</button>
                  </div>
                )}
              </div>

              <div className="dropdown">
                <button
                  className="dropdown-btn"
                  onClick={() => setOpenSec(!openSec)}
                >
                  Select Section {openSec ? "▲" : "▼"}
                </button>

                {openSec && (
                  <div className="dropdown-content">
                    <button>Masipag</button>
                    <button>Matulungin</button>
                    <button>Masunurin</button>
                    <button>Magalang</button>
                    <button>Matapat</button>
                    <button>Matiyaga</button>
                  </div>
                )}
              </div>
            </div>

            {/* status messages */}
            {loading && (
              <div className="ok-text" style={{ marginTop: 8 }}>
                Loading...
              </div>
            )}
            {!!msg && (
              <div className="ok-text" style={{ marginTop: 8 }}>
                {msg}
              </div>
            )}
            {!!err && (
              <div className="error-text" style={{ marginTop: 8 }}>
                {err}
              </div>
            )}

            {/* DYNAMIC TABLE */}
            <div className="table-wrap">
              <table className="laempl-table">
                <caption>Grade 1 - LAEMPL</caption>
                <thead>
                  <tr>
                    <th scope="col" className="row-head">
                      &nbsp;
                    </th>
                    {COLS.map((col) => (
                      <th key={col.key} scope="col">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TRAITS.map((trait) => (
                    <tr key={trait}>
                      <th scope="row" className="row-head">
                        {trait}
                      </th>
                      {COLS.map((col) => (
                        <td key={col.key}>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={COL_RULES[col.key]?.[0]}
                            max={COL_RULES[col.key]?.[1]}
                            step="1"
                            value={data[trait][col.key]}
                            onChange={(e) =>
                              handleChange(trait, col.key, e.target.value)
                            }
                            className="cell-input"
                            disabled={isDisabled}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}

                  <tr className="total-row">
                    <th scope="row" className="row-head">
                      Total
                    </th>
                    {COLS.map((col) => (
                      <td key={col.key} className="total-cell">
                        {totals[col.key]}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Submit button */}
            <div className="table-actions">
              <button
                type="submit"
                onClick={onSubmit}
                disabled={!canSubmit || isDisabled}
              >
                {saving ? "Saving..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
        <div className="dashboard-sidebar">
          <div className="report-card">
            <h3 className="report-card-header">
              This is where the name of the report go
            </h3>
            <p className="report-card-text">Start Date</p>
            <p className="report-card-text">Due Date</p>
          </div>
          <div className="report-card">
            <h3 className="report-card-header">Submission</h3>
            <p className="report-card-text">
              Submissions: "Number of submission"
            </p>
            <p className="report-card-text">
              Max. Attempts: "Number of Maximum Attempts"
            </p>
            <p className="report-card-text">
              Allow late submissions: "logiccc"
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default LAEMPLReport;
