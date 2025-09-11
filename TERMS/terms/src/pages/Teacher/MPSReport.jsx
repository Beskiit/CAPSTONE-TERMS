import React, { useState, useEffect, useRef } from "react";
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import "./LAEMPLReport.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const SUBMISSION_ID = 12; // hardcoded

const TRAITS = ["Masipag","Matulungin","Masunurin","Magalang","Matapat","Matiyaga"];

const COLS = [
  { key: "m",      label: "Male" },
  { key: "f",      label: "Female" },
  { key: "total",  label: "Total no. of Pupils" },
  { key: "mean",   label: "Mean" },
  { key: "median", label: "Median" },
  { key: "pl",     label: "PL" },
  { key: "mps",    label: "MPS" },
  { key: "sd",     label: "SD" },
  { key: "target", label: "Target" },
  { key: "hs",     label: "HS" },
  { key: "ls",     label: "LS" },
];

// statuses that lock the UI
const LOCK_STATUSES = new Set([1]); // add 2 if "approved" should also lock

function MPSReport() {
  const [openPopup, setOpenPopup] = useState(false);

  const [data, setData] = useState(() =>
    Object.fromEntries(
      TRAITS.map(t => [t, Object.fromEntries(COLS.map(c => [c.key, ""]))])
    )
  );

  // tracks whether the user already edited or cleared the form
  const touchedRef = useRef(false);

  // backend status + lock
  const [status, setStatus] = useState(null);
  const locked = LOCK_STATUSES.has(Number(status));

  // FRONT-END override: allow editing after Clear
  const [editOverride, setEditOverride] = useState(false);

  // single disabled flag for inputs/actions
  const isDisabled = locked && !editOverride;

  const handleChange = (trait, colKey, value) => {
    touchedRef.current = true;
    setData(prev => ({
      ...prev,
      [trait]: { ...prev[trait], [colKey]: value.replace(/[^\d.-]/g, "") },
    }));
  };

  const totals = COLS.reduce((acc, c) => {
    acc[c.key] = TRAITS.reduce(
      (sum, t) => sum + (Number(data[t][c.key]) || 0),
      0
    );
    return acc;
  }, {});

  const [open, setOpen] = useState(false);
  const [openSec, setOpenSec] = useState(false);

  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
        if (!res.ok) return;
        const u = await res.json();
        setUser(u);
      } catch {}
    })();
  }, []);

  // load current submission to get status and hydrate fields (if present)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/mps/submissions/${SUBMISSION_ID}`, {
          credentials: "include",
        });
        if (!r.ok) return;
        const json = await r.json();

        if (typeof json?.status !== "undefined") setStatus(json.status);

        const rows = json?.fields?.rows;
        if (Array.isArray(rows)) {
          // if user already edited/cleared, don't overwrite their changes
          if (touchedRef.current) return;

          const next = Object.fromEntries(
            TRAITS.map(t => [t, Object.fromEntries(COLS.map(c => [c.key, ""]))])
          );
          rows.forEach(rw => {
            if (!rw?.trait || !next[rw.trait]) return;
            COLS.forEach(c => {
              next[rw.trait][c.key] = (rw[c.key] ?? "").toString();
            });
          });
          setData(next);
        }
      } catch {}
    })();
  }, []);

  // ---- serialize payload helpers
  const toRows = () =>
    TRAITS.map(trait => {
      const row = { trait };
      COLS.forEach(col => {
        const v = data[trait][col.key];
        row[col.key] = (v === "" || v == null) ? null : Number(v);
      });
      return row;
    });

  const toTotals = () =>
    Object.fromEntries(COLS.map(col => [col.key, Number(totals[col.key] || 0)]));

  // ---- save/submit (status handled server-side; this just sends fields)
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
// under: const [saveMsg, setSaveMsg] = useState(null);
const [importing, setImporting] = useState(false);
const [importMsg, setImportMsg] = useState(null);
const fileInputRef = useRef(null);

