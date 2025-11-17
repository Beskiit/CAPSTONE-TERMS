import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header.jsx";
import Breadcrumb from "../../components/Breadcrumb.jsx";
import Sidebar from "../../components/shared/SidebarPrincipal.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import "../Teacher/LAEMPLReport.css";
import "./ForApprovalData.css";
import "../Coordinator/AssignedReport.css";
import "../Teacher/ViewSubmission.css";
import Modal from "react-modal";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } from "docx";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";

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
const FIXED_COL_WIDTH = 25;
const applySheetSizing = (worksheet, data) => {
  const maxCols = data.reduce((max, row) => Math.max(max, row.length), 0);
  worksheet["!cols"] = Array.from({ length: maxCols }, () => ({
    wch: FIXED_COL_WIDTH,
  }));
  worksheet["!rows"] = data.map((row) => {
    const longest = row.reduce((max, cell) => {
      if (cell == null) return max;
      return Math.max(max, cell.toString().length);
    }, 0);
    const lines = Math.max(1, Math.ceil(longest / FIXED_COL_WIDTH));
    return { hpt: Math.min(18 * lines, 120) };
  });
};
const parseSpreadsheet = async (file) => {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1 });
  }
  const text = await file.text();
  return text
    .trim()
    .split(/\r?\n/)
    .map((l) =>
      l
        .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
        .map((s) => s.replace(/^"|"$/g, "").replace(/""/g, '"'))
    );
};

// Helper function to sanitize keys from database (e.g., "English (15 - 25 points)" -> "english")
const sanitizeKey = (rawKey) => {
  // Remove "(XX - YY points)" part and convert to snake_case
  let cleanKey = rawKey.replace(/\s*\(\d+\s*-\s*\d+\s*points\)/g, '').trim();
  cleanKey = cleanKey.toLowerCase().replace(/\s/g, '_');
  return cleanKey;
};

// Helper function to get column labels
const getColumnLabel = (key, subjectNames = {}) => {
  const labelMap = {
    m: "No. of Male",
    f: "No. of Female",
    no_of_cases: "No. of Cases",
    no_of_items: "No. of Items",
    total_score: "Total Score",
    highest_score: "Highest Score",
    lowest_score: "Lowest Score",
    male_passed: "Number of Male Learners who Passed (MPL)",
    male_mpl_percent: "% MPL (MALE)",
    female_passed: "Number of Female who Passed (MPL)",
    female_mpl_percent: "% MPL (FEMALE)",
    total_passed: "Number of Learners who Passed (MPL)",
    total_mpl_percent: "% MPL (TOTAL)",
    gmrc: "GMRC (15 - 25 points)",
    math: "Mathematics (15 - 25 points)",
    lang: "Language (15 - 25 points)",
    read: "Reading and Literacy (15 - 25 points)",
    makabasa: "MAKABASA (15 - 25 points)",
    english: "English (15 - 25 points)",
    araling_panlipunan: "Araling Panlipunan (15 - 25 points)",
    hs: "HS",
    ls: "LS",
    total_items: "Total no. of Items",
    total: "Total no. of Pupils",
    mean: "Mean",
    median: "Median",
    pl: "PL",
    mps: "MPS",
    sd: "SD",
    target: "Target",
  };
  
  // Handle subject IDs (e.g., subject_8, subject_10)
  if (key.startsWith('subject_')) {
    const subjectId = key.replace('subject_', '');
    const subjectName = subjectNames[subjectId];
    return subjectName || `Subject ${subjectId}`;
  }
  
  return labelMap[key] || key.toUpperCase();
};

// Dynamic data structure - will be populated from database
const DEFAULT_TRAITS = ["Masipag","Matulungin","Masunurin","Magalang","Matapat","Matiyaga"];

const DEFAULT_COLS = [
  { key: "m",        label: "M" },
  { key: "f",        label: "F" },
  { key: "gmrc",     label: "GMRC (15 - 25 points)" },
  { key: "math",     label: "Mathematics (15 - 25 points)" },
  { key: "lang",     label: "Language (15 - 25 points)" },
  { key: "read",     label: "Reading and Literacy (15 - 25 points)" },
  { key: "makabasa", label: "MAKABASA (15 - 25 points)" },
];

