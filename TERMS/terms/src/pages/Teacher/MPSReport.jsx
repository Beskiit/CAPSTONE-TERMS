import React, { useState, useEffect } from "react";
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

function LAEMPLReport() {
  const [openPopup, setOpenPopup] = useState(false);

  const [data, setData] = useState(() =>
    Object.fromEntries(
      TRAITS.map(t => [t, Object.fromEntries(COLS.map(c => [c.key, ""]))])
    )
  );

  const handleChange = (trait, colKey, value) => {
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

  // ---- save/submit (status removed on server, so we just send fields)
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  const submitMPS = async () => {
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
      setSaveMsg("Saved successfully.");
    } catch (err) {
      setSaveMsg(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ---- EXPORT: CSV (works offline, no libs)
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
      // wrap if contains comma, quote, or newline
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

  // ---- optional: blank template export
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
              <button onClick={() => setOpenPopup(true)}>Import File</button>
              {openPopup && (
                <div className="modal-overlay">
                  <div className="import-popup">
                    <div className="popup-header">
                      <h2>Import File</h2>
                      <button className="close-button" onClick={() => setOpenPopup(false)}>X</button>
                    </div>
                    <hr />
                    <form className="import-form" onSubmit={(e) => e.preventDefault()}>
                      <label htmlFor="fileInput" className="file-upload-label">
                        Click here to upload a file
                      </label>
                      <input id="fileInput" type="file" style={{ display: "none" }} />
                      <button type="submit">Upload</button>
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
                            value={data[trait][col.key]}
                            onChange={(e) => handleChange(trait, col.key, e.target.value)}
                            className="cell-input"
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
              <button type="button" disabled={saving} onClick={submitMPS}>
                {saving ? "Saving..." : "Save as Draft"}
              </button>
              <button type="button" disabled={saving} onClick={submitMPS}>
                {saving ? "Submitting..." : "Submit"}
              </button>
              {saveMsg && <p className="save-message">{saveMsg}</p>}
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

export default LAEMPLReport;