// tiny CSV parser that handles quotes and commas
function csvToRows(text) {
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { cell += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cell += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(cell); cell = ""; }
      else if (c === '\r') { /* ignore */ }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ""; }
      else { cell += c; }
    }
  }
  // flush last cell/row
  if (cell.length > 0 || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// map header labels to column keys
const LABEL_TO_KEY = Object.fromEntries(COLS.map(c => [c.label.toLowerCase(), c.key]));

// takes CSV text, returns { nextData, importedCount }
function parseMPSCsv(text) {
  const rows = csvToRows(text).filter(r => r.some(v => String(v).trim() !== ""));
  if (!rows.length) throw new Error("CSV is empty.");

  // expect first header cell to be "Trait"
  const header = rows[0].map(h => String(h || "").trim());
  const traitIdx = header.findIndex(h => h.toLowerCase() === "trait");
  if (traitIdx === -1) throw new Error('Header must include "Trait".');

  // build column index map (by label)
  const colIndexByKey = {};
  header.forEach((h, i) => {
    const key = LABEL_TO_KEY[h.toLowerCase()];
    if (key) colIndexByKey[key] = i;
  });

  // at least one known column needed
  const knownCols = Object.keys(colIndexByKey);
  if (!knownCols.length) throw new Error("No known columns found in header.");

  // start from a blank sheet
  const next = Object.fromEntries(
    TRAITS.map(t => [t, Object.fromEntries(COLS.map(c => [c.key, ""]))])
  );

  let imported = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const firstCell = String(row[traitIdx] || "").trim();
    if (!firstCell) continue;
    if (firstCell.toLowerCase() === "total") break; // ignore totals row
    if (!TRAITS.includes(firstCell)) continue;      // ignore unknown trait rows

    knownCols.forEach(key => {
      const idx = colIndexByKey[key];
      const raw = row[idx] ?? "";
      const val = String(raw).trim();
      // keep blank as "", numeric strings cleaned; UI already strips non-numeric
      next[firstCell][key] = val;
    });
    imported++;
  }

  return { nextData: next, importedCount: imported };
}