const DEFAULT_COLS_MPS = [
  { key: "m", label: "Male" },
  { key: "f", label: "Female" },
  { key: "total", label: "Total no. of Pupils" },
  { key: "total_score", label: "Total Score" },
  { key: "mean", label: "Mean" },
  { key: "median", label: "Median" },
  { key: "pl", label: "PL" },
  { key: "mps", label: "MPS" },
  { key: "sd", label: "SD" },
  { key: "target", label: "Target" },
  { key: "hs", label: "HS" },
  { key: "ls", label: "LS" },
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
  const navigate = useNavigate();
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
  
  // Dynamic data structure from database
  const [TRAITS, setTRAITS] = useState(DEFAULT_TRAITS);
  const [COLS, setCOLS] = useState(DEFAULT_COLS);
  const [COLS_MPS, setCOLS_MPS] = useState(DEFAULT_COLS_MPS);
  const [subjectNames, setSubjectNames] = useState({});


  // Function to fetch subject names
  const fetchSubjectNames = async (subjectIds) => {
    if (!subjectIds || subjectIds.length === 0) return;
    
    try {
      const response = await fetch(`${API_BASE}/subjects`, {
        credentials: "include"
      });
      
      if (response.ok) {
        const subjects = await response.json();
        const subjectMap = {};
        subjects.forEach(subject => {
          subjectMap[subject.subject_id] = subject.subject_name;
        });
        setSubjectNames(subjectMap);
        console.log('Subject names fetched:', subjectMap);
      }
    } catch (error) {
      console.error('Error fetching subject names:', error);
    }
  };

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

        // First try submissions endpoint (includes assignment title)
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
          console.log("Submissions endpoint failed:", error.message);
          lastError = error.message;
        }

        // If submissions endpoint failed, try accomplishment endpoint as fallback
        if (!data) {
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
            console.log("Accomplishment endpoint also failed:", error.message);
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
        console.log('Subject ID:', data.fields?.subject_id);
        console.log('Subject Name:', data.fields?.subject_name);
        console.log('Rejection reason (direct):', data.rejection_reason);
        console.log('Rejection reason (fields):', data.fields?.rejection_reason);
        setSubmissionData(data);
        
        // Extract dynamic data structure from database
        if (data.fields && data.fields.rows && Array.isArray(data.fields.rows)) {
          // Extract traits from the actual data
          const actualTraits = data.fields.rows.map(row => row.trait).filter(Boolean);
          if (actualTraits.length > 0) {
            setTRAITS(actualTraits);
            console.log('Dynamic traits extracted from database:', actualTraits);
          }
          
          // Extract columns from the first row
          if (data.fields.rows.length > 0) {
            const firstRow = data.fields.rows[0];
            const actualCols = Object.keys(firstRow)
              .filter(key => key !== 'trait')
              .map(key => {
                const cleanKey = sanitizeKey(key);
                return {
                  key: cleanKey,
                  originalKey: key,
                  label: getColumnLabel(cleanKey, subjectNames)
                };
              });
            if (actualCols.length > 0) {
              setCOLS(actualCols);
              console.log('Dynamic columns extracted from database:', actualCols);
            }
            
            // Extract subject IDs and fetch subject names
            const subjectIds = Object.keys(firstRow)
              .filter(key => key.startsWith('subject_'))
              .map(key => key.replace('subject_', ''));
            
            if (subjectIds.length > 0) {
              console.log('Found subject IDs:', subjectIds);
              fetchSubjectNames(subjectIds);
            }
          }
        }

      } catch (error) {
        console.error("Error fetching submission data:", error);
        setSubmissionError(error.message);
      } finally {
        setSubmissionLoading(false);
      }
    };

    fetchSubmissionData();
  }, [currentSubmissionId]);

  // table state - initialize with dynamic structure
  const [data, setData] = useState(() =>
    Object.fromEntries(
      TRAITS.map((t) => [t, Object.fromEntries(COLS.map((c) => [c.key, ""]))])
    )
  );

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Reinitialize data when dynamic structure changes
  useEffect(() => {
    if (TRAITS.length > 0 && COLS.length > 0) {
      const newData = Object.fromEntries(
        TRAITS.map((t) => [t, Object.fromEntries(COLS.map((c) => [c.key, ""]))])
      );
      setData(newData);
      console.log('Data structure reinitialized with dynamic values:', { TRAITS, COLS });
      console.log('New data structure:', newData);
    }
  }, [TRAITS, COLS]);

  // Update column labels when subject names are fetched
  useEffect(() => {
    if (Object.keys(subjectNames).length > 0 && COLS.length > 0) {
      const updatedCols = COLS.map(col => ({
        ...col,
        label: getColumnLabel(col.key, subjectNames)
      }));
      setCOLS(updatedCols);
      console.log('Updated columns with subject names:', updatedCols);
    }
  }, [subjectNames]);

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
      (sum, t) => {
        const value = data[t]?.[c.key];
        return sum + (Number(value) || 0);
      },
      0
    );
    return acc;
  }, {});

  const toRows = (obj) => TRAITS.map((trait) => ({ trait, ...(obj[trait] || {}) }));

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

          // Create data structure based on actual database structure
          const next = Object.fromEntries(
            TRAITS.map((t) => [
              t,
              Object.fromEntries(COLS.map((c) => [c.key, ""])),
            ])
          );
          
          // Populate with actual data from database
          rows.forEach((r) => {
            if (!r?.trait || !next[r.trait]) return;
            COLS.forEach((c) => {
              next[r.trait][c.key] = (r[c.originalKey] ?? "").toString();
            });
          });
          
          console.log('Populating data with database values:', next);
          console.log('Data structure after population:', Object.keys(next));
          console.log('First trait data:', next[TRAITS[0]]);
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

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    const header = ["Trait", ...COLS.map((c) => c.label)];
    const rows = TRAITS.map((trait) => [
      trait,
      ...COLS.map((c) => data[trait]?.[c.key] || ""),
    ]);
    const totalRow = ["Total", ...COLS.map((c) => totals[c.key])];
    const sheetData = [header, ...rows, totalRow];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    applySheetSizing(sheet, sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, "LAEMPL");
    XLSX.writeFile(workbook, "LAEMPL_Grade1.xlsx");
  };

  const exportTemplateExcel = () => {
    const workbook = XLSX.utils.book_new();
    const header = ["Trait", ...COLS.map((c) => c.label)];
    const blank = TRAITS.map((trait) => [trait, ...COLS.map(() => "")]);
    const sheetData = [header, ...blank];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    applySheetSizing(sheet, sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, "LAEMPL_Template");
    XLSX.writeFile(workbook, "LAEMPL_Template.xlsx");
  };

  const onImport = async (file) => {
    try {
      const lines = await parseSpreadsheet(file);
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
      setErr("Failed to import file. " + (e?.message || ""));
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
      
      console.log('Rejecting submission:', {
        submissionId,
        submissionType,
        endpoint,
        status: 4,
        rejection_reason: rejectReason
      });
      
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

      console.log('Reject response status:', response.status);
      console.log('Reject response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Reject error response:', errorText);
        throw new Error(`Failed to reject submission: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('Reject success response:', result);

      setMsg("Submission rejected successfully.");
      setIsRejectOpen(false);
      
      // Redirect to dashboard after successful rejection
      setTimeout(() => {
        navigate('/DashboardPrincipal');
      }, 1000); // Small delay to show success message
      setRejectReason("");
      setReasonErr("");
    } catch (error) {
      console.error("Error rejecting submission:", error);
      setErr(`Failed to reject submission: ${error.message}`);
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
      
      console.log('Approving submission:', {
        submissionId,
        submissionType,
        endpoint,
        status: 3
      });
      
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

      console.log('Approve response status:', response.status);
      console.log('Approve response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Approve error response:', errorText);
        throw new Error(`Failed to approve submission: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('Approve success response:', result);

      setMsg("Submission approved successfully.");
      setIsApproveOpen(false);
      
      // Redirect to ViewSubmission after successful approval
      setTimeout(() => {
        navigate(`/ViewSubmission?id=${submissionId}`);
      }, 1000); // Small delay to show success message
    } catch (error) {
      console.error("Error approving submission:", error);
      setErr(`Failed to approve submission: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 0: return 'Draft';
      case 1: return 'Pending';
      case 2: return 'Completed';
      case 3: return 'Approved';
      case 4: return 'Rejected';
      default: return 'Unknown';
    }
  };

  const exportBothReportsToExcel = (fields) => {
    const workbook = XLSX.utils.book_new();

    if (fields.rows && fields.rows.length > 0) {
      const rows = fields.rows;
      const traits = rows.map((row) => row.trait).filter(Boolean);
      let cols = [];
      if (rows.length > 0) {
        const firstRow = rows[0];
        cols = Object.keys(firstRow)
          .filter((key) => key !== "trait")
          .map((key) => {
            const cleanKey = key.replace(/[^a-zA-Z0-9]/g, "_");
            return {
              key: cleanKey,
              originalKey: key,
              label: getColumnLabel(cleanKey, subjectNames),
            };
          });
      }

      const laemplHeader = ["Trait", ...cols.map((c) => c.label)];
      const laemplRows = traits.map((trait) => {
        const rowData = rows.find((r) => r.trait === trait) || {};
        return [trait, ...cols.map((c) => rowData[c.originalKey || c.key] || "")];
      });
      const laemplData = [laemplHeader, ...laemplRows];
      const laemplSheet = XLSX.utils.aoa_to_sheet(laemplData);
      applySheetSizing(laemplSheet, laemplData);
      XLSX.utils.book_append_sheet(workbook, laemplSheet, "LAEMPL");
    }

    if (fields.mps_rows && fields.mps_rows.length > 0) {
      const mpsRows = fields.mps_rows;
      const mpsTraits = mpsRows.map((row) => row.trait).filter(Boolean);
      const mpsHeader = ["Trait", ...COLS_MPS.map((c) => c.label)];
      const mpsSheetRows = mpsTraits.map((trait) => {
        const rowData = mpsRows.find((r) => r.trait === trait) || {};
        return [trait, ...COLS_MPS.map((c) => rowData[c.key] || "")];
      });
      const mpsData = [mpsHeader, ...mpsSheetRows];
      const mpsSheet = XLSX.utils.aoa_to_sheet(mpsData);
      applySheetSizing(mpsSheet, mpsData);
      XLSX.utils.book_append_sheet(workbook, mpsSheet, "MPS");
    }

    if (workbook.SheetNames.length === 0) {
      alert("No report data available to export.");
      return;
    }

    XLSX.writeFile(
      workbook,
      `Combined_Reports_${SUBMISSION_ID || "export"}.xlsx`
    );
  };

  const exportToWord = async (submissionData) => {
    if (!submissionData || !submissionData.fields) {
      alert("No data available to export");
      return;
    }

    const fields = submissionData.fields;
    const answers = fields._answers || {};
    const activity = answers;

    // Normalize orientation via canvas (browser applies EXIF on decode)
    const normalizeImageForDocx = async (imageUrl, targetHeight = 150, maxWidth = 220) => {
      try {
        const res = await fetch(imageUrl, { credentials: "include" });
        if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);

        const img = await new Promise((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = reject;
          el.src = objUrl;
        });

        const aspect = img.width && img.height ? img.width / img.height : 4 / 3;
        const height = targetHeight;
        const width = Math.min(Math.round(aspect * height), maxWidth);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const outBlob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
        URL.revokeObjectURL(objUrl);
        if (!outBlob) return null;

        return { buffer: new Uint8Array(await outBlob.arrayBuffer()), width, height };
      } catch (e) {
        console.error("normalizeImageForDocx error:", e);
        return null;
      }
    };

    // Build absolute URLs for stored images
    const imageItems = (answers.images || [])
      .map((img) => {
        if (typeof img === "string") return `${API_BASE}/uploads/accomplishments/${img}`;
        if (img?.url) return img.url.startsWith("/") ? `${API_BASE}${img.url}` : img.url;
        if (img?.filename) return `${API_BASE}/uploads/accomplishments/${img.filename}`;
        return null;
      })
      .filter(Boolean);

    const normalized = await Promise.all(imageItems.map((u) => normalizeImageForDocx(u, 150, 220)));
    const validImages = normalized.filter(Boolean);

    // === Build a small inner table: 2 images per row ===
    const makeTwoPerRowImageTable = () => {
      if (!validImages.length) {
        return new Paragraph({
          children: [new TextRun({ text: "No images provided", italics: true })],
        });
      }

      const rows = [];
      const gapWidthDXA = 240; // ~ 0.17 inch gap (tweak as needed)

      for (let i = 0; i < validImages.length; i += 2) {
        const left = validImages[i];
        const right = validImages[i + 1]; // may be undefined for odd count

        const cells = [
          new TableCell({
            borders: { top: { size: 0 }, bottom: { size: 0 }, left: { size: 0 }, right: { size: 0 } },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new ImageRun({ data: left.buffer, transformation: { width: left.width, height: left.height } })],
              }),
            ],
          }),
        ];

        if (right) {
          // gap cell
          cells.push(
            new TableCell({
              width: { size: gapWidthDXA, type: WidthType.DXA },
              borders: { top: { size: 0 }, bottom: { size: 0 }, left: { size: 0 }, right: { size: 0 } },
              children: [new Paragraph({})],
            })
          );
          // right image cell
          cells.push(
            new TableCell({
              borders: { top: { size: 0 }, bottom: { size: 0 }, left: { size: 0 }, right: { size: 0 } },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new ImageRun({ data: right.buffer, transformation: { width: right.width, height: right.height } })],
                }),
              ],
            })
          );
        }

        rows.push(new TableRow({ children: cells }));
      }

      return new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { size: 0 }, bottom: { size: 0 }, left: { size: 0 }, right: { size: 0 } },
        alignment: AlignmentType.CENTER,
      });
    };

    try {
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({ children: [new TextRun({ text: "Republic of the Philippines", bold: true, size: 24 })], alignment: AlignmentType.CENTER }),
              new Paragraph({ children: [new TextRun({ text: "Department of Education", bold: true, size: 24 })], alignment: AlignmentType.CENTER }),
              new Paragraph({ children: [new TextRun({ text: "Region III", bold: true, size: 20 })], alignment: AlignmentType.CENTER }),
              new Paragraph({ children: [new TextRun({ text: "Schools Division of Bulacan", bold: true, size: 20 })], alignment: AlignmentType.CENTER }),
              new Paragraph({ children: [new TextRun({ text: "Tuktukan Elementary School", bold: true, size: 20 })], alignment: AlignmentType.CENTER }),
              new Paragraph({ text: "" }),
              new Paragraph({ children: [new TextRun({ text: "ACTIVITY COMPLETION REPORT 2024-2025", bold: true, size: 28 })], alignment: AlignmentType.CENTER }),
              new Paragraph({ text: "" }),

              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 30, type: WidthType.PERCENTAGE },
                        children: [new Paragraph({ children: [new TextRun({ text: "Program/Activity Title:", bold: true })] })],
                      }),
                      new TableCell({
                        width: { size: 70, type: WidthType.PERCENTAGE },
                        children: [new Paragraph({ children: [new TextRun({ text: activity.activityName || "Not provided" })] })],
                      }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Facilitator/s:", bold: true })] })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: activity.facilitators || "Not provided" })] })] }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Objectives:", bold: true })] })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: activity.objectives || "Not provided" })] })] }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Program/Activity Design:", bold: true })] })] }),
                      new TableCell({
                        children: [
                          new Paragraph({ children: [new TextRun({ text: `Date: ${activity.date || "Not provided"}` })] }),
                          new Paragraph({ children: [new TextRun({ text: `Time: ${activity.time || "Not provided"}` })] }),
                          new Paragraph({ children: [new TextRun({ text: `Venue: ${activity.venue || "Not provided"}` })] }),
                          new Paragraph({ children: [new TextRun({ text: `Key Results: ${activity.keyResult || "Not provided"}` })] }),
                        ],
                      }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Person/s Involved:", bold: true })] })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: activity.personsInvolved || "Not provided" })] })] }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Expenses:", bold: true })] })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: activity.expenses || "Not provided" })] })] }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Lessons Learned/Recommendation:", bold: true })] })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: activity.lessonLearned || "Not provided" })] })] }),
                    ],
                  }),

                  // Picture/s row (2 images per row)
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Picture/s:", bold: true })] })] }),
                      new TableCell({ children: [makeTwoPerRowImageTable()] }),
                    ],
                  }),

                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Narrative:", bold: true })] })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: answers.narrative || "No narrative provided" })] })] }),
                    ],
                  }),
                ],
              }),

              new Paragraph({ text: "" }),
              new Paragraph({ children: [new TextRun({ text: "Activity Completion Report prepared by:", bold: true })] }),
              new Paragraph({ text: "" }),
              new Paragraph({ children: [new TextRun({ text: "Name: [Signature Name]", bold: true })] }),
              new Paragraph({ children: [new TextRun({ text: "Position: [Position Title]", bold: true })] }),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const fileName = `Activity_Completion_Report_${activity.activityName?.replace(/[^a-zA-Z0-9]/g, "_") || "Report"}.docx`;
      saveAs(blob, fileName);
    } catch (err) {
      console.error("Error generating Word document:", err);
      alert("Error generating document. Please try again.");
    }
  };


  const renderSubmissionContent = (submission) => {
    const fields = submission.fields || {};
    
    // Determine submission type based on fields structure
    if (fields.type === 'ACCOMPLISHMENT' || fields._answers) {
      return renderAccomplishmentReport(fields);
    } else if (fields.rows && Array.isArray(fields.rows)) {
      return (
        <div>
          {renderLAEMPLReport(fields)}
          {fields.mps_rows && fields.mps_totals && (
            <div style={{ marginTop: '2rem' }}>
              {renderMPSReport({ rows: fields.mps_rows, totals: fields.mps_totals })}
            </div>
          )}
        </div>
      );
    } else {
      // Fallback to generic display
      return renderGenericContent(fields);
    }
  };

  const renderAccomplishmentReport = (fields) => {
    const answers = fields._answers || {};
    
    return (
      <div className="accomplishment-report-display">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h4>Activity Completion Report</h4>
          <button
            onClick={() => exportToWord({ fields })}
            style={{
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Export to Word
          </button>
        </div>
        <div className="form-display">
          <div className="form-row">
            <label>Program/Activity Title:</label>
            <div className="readonly-field">{answers.activityName || ''}</div>
          </div>
          <div className="form-row">
            <label>Facilitator/s:</label>
            <div className="readonly-field">{answers.facilitators || ''}</div>
          </div>
          <div className="form-row">
            <label>Objectives:</label>
            <div className="readonly-field">{answers.objectives || ''}</div>
          </div>
          
          {/* Program/Activity Design Section */}
          <div className="activity-design-section">
            <div className="form-row">
              <label>Date:</label>
              <div className="readonly-field">{answers.date || ''}</div>
            </div>
            <div className="form-row">
              <label>Time:</label>
              <div className="readonly-field">{answers.time || ''}</div>
            </div>
            <div className="form-row">
              <label>Venue:</label>
              <div className="readonly-field">{answers.venue || ''}</div>
            </div>
            <div className="form-row">
              <label>Key Results:</label>
              <div className="readonly-field">{answers.keyResult || ''}</div>
            </div>
          </div>
          
          <div className="form-row">
            <label>Person/s Involved:</label>
            <div className="readonly-field">{answers.personsInvolved || ''}</div>
          </div>
          <div className="form-row">
            <label>Expenses:</label>
            <div className="readonly-field">{answers.expenses || ''}</div>
          </div>
          <div className="form-row">
            <label>Lesson Learned/Recommendation:</label>
            <div className="readonly-field narrative-content">{answers.lessonLearned || ''}</div>
          </div>
          {answers.images && answers.images.length > 0 && (
            <div className="form-row">
              <label>Picture/s:</label>
              <div className="image-gallery">
                {answers.images.map((img, index) => (
                  <div key={index} className="image-item">
                    <img src={img.url || img} alt={`Activity image ${index + 1}`} />
                  </div>
                ))}
              </div>
              </div>
            )}
          <div className="form-row">
            <label>Narrative:</label>
            <div className="readonly-field narrative-content">{answers.narrative || ''}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderLAEMPLReport = (fields) => {
    const rows = fields.rows || [];
    // Use dynamic data structure from state
    const traits = TRAITS;
    const cols = COLS;

    return (
      <div className="laempl-report-display">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4>LAEMPL Report</h4>
            <button
              onClick={() => exportBothReportsToExcel(fields)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Export Both Reports
          </button>
        </div>
        <div className="table-container">
                <table className="laempl-table">
                  <thead>
                    <tr>
                <th>Trait</th>
                {cols.map(col => (
                  <th key={col.key}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
              {traits.map(trait => {
                const rowData = rows.find(r => r.trait === trait) || {};
                return (
                      <tr key={trait}>
                    <td className="trait-cell">{trait}</td>
                    {cols.map(col => (
                      <td key={col.key} className="data-cell">
                        {rowData[col.key] || ''}
                          </td>
                        ))}
                      </tr>
                );
              })}
                  </tbody>
                </table>
        </div>
      </div>
    );
  };

  // Helper function to calculate averages for MPS columns
  const calculateMPSAverages = (rows, cols) => {
    const avgColumns = ['mean', 'median', 'pl', 'mps', 'sd', 'target'];
    const averages = {};
    
    avgColumns.forEach(colKey => {
      const values = rows
        .map(row => {
          const val = row[colKey];
          const num = typeof val === 'number' ? val : parseFloat(val);
          return Number.isFinite(num) ? num : null;
        })
        .filter(v => v !== null);
      
      if (values.length > 0) {
        const sum = values.reduce((acc, val) => acc + val, 0);
        averages[colKey] = (sum / values.length).toFixed(2);
      } else {
        averages[colKey] = '';
      }
    });
    
    return averages;
  };

  const renderMPSReport = (fields) => {
    const rows = fields.rows || [];
    const traits = TRAITS;
    const cols = COLS_MPS;

    // Calculate averages for the average row
    const averages = calculateMPSAverages(rows, cols);

    return (
      <div className="mps-report-display">
        <h4>MPS Report</h4>
        <div className="table-container">
          <table className="mps-table">
            <thead>
              <tr>
                <th>Trait</th>
                {cols.map(col => (
                  <th key={col.key}>{col.originalKey || col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {traits.map(trait => {
                const rowData = rows.find(r => r.trait === trait) || {};
                return (
                  <tr key={trait}>
                    <td className="trait-cell">{trait}</td>
                    {cols.map(col => {
                      const valueKey = col.originalKey || col.key;
                      return (
                        <td key={col.key} className="data-cell">
                          {rowData[valueKey] ?? ""}
                      </td>
                      );
                    })}
                  </tr>
                );
              })}
              {/* Average row */}
              <tr style={{ fontWeight: 'bold', backgroundColor: '#f3f4f6' }}>
                <td className="trait-cell">Average</td>
                {cols.map(col => {
                  const avgColumns = ['mean', 'median', 'pl', 'mps', 'sd', 'target'];
                  if (avgColumns.includes(col.key)) {
                    return (
                      <td key={col.key} className="data-cell">
                        {averages[col.key]}
                      </td>
                    );
                  }
                  return <td key={col.key} className="data-cell"></td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderGenericContent = (fields) => {
    return (
      <div className="generic-content">
        {fields.narrative && (
          <div>
            <h4>Narrative:</h4>
            <p>{fields.narrative}</p>
              </div>
            )}
        {fields.images && fields.images.length > 0 && (
          <div>
            <h4>Images:</h4>
            <div className="image-gallery">
              {fields.images.map((img, index) => (
                <div key={index} className="image-item">
                  <img src={img.url || img} alt={`Submission image ${index + 1}`} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (submissionLoading) {
    return (
      <>
        <Header userText={user ? user.name : "Guest"} />
        <div className="dashboard-container">
          <Sidebar activeLink="For Approval" />
          <div className="dashboard-content">
            <Breadcrumb />
            <div className="dashboard-main">
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <h2>Loading Submission...</h2>
                <p>Fetching submission data, please wait...</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (submissionError || !submissionData) {
    return (
      <>
        <Header userText={user ? user.name : "Guest"} />
        <div className="dashboard-container">
          <Sidebar activeLink="For Approval" />
          <div className="dashboard-content">
            <Breadcrumb />
            <div className="dashboard-main">
              <div className="error-container">
                <h2>Error Loading Submission</h2>
                <p className="error-message">{submissionError || "Submission not found"}</p>
                <div className="action-buttons">
                  <button onClick={() => window.history.back()}>Go Back</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        <Sidebar activeLink="For Approval" />
        <div className="dashboard-content">
          <Breadcrumb />
          <div className="dashboard-main">
            <div className="page-header">
              <button 
                onClick={() => window.history.back()} 
                className="back-button"
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  marginBottom: '20px'
                }}
              >
                ← Back
              </button>
              <h2>Submitted Report Details</h2>
            </div>
            
            <div className="submission-details">
              <div className="detail-row">
                <label>Title:</label>
                <span>{submissionData.assignment_title || submissionData.title || submissionData.value || 'Report'}</span>
              </div>
              <div className="detail-row">
                <label>Status:</label>
                <span className={`status-badge status-${submissionData.status}`}>
                  {getStatusText(submissionData.status)}
                </span>
              </div>
              <div className="detail-row">
                <label>Date Submitted:</label>
                <span>{submissionData.date_submitted || 'Not submitted'}</span>
              </div>
              <div className="detail-row">
                <label>Submitted By:</label>
                <span>{submissionData.submitted_by_name || submissionData.submitted_by || 'Unknown'}</span>
              </div>
              {submissionData.fields?.subject_name && (
                <div className="detail-row">
                  <label>Subject:</label>
                  <span>{submissionData.fields.subject_name}</span>
                </div>
              )}
              {submissionData.fields?.subject_id && !submissionData.fields?.subject_name && (
                <div className="detail-row">
                  <label>Subject ID:</label>
                  <span>{submissionData.fields.subject_id}</span>
                </div>
              )}
              {(submissionData.rejection_reason || submissionData.fields?.rejection_reason) && (
                <div className="detail-row">
                  <label>Rejection Reason:</label>
                  <span style={{ color: '#e74c3c', fontStyle: 'italic' }}>
                    {submissionData.rejection_reason || submissionData.fields?.rejection_reason}
                  </span>
                </div>
              )}
            </div>
            
            {submissionData.fields && (
              <div className="submission-content">
                <div className="content-section">
                  {renderSubmissionContent(submissionData)}
                </div>
              </div>
            )}
            
            {/* Approve and Reject Section */}
            <div className="approval-section">
              <h3>Review Submission</h3>
              <p>Review the submission details above and choose to approve or reject.</p>
              {msg && (
                <div className={`message ${msg.includes('Error') ? 'error' : 'success'}`}>
                  {msg}
                </div>
              )}
              {err && (
                <div className="error-message">
                  {err}
                </div>
              )}
              <div className="approval-buttons">
                <button 
                  onClick={openRejectModal}
                  disabled={saving || submissionLoading}
                  className="reject-button"
                >
                  {saving ? 'Processing...' : 'Reject'}
                </button>
                <button 
                  onClick={openApproveModal}
                  disabled={saving || submissionLoading}
                  className="approve-button"
                >
                  {saving ? 'Processing...' : 'Approve'}
                </button>
          </div>
        </div>

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
