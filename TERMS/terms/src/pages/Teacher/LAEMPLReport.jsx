import React, { useState, useEffect, useRef } from "react";
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import "./LAEMPLReport.css";

const API_BASE = import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com";

const SUBMISSION_ID =
  new URLSearchParams(window.location.search).get("id") || "10";

/* ===============================
   LAEMPL (your existing)
=============================== */
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
const LOCK_STATUSES = new Set([1]); // e.g., 1=submitted

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

  // Validation function for LAEMPL report
  const validateLAEMPLForm = () => {
    const errors = [];
    
    // Check if all required fields are filled
    TRAITS.forEach(trait => {
      COLS.forEach(col => {
        const value = data[trait][col.key];
        if (value === "" || value == null || value === undefined) {
          errors.push(`${trait} - ${col.label} is required`);
        }
      });
    });
    
    return errors;
  };

  const onSubmit = async () => {
    if (!SUBMISSION_ID) {
      setErr("Missing submission id. Open this page with ?id=<submission_id> from the assignment link.");
      return;
    }
    if (isDisabled) {
      setErr("This submission is locked and cannot be changed.");
      return;
    }

    // Validate form before saving
    const validationErrors = validateLAEMPLForm();
    if (validationErrors.length > 0) {
      setErr(`Please fill all required fields: ${validationErrors.slice(0, 3).join(", ")}${validationErrors.length > 3 ? "..." : ""}`);
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

      if (typeof json?.status !== "undefined") setStatus(json.status);

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

      setEditOverride(false); // re-lock after save
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
          if (touchedRef.current) return; // don't overwrite local edits

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
          l
            .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)     // split by commas outside quotes
            .map((s) => s.replace(/^"|"$/g, "").replace(/""/g, '"'))
        );

      const body = lines.slice(1, 1 + TRAITS.length); // skip header
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
      setOpenPopup(false);       // close modal after success (optional)
    } catch (e) {
      setErr("Failed to import CSV. " + (e?.message || ""));
    }
  };

  // CLEAR TABLE — also enable edit override
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

  /* ===============================
     MPS (second table) — table-only
     NOTE: Reuses SUBMISSION_ID. If MPS uses a different id, update here.
  =============================== */
  const TRAITS_MPS = ["Masipag","Matulungin","Masunurin","Magalang","Matapat","Matiyaga"];
  const COLS_MPS = [
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

  const [mpsOpenPopup, setMpsOpenPopup] = useState(false);
  const mpsFileInput = useRef(null);
  const [mpsSaving, setMpsSaving] = useState(false);
  const [mpsMsg, setMpsMsg] = useState("");
  const [mpsErr, setMpsErr] = useState("");
  const [mpsStatus, setMpsStatus] = useState(null);
  const mpsLocked = LOCK_STATUSES.has(Number(mpsStatus));
  const [mpsEditOverride, setMpsEditOverride] = useState(false);
  const mpsDisabled = mpsLocked && !mpsEditOverride;
  const mpsTouchedRef = useRef(false);

  const [mpsData, setMpsData] = useState(() =>
    Object.fromEntries(
      TRAITS_MPS.map(t => [t, Object.fromEntries(COLS_MPS.map(c => [c.key, ""]))])
    )
  );

  const handleMpsChange = (trait, key, val) => {
    mpsTouchedRef.current = true;
    setMpsData(prev => ({
      ...prev,
      [trait]: { ...prev[trait], [key]: val.replace(/[^\d.-]/g, "") },
    }));
  };

  const mpsTotals = COLS_MPS.reduce((acc, c) => {
    acc[c.key] = TRAITS_MPS.reduce(
      (sum, t) => sum + (Number(mpsData[t][c.key]) || 0), 0
    );
    return acc;
  }, {});

  // Prefill MPS
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/mps/submissions/${SUBMISSION_ID}`, { credentials: "include" });
        if (!r.ok) return;
        const json = await r.json();
        if (json?.status !== undefined) setMpsStatus(json.status);

        const rows = json?.fields?.rows;
        if (Array.isArray(rows)) {
          if (mpsTouchedRef.current) return;
          const next = Object.fromEntries(
            TRAITS_MPS.map(t => [t, Object.fromEntries(COLS_MPS.map(c => [c.key, ""]))])
          );
          rows.forEach(rw => {
            if (!rw?.trait || !next[rw.trait]) return;
            COLS_MPS.forEach(c => {
              next[rw.trait][c.key] = (rw[c.key] ?? "").toString();
            });
          });
          setMpsData(next);
        }
      } catch {}
    })();
  }, []);

  const mpsToRows = () =>
    TRAITS_MPS.map(trait => {
      const row = { trait };
      COLS_MPS.forEach(c => {
        const v = mpsData[trait][c.key];
        row[c.key] = v === "" ? null : Number(v);
      });
      return row;
    });

  const mpsToTotals = () =>
    Object.fromEntries(COLS_MPS.map(c => [c.key, Number(mpsTotals[c.key] || 0)]));

  // Validation function for MPS form in LAEMPL report
  const validateMPSFormInLAEMPL = () => {
    const errors = [];
    
    // Check if all required fields are filled
    TRAITS_MPS.forEach(trait => {
      COLS_MPS.forEach(col => {
        const value = mpsData[trait][col.key];
        if (value === "" || value == null || value === undefined) {
          errors.push(`${trait} - ${col.label} is required`);
        }
      });
    });
    
    return errors;
  };

  const onSubmitMps = async () => {
    if (mpsDisabled) {
      setMpsErr("This submission is locked and cannot be changed.");
      return;
    }
    
    // Validate form before saving
    const validationErrors = validateMPSFormInLAEMPL();
    if (validationErrors.length > 0) {
      setMpsErr(`Please fill all required fields: ${validationErrors.slice(0, 3).join(", ")}${validationErrors.length > 3 ? "..." : ""}`);
      return;
    }
    
    setMpsSaving(true);
    setMpsMsg("");
    setMpsErr("");
    try {
      const body = { rows: mpsToRows(), totals: mpsToTotals() };
      const res = await fetch(`${API_BASE}/mps/submissions/${SUBMISSION_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const json = await res.json();
      setMpsMsg("Saved successfully.");
      if (json?.status !== undefined) setMpsStatus(json.status);
      setMpsEditOverride(false);
    } catch (e) {
      setMpsErr(e.message || "Failed to save.");
    } finally {
      setMpsSaving(false);
    }
  };

  // MPS CSV helpers
  const mpsDownloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const mpsToCSV = () => {
    const esc = (val) => {
      const s = (val ?? "").toString();
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["Trait", ...COLS_MPS.map(c => c.label)];
    const rows = TRAITS_MPS.map(trait => [
      trait,
      ...COLS_MPS.map(c => mpsData[trait][c.key] === "" ? "" : mpsData[trait][c.key])
    ]);
    const totalRow = ["Total", ...COLS_MPS.map(c => mpsTotals[c.key])];
    return [header, ...rows, totalRow].map(r => r.map(esc).join(",")).join("\n");
  };

  const handleMpsExport = () => {
    const csv = mpsToCSV();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    mpsDownloadBlob(blob, "MPS_Grade1.csv");
  };

  const handleMpsGenerateTemplate = () => {
    const blank = Object.fromEntries(
      TRAITS_MPS.map(t => [t, Object.fromEntries(COLS_MPS.map(c => [c.key, ""]))])
    );
    const header = ["Trait", ...COLS_MPS.map(c => c.label)];
    const rows = TRAITS_MPS.map(trait => [trait, ...COLS_MPS.map(c => blank[trait][c.key])]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    mpsDownloadBlob(blob, "MPS_Template.csv");
  };

  const mpsCsvToRows = (text) => {
    const rows = []; let row = [], cell = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], next = text[i + 1];
      if (inQuotes) {
        if (c === '"' && next === '"') { cell += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { cell += c; }
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(cell); cell = ""; }
        else if (c === '\r') {}
        else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ""; }
        else { cell += c; }
      }
    }
    if (cell.length > 0 || row.length) { row.push(cell); rows.push(row); }
    return rows;
  };

  const LABEL_TO_KEY_MPS = Object.fromEntries(COLS_MPS.map(c => [c.label.toLowerCase(), c.key]));

  const parseMpsCsv = (text) => {
    const rows = mpsCsvToRows(text).filter(r => r.some(v => String(v).trim() !== ""));
    if (!rows.length) throw new Error("CSV is empty.");
    const header = rows[0].map(h => String(h || "").trim());
    const traitIdx = header.findIndex(h => h.toLowerCase() === "trait");
    if (traitIdx === -1) throw new Error('Header must include "Trait".');

    const colIndexByKey = {};
    header.forEach((h, i) => {
      const key = LABEL_TO_KEY_MPS[h.toLowerCase()];
      if (key) colIndexByKey[key] = i;
    });
    const knownCols = Object.keys(colIndexByKey);
    if (!knownCols.length) throw new Error("No known columns found in header.");

    const next = Object.fromEntries(
      TRAITS_MPS.map(t => [t, Object.fromEntries(COLS_MPS.map(c => [c.key, ""]))])
    );

    let imported = 0;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const firstCell = String(row[traitIdx] || "").trim();
      if (!firstCell) continue;
      if (firstCell.toLowerCase() === "total") break;
      if (!TRAITS_MPS.includes(firstCell)) continue;

      knownCols.forEach(key => {
        const idx = colIndexByKey[key];
        const raw = row[idx] ?? "";
        next[firstCell][key] = String(raw).trim();
      });
      imported++;
    }
    return { nextData: next, importedCount: imported };
  };

  const onMpsImport = async (file) => {
    try {
      const text = await file.text();
      const { nextData, importedCount } = parseMpsCsv(text);
      mpsTouchedRef.current = true;
      setMpsEditOverride(true);
      setMpsData(nextData);
      setMpsMsg(`Imported ${importedCount} row(s).`);
      setMpsErr("");
      setMpsOpenPopup(false);
    } catch (e) {
      setMpsErr("Failed to import CSV. " + (e?.message || ""));
    }
  };

  const handleMpsClear = () => {
    mpsTouchedRef.current = true;
    setMpsEditOverride(true);
    const blank = Object.fromEntries(
      TRAITS_MPS.map(t => [t, Object.fromEntries(COLS_MPS.map(c => [c.key, ""]))])
    );
    setMpsData(blank);
  };

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        {isTeacher ? (
          <Sidebar activeLink="LAEMPL & MPS" />
        ) : (
          <SidebarCoordinator activeLink="LAEMPL & MPS" />
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
                    <form className="import-form" onSubmit={(e) => e.preventDefault()}>
                      {/* Clickable label opens file picker */}
                      <label
                        htmlFor="fileInput"
                        className="file-upload-label"
                        onClick={(e) => {
                          e.preventDefault();           // avoid submitting
                          fileInput.current?.click();   // open system dialog
                        }}
                      >
                        Click here to upload a file
                      </label>

                      {/* Hidden file input (the "destination") */}
                      <input
                        id="fileInput"
                        ref={fileInput}
                        type="file"
                        accept=".csv"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            onImport(f);
                            e.target.value = ""; // allow re-selecting same file
                          }
                        }}
                      />

                      {/* Upload button also opens file picker */}
                      <button
                        type="button"
                        onClick={() => fileInput.current?.click()}
                      >
                        Upload
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Export */}
              <button onClick={toCSV}>Export</button>
              {/* Clear */}
              <button onClick={handleClear}>Clear Table</button>
            </div>

            {/* Drop down for qtr and section */}
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
            {loading && <div className="ok-text" style={{ marginTop: 8 }}>Loading...</div>}
            {!!msg && <div className="ok-text" style={{ marginTop: 8 }}>{msg}</div>}
            {!!err && <div className="error-text" style={{ marginTop: 8 }}>{err}</div>}

            {/* DYNAMIC TABLE — LAEMPL */}
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

            {/* =========================
                SECOND TABLE — MPS
            ========================== */}
            <div className="dashboard-main" style={{ marginTop: 28 }}>
              <h2>MPS</h2>
            </div>

            <div className="buttons">
              <button onClick={handleMpsGenerateTemplate}>Generate Template</button>
              <button onClick={() => setMpsOpenPopup(true)} disabled={mpsDisabled}>Import File</button>
              {mpsOpenPopup && (
                <div className="modal-overlay">
                  <div className="import-popup">
                    <div className="popup-header">
                      <h2>Import File</h2>
                      <button className="close-button" onClick={() => setMpsOpenPopup(false)}>X</button>
                    </div>
                    <hr />
                    <form className="import-form" onSubmit={(e)=>e.preventDefault()}>
                      <label
                        htmlFor="mpsFileInput"
                        className="file-upload-label"
                        onClick={(e)=>{ e.preventDefault(); mpsFileInput.current?.click(); }}
                      >
                        Click here to upload a file
                      </label>
                      <input
                        id="mpsFileInput"
                        type="file"
                        accept=".csv"
                        ref={mpsFileInput}
                        style={{ display: "none" }}
                        onChange={(e)=>{
                          const f = e.target.files?.[0];
                          if (f) {
                            onMpsImport(f);
                            e.target.value = "";
                          }
                        }}
                      />
                      <button type="button" onClick={()=>mpsFileInput.current?.click()}>
                        Upload
                      </button>
                    </form>
                  </div>
                </div>
              )}
              <button onClick={handleMpsExport}>Export</button>
              <button onClick={handleMpsClear}>Clear Table</button>
            </div>

            {/* MPS table */}
            <div className="table-wrap">
              <table className="laempl-table">
                <caption>Grade 1 - MPS</caption>
                <thead>
                  <tr>
                    <th scope="col" className="row-head"> </th>
                    {COLS_MPS.map(col => (
                      <th key={col.key} scope="col">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TRAITS_MPS.map(trait => (
                    <tr key={trait}>
                      <th scope="row" className="row-head">{trait}</th>
                      {COLS_MPS.map(col => (
                        <td key={col.key}>
                          <input
                            type="number"
                            inputMode="numeric"
                            step="any"
                            value={mpsData[trait][col.key] ?? ""}
                            onChange={(e) => handleMpsChange(trait, col.key, e.target.value)}
                            className="cell-input"
                            disabled={mpsDisabled}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="total-row">
                    <th scope="row" className="row-head">Total</th>
                    {COLS_MPS.map(col => (
                      <td key={col.key} className="total-cell">{mpsTotals[col.key]}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="table-actions">
              <button type="button" disabled={mpsSaving || mpsDisabled} onClick={onSubmitMps}>
                {mpsSaving ? "Saving..." : "Save"}
              </button>
            </div>
            {!!mpsMsg && <div className="ok-text" style={{ marginTop: 8 }}>{mpsMsg}</div>}
            {!!mpsErr && <div className="error-text" style={{ marginTop: 8 }}>{mpsErr}</div>}
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