async function importFromFile(file) {
  if (!file) throw new Error("No file selected.");
  if (!/\.csv$/i.test(file.name)) {
    throw new Error("Please upload a .csv file.");
  }
  const text = await file.text();
  return parseMPSCsv(text);
}

  const submitMPS = async () => {
    if (isDisabled) {
      setSaveMsg("This submission is locked and cannot be changed.");
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const body = { rows: toRows(), totals: toTotals() };
      const res = await fetch(`${API_BASE}/mps/submissions/${SUBMISSION_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setSaveMsg("Saved successfully.");

      // if server returns updated status after save/submit, reflect it
      if (typeof json?.status !== "undefined") setStatus(json.status);

      // RE-LOCK after successful save/submit
      setEditOverride(false);
    } catch (err) {
      setSaveMsg(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ---- EXPORT: CSV
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const toCSV = () => {
    const esc = (val) => {
      const s = (val ?? "").toString();
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const header = ["Trait", ...COLS.map(c => c.label)];
    const rows = TRAITS.map(trait => [
      trait,
      ...COLS.map(c => data[trait][c.key] === "" ? "" : data[trait][c.key])
    ]);
    const totalRow = ["Total", ...COLS.map(c => totals[c.key])];

    const lines = [header, ...rows, totalRow].map(r => r.map(esc).join(",")).join("\n");
    return lines;
  };

  const handleExport = () => {
    const csv = toCSV();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const ts = new Date();
    const pad = (n)=>String(n).padStart(2,"0");
    const fname = `MPS_Grade1_${ts.getFullYear()}-${pad(ts.getMonth()+1)}-${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.csv`;
    downloadBlob(blob, fname);
  };

  // blank template export
  const handleGenerateTemplate = () => {
    const blank = Object.fromEntries(
      TRAITS.map(t => [t, Object.fromEntries(COLS.map(c => [c.key, ""]))])
    );
    const header = ["Trait", ...COLS.map(c => c.label)];
    const rows = TRAITS.map(trait => [trait, ...COLS.map(c => blank[trait][c.key])]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, "MPS_Template.csv");
  };

  // CLEAR TABLE — also enable edit override
  const handleClear = () => {
    touchedRef.current = true;     // prevent late hydration overwrites
    setEditOverride(true);         // allow editing even if locked
    const blank = Object.fromEntries(
      TRAITS.map(t => [t, Object.fromEntries(COLS.map(c => [c.key, ""]))])
    );
    setData(blank);
  };

  const role = (user?.role || "").toLowerCase();
  const isTeacher = role === "teacher";

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        {isTeacher ? <Sidebar activeLink="MPS" /> : <SidebarCoordinator activeLink="MPS" />}
        <div className="dashboard-content">
          <div className="dashboard-main">
            <h2>MPS</h2>
          </div>

          <div className="content">
            <div className="buttons">
              <button onClick={handleGenerateTemplate}>Generate Template</button>

              {/* Import is disabled when inputs are disabled */}
              <button onClick={() => setOpenPopup(true)}>
                Import File
              </button>


             {openPopup && (
              <div className="modal-overlay">
                <div className="import-popup">
                  <div className="popup-header">
                    <h2>Import File</h2>
                    <button className="close-button" onClick={() => { setOpenPopup(false); setImportMsg(null); }}>X</button>
                  </div>
                  <hr />
                  <form
                    className="import-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (isDisabled) return; // should be disabled by button anyway
                      try {
                        setImporting(true);
                        setImportMsg(null);
                        const file = fileInputRef.current?.files?.[0];
                        const { nextData, importedCount } = await importFromFile(file);

                        // mark as user-edited to prevent hydration overwrite
                        touchedRef.current = true;
                        // allow editing even if backend locked (since user took an explicit action)
                        setEditOverride(true);

                        setData(nextData);
                        setImportMsg(`Imported ${importedCount} row(s).`);
                        // auto-close after a short delay (optional)
                        setTimeout(() => setOpenPopup(false), 600);
                      } catch (err) {
                        setImportMsg(err.message || "Import failed.");
                      } finally {
                        setImporting(false);
                      }
                    }}
                  >
                    <label htmlFor="fileInput" className="file-upload-label">
                      Click here to upload a file
                    </label>
                    <input
                      id="fileInput"
                      type="file"
                      accept=".csv"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      onChange={() => setImportMsg(null)}
                    />
                    <button type="submit" disabled={isDisabled || importing}>
                      {importing ? "Uploading..." : "Upload"}
                    </button>
                    {importMsg && <p className="import-hint">{importMsg}</p>}
                    <p className="import-hint">
                      Expected CSV format: first row is headers with <b>Trait</b>, then any of{" "}
                      {COLS.map(c => c.label).join(", ")}. A final <b>Total</b> row (optional) will be ignored.
                    </p>
                  </form>
                </div>
              </div>
            )}


              <button onClick={handleExport}>Export</button>
            </div>

            {/* Drop downs */}
            <div className="dropdown-container">
              <div className="dropdown">
                <button className="dropdown-btn" onClick={() => setOpen(!open)}>
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
                <button className="dropdown-btn" onClick={() => setOpenSec(!openSec)}>
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

            {/* Table */}
            <div className="table-wrap">
              <table className="laempl-table">
                <caption>Grade 1 - MPS</caption>
                <thead>
                  <tr>
                    <th scope="col" className="row-head"> </th>
                    {COLS.map(col => (
                      <th key={col.key} scope="col">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TRAITS.map(trait => (
                    <tr key={trait}>
                      <th scope="row" className="row-head">{trait}</th>
                      {COLS.map(col => (
                        <td key={col.key}>
                          <input
                            type="number"
                            inputMode="numeric"
                            step="any"
                            value={data[trait][col.key] ?? ""}
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
                    {COLS.map(col => (
                      <td key={col.key} className="total-cell">{totals[col.key]}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="table-actions">
              <button type="button" disabled={saving || isDisabled} onClick={submitMPS}>
                {saving ? "Saving..." : "Save as Draft"}
              </button>
              <button type="button" disabled={saving || isDisabled} onClick={submitMPS}>
                {saving ? "Submitting..." : "Submit"}
              </button>
              <button type="button" onClick={handleClear}>
                Clear Table
              </button>
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
    </>
  );
}

export default MPSReport;
