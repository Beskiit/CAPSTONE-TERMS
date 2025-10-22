import React, { useState, useEffect, useRef } from "react";
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import "./LAEMPLReport.css";

const API_BASE = import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com";

/* ===============================
   LAEMPL (your existing)
=============================== */
// Default traits - will be replaced with teacher's actual section
const DEFAULT_TRAITS = ["Masipag","Matulungin","Masunurin","Magalang","Matapat","Matiyaga"];

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
  gmrc: [0, 9999], // Allow small numbers (count of students who got that score)
  math: [0, 9999], // Allow small numbers (count of students who got that score)
  lang: [0, 9999], // Allow small numbers (count of students who got that score)
  read: [0, 9999], // Allow small numbers (count of students who got that score)
  makabasa: [0, 9999], // Allow small numbers (count of students who got that score)
};

const clampVal = (k, v, colRules = COL_RULES) => {
  if (v === "" || v == null) return "";
  const n = Number(v);
  if (Number.isNaN(n)) return "";
  const [min, max] =
    colRules[k] || [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
  return Math.max(min, Math.min(max, n)).toString();
};

// statuses that lock the UI (adjust as needed)
const LOCK_STATUSES = new Set([1]); // e.g., 1=submitted

function LAEMPLReport() {
  console.log("LAEMPLReport component rendering...");
  const [openPopup, setOpenPopup] = useState(false);

  // Teacher's section state
  const [teacherSection, setTeacherSection] = useState(null);
  const [user, setUser] = useState(null);
  const [submissionData, setSubmissionData] = useState(null);
  
  // Coordinator state
  const [isCoordinatorView, setIsCoordinatorView] = useState(false);
  const [allSections, setAllSections] = useState([]);
  const [consolidatedData, setConsolidatedData] = useState({});
  
  // Consolidate modal state
  const [showConsolidate, setShowConsolidate] = useState(false);
  const [peerData, setPeerData] = useState([]);
  const [consolidateError, setConsolidateError] = useState("");
  const [consolidateSuccess, setConsolidateSuccess] = useState("");
  const [dynamicCols, setDynamicCols] = useState([
    { key: "m", label: "M" },
    { key: "f", label: "F" },
    { key: "total_score", label: "Total Score" },
    { key: "hs", label: "HS" },
    { key: "ls", label: "LS" },
    { key: "total_items", label: "Total no. of Items" }
  ]);
  const [dynamicColRules, setDynamicColRules] = useState({
    m: [0, 9999],
    f: [0, 9999],
    total_score: [0, 9999],
    hs: [0, 9999],
    ls: [0, 9999],
    total_items: [0, 9999]
  });
  const [loading, setLoading] = useState(true);

  // Get submission ID from URL parameters
  const SUBMISSION_ID = new URLSearchParams(window.location.search).get("id");
  console.log("SUBMISSION_ID from URL:", SUBMISSION_ID);
  console.log("Current URL:", window.location.href);

  // Dynamic traits based on teacher's section
  const [TRAITS, setTRAITS] = useState(DEFAULT_TRAITS);

  // table state - initialize with basic columns first
  const [data, setData] = useState(() => {
    const initialData = {};
    TRAITS.forEach(trait => {
      initialData[trait] = {};
      // Start with basic M, F, Total Score, HS, LS, and Total Items columns
      initialData[trait]["m"] = "";
      initialData[trait]["f"] = "";
      initialData[trait]["total_score"] = "";
      initialData[trait]["hs"] = "";
      initialData[trait]["ls"] = "";
      initialData[trait]["total_items"] = "";
    });
    return initialData;
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Reinitialize data when dynamicCols changes
  useEffect(() => {
    setData(prevData => {
      const newData = {};
      TRAITS.forEach(trait => {
        newData[trait] = {};
        dynamicCols.forEach(col => {
          // Preserve existing value or use empty string for new columns
          newData[trait][col.key] = prevData[trait]?.[col.key] || "";
        });
      });
      return newData;
    });
  }, [dynamicCols, TRAITS]);

  // Sync MPS data with LAEMPL data
  useEffect(() => {
    setMpsData(prevMpsData => {
      const newMpsData = {};
      TRAITS.forEach(trait => {
        newMpsData[trait] = {};
        
        // Sync Male and Female from LAEMPL
        newMpsData[trait]["m"] = data[trait]?.["m"] || "";
        newMpsData[trait]["f"] = data[trait]?.["f"] || "";
        
        // Calculate Total no. of Pupils (M + F)
        const male = Number(data[trait]?.["m"]) || 0;
        const female = Number(data[trait]?.["f"]) || 0;
        newMpsData[trait]["total"] = (male + female).toString();
        
        // Sync Total Score from LAEMPL
        newMpsData[trait]["total_score"] = data[trait]?.["total_score"] || "";
        
        // Sync HS and LS from LAEMPL
        newMpsData[trait]["hs"] = data[trait]?.["hs"] || "";
        newMpsData[trait]["ls"] = data[trait]?.["ls"] || "";
        
        // Sync Total Items from LAEMPL
        newMpsData[trait]["total_items"] = data[trait]?.["total_items"] || "";
        
        // Calculate Mean (Total Score / Total Pupils)
        const totalScore = Number(data[trait]?.["total_score"]) || 0;
        const totalPupils = male + female;
        const mean = totalPupils > 0 ? (totalScore / totalPupils).toFixed(2) : "0.00";
        newMpsData[trait]["mean"] = mean;
        
        // Get values for calculations
        const hs = Number(data[trait]?.["hs"]) || 0;
        const ls = Number(data[trait]?.["ls"]) || 0;
        const totalItems = Number(data[trait]?.["total_items"]) || 0;
        
        // Calculate Median (HS + LS) / 2
        const median = ((hs + ls) / 2).toFixed(2);
        newMpsData[trait]["median"] = median;
        
        // Calculate PL (Mean / No. of Items) x 100
        const pl = totalItems > 0 ? ((Number(mean) / totalItems) * 100).toFixed(2) : "0.00";
        newMpsData[trait]["pl"] = pl;
        
        // Calculate MPS (100 - PL) x 0.02 + PL
        const mps = ((100 - Number(pl)) * 0.02 + Number(pl)).toFixed(2);
        newMpsData[trait]["mps"] = mps;
        
        // Calculate SD (Square root of mean)
        const sd = Math.sqrt(Number(mean)).toFixed(2);
        newMpsData[trait]["sd"] = sd;
        
        // Calculate Target (MPS x 0.06) + MPS
        const target = (Number(mps) * 0.06 + Number(mps)).toFixed(2);
        newMpsData[trait]["target"] = target;
        
        console.log(`Calculated for ${trait}:`, {
          hs, ls, totalItems, mean, median, pl, mps, sd, target
        });
      });
      
      console.log("MPS data synced with LAEMPL:", newMpsData);
      return newMpsData;
    });
  }, [data, TRAITS]);

  // backend status -> compute locked
  const [status, setStatus] = useState(null);
  const locked = LOCK_STATUSES.has(Number(status));

  // FRONT-END override: allow editing after Clear/Import even if locked
  const [editOverride, setEditOverride] = useState(false);

  // single flag to disable inputs/actions
  // Temporarily disable locking to test editability
  const isDisabled = false; // locked && !editOverride;
  
  // Debug logging
  console.log("Debug - isDisabled:", isDisabled, "locked:", locked, "editOverride:", editOverride, "status:", status);

  // prevent late hydration from overwriting local edits/clears
  const touchedRef = useRef(false);
  const fileInput = useRef(null);

  // Fetch teacher's section and update traits
  useEffect(() => {
    const fetchTeacherSection = async () => {
      try {
        setLoading(true);
        
        // Get current user
        const userRes = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
        if (!userRes.ok) return;
        const userData = await userRes.json();
        setUser(userData);

        // Get teacher's section assignment
        const sectionRes = await fetch(`${API_BASE}/users/teacher-section/${userData.user_id}`, { 
          credentials: "include" 
        });
        
        if (sectionRes.ok) {
          const sectionData = await sectionRes.json();
          if (sectionData && sectionData.section) {
            setTeacherSection(sectionData);
            // Update traits to show only the teacher's section
            setTRAITS([sectionData.section]);
            
            // Update data state with only the teacher's section
            setData({
              [sectionData.section]: Object.fromEntries(dynamicCols.map((c) => [c.key, ""]))
            });
            
            // Update MPS data state with only the teacher's section
            setMpsData({
              [sectionData.section]: Object.fromEntries(COLS_MPS.map((c) => [c.key, ""]))
            });
          }
        }
      } catch (error) {
        console.error("Error fetching teacher section:", error);
        // Fallback to default traits if error
        setTRAITS(DEFAULT_TRAITS);
      } finally {
        setLoading(false);
      }
    };

    fetchTeacherSection();
  }, []);

  // Fetch submission data to get assigned subjects
  useEffect(() => {
    const fetchSubmissionData = async () => {
      try {
        console.log("Fetching submission data from:", `${API_BASE}/submissions/${SUBMISSION_ID}`);
        const res = await fetch(`${API_BASE}/submissions/${SUBMISSION_ID}`, {
          credentials: "include"
        });
        console.log("Response status:", res.status, "OK:", res.ok);
        if (!res.ok) {
          console.error("Failed to fetch submission data. Status:", res.status);
          return;
        }
        const data = await res.json();
        setSubmissionData(data);
        
        // Extract subjects from the submission fields
        console.log("Submission data:", data);
        console.log("Fields data:", data.fields);
        
        // Check if this is a coordinator submission OR if user is a coordinator
        const isCoordinatorSubmission = data.fields && data.fields.type === "LAEMPL_COORDINATOR";
        const isCoordinatorUser = user && user.role === "coordinator";
        
        if (isCoordinatorSubmission || isCoordinatorUser) {
        console.log("Coordinator view detected - submission type:", data.fields?.type, "user role:", user?.role);
          setIsCoordinatorView(true);
          
          // Use grade level from submission fields or default to 2
          const gradeLevelId = (data.fields && data.fields.grade) || 2;
          console.log("Using grade level:", gradeLevelId);
          
          // Use hardcoded sections for Grade 2 (these match the actual database sections)
          const sections = [
            { section_name: "Gumamela", section_id: 9 },
            { section_name: "Rosal", section_id: 10 },
            { section_name: "Rose", section_id: 8 },
            { section_name: "Sampaguita", section_id: 7 }
          ];
          console.log("Using hardcoded sections for Grade 2:", sections);
          
          setAllSections(sections);
          
          // Initialize data for all sections
          const newData = {};
          sections.forEach(section => {
            newData[section.section_name] = {};
            dynamicCols.forEach(col => {
              newData[section.section_name][col.key] = "";
            });
          });
          setData(newData);
          setTRAITS(sections.map(s => s.section_name));
          
          // Create dynamic columns for coordinator - check if there's subject data in consolidated data
          let newCols = [
            { key: "m", label: "M" },
            { key: "f", label: "F" }
          ];
          
          // Check if there's subject information in the consolidated data
          const hasSubjectData = Object.values(consolidatedData).some(section => section.subjects && section.subjects.length > 0);
          if (hasSubjectData) {
            // Find the first subject from consolidated data
            const firstSubject = Object.values(consolidatedData).find(section => section.subjects && section.subjects.length > 0);
            if (firstSubject && firstSubject.subjects && firstSubject.subjects.length > 0) {
              const subjectName = firstSubject.subjects[0];
              newCols.push({ key: "subject", label: `${subjectName} (15 - 25 points)` });
              console.log("DEBUG: Added subject column for coordinator:", subjectName);
            }
          }
          
          // Add remaining columns
          newCols.push(
            { key: "total_score", label: "Total Score" },
            { key: "hs", label: "HS" },
            { key: "ls", label: "LS" },
            { key: "total_items", label: "Total no. of Items" }
          );
          
          setDynamicCols(newCols);
          
          // Update COL_RULES for coordinator columns
          const newRules = {
            m: [0, 9999],
            f: [0, 9999],
            total_score: [0, 9999],
            hs: [0, 9999],
            ls: [0, 9999],
            total_items: [0, 9999]
          };
          
          // Add subject column rules if subject column exists
          if (newCols.some(col => col.key === "subject")) {
            newRules.subject = [0, 9999];
          }
          setDynamicColRules(newRules);
          
        } else if (data.fields && (data.fields.subject_id || data.fields.subject_name)) {
          const subjectId = data.fields.subject_id;
          const subjectName = data.fields.subject_name;
          console.log("Found subject:", subjectName, "with ID:", subjectId);
          
          // Create dynamic columns with the assigned subject, total score, HS, LS, and total items
          const newCols = [
            { key: "m", label: "M" },
            { key: "f", label: "F" },
            { key: `subject_${subjectId}`, label: `${subjectName} (15 - 25 points)` },
            { key: "total_score", label: "Total Score" },
            { key: "hs", label: "HS" },
            { key: "ls", label: "LS" },
            { key: "total_items", label: "Total no. of Items" }
          ];
          
          setDynamicCols(newCols);
          console.log("DEBUG: Set dynamic columns:", newCols);
          
          // Update COL_RULES for the new subject column, total score, HS, LS, and total items
          const newRules = {
            m: [0, 9999],
            f: [0, 9999],
            [`subject_${subjectId}`]: [0, 9999],
            total_score: [0, 9999],
            hs: [0, 9999],
            ls: [0, 9999],
            total_items: [0, 9999]
          };
          setDynamicColRules(newRules);
          
          // For teacher view, use the teacher's section name as the trait, not the subject name
          const sectionName = teacherSection?.section || "Default Section";
          setTRAITS([sectionName]);
          console.log("Updated TRAITS to teacher section:", [sectionName]);
          
          // Initialize data with the teacher's section name as the trait
          const newData = {};
          newData[sectionName] = {};
          newCols.forEach(col => {
            newData[sectionName][col.key] = "";
          });
          setData(newData);
          
          console.log("Dynamic columns updated, data initialized with teacher section as trait");
          console.log("New data structure:", newData);
          console.log("New TRAITS:", [sectionName]);
        } else {
          console.log("No subject data found in fields");
          console.log("Available fields keys:", data.fields ? Object.keys(data.fields) : "No fields");
          
          // Fallback: try to find subject data in other possible locations
          if (data.fields && data.fields.type === "LAEMPL") {
            console.log("Found LAEMPL type, checking for subject data in other fields");
            // Check if subject data is in a different structure
            const possibleSubjectKeys = ['subject', 'subjectName', 'subjectId', 'subject_name', 'subject_id'];
            possibleSubjectKeys.forEach(key => {
              if (data.fields[key]) {
                console.log(`Found ${key}:`, data.fields[key]);
              }
            });
          }
        }
      } catch (error) {
        console.error("Error fetching submission data:", error);
      }
    };
    
    console.log("SUBMISSION_ID value:", SUBMISSION_ID, "Type:", typeof SUBMISSION_ID);
    
    if (SUBMISSION_ID && SUBMISSION_ID !== "null" && SUBMISSION_ID !== "undefined" && SUBMISSION_ID !== "") {
      console.log("Fetching submission data for ID:", SUBMISSION_ID);
      fetchSubmissionData();
    } else {
      console.log("No valid submission ID provided. Using default columns.");
      console.log("SUBMISSION_ID details:", { value: SUBMISSION_ID, type: typeof SUBMISSION_ID });
    }
  }, [teacherSection]);

  const handleChange = (trait, colKey, value) => {
    touchedRef.current = true;
    // Only allow digits, prevent letters, negative numbers, and decimal points
    const cleaned = value.replace(/[^\d]/g, "");
    setData((prev) => ({
      ...prev,
      [trait]: { ...prev[trait], [colKey]: clampVal(colKey, cleaned, dynamicColRules) },
    }));
  };

  const handleKeyDown = (e) => {
    // Prevent letters, special characters, negative signs, and decimal points
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    const isNumber = e.key >= '0' && e.key <= '9';
    const isAllowedKey = allowedKeys.includes(e.key);
    
    if (!isNumber && !isAllowedKey) {
      e.preventDefault();
    }
  };

  const totals = dynamicCols.reduce((acc, c) => {
    acc[c.key] = TRAITS.reduce(
      (sum, t) => sum + (Number(data[t]?.[c.key]) || 0),
      0
    );
    return acc;
  }, {});

  const toRows = (obj) => {
    console.log("toRows called with:", { obj, submissionData, isCoordinatorView, TRAITS });
    
    // For teacher submissions, use the teacher's section name as the trait
    if (teacherSection?.section && !isCoordinatorView) {
      const sectionName = teacherSection.section;
      console.log("Using teacher section as trait:", sectionName);
      const row = { trait: sectionName };
      dynamicCols.forEach(col => {
        const value = obj[sectionName]?.[col.key];
        row[col.key] = value === "" ? null : Number(value) || 0;
      });
      console.log("Generated row for teacher:", row);
      return [row];
    }
    
    // For coordinator view or fallback, use TRAITS
    console.log("Using TRAITS for rows:", TRAITS);
    return TRAITS.map((trait) => {
      const row = { trait };
      dynamicCols.forEach(col => {
        const value = obj[trait]?.[col.key];
        row[col.key] = value === "" ? null : Number(value) || 0;
      });
      return row;
    });
  };

  const canSubmit = !!SUBMISSION_ID && SUBMISSION_ID !== "null" && SUBMISSION_ID !== "undefined" && SUBMISSION_ID !== null && !saving;

  // Validation function for LAEMPL report
  const validateLAEMPLForm = () => {
    const errors = [];
    
    // Check if all required fields are filled
    TRAITS.forEach(trait => {
      dynamicCols.forEach(col => {
        const value = data[trait][col.key];
        if (value === "" || value == null || value === undefined) {
          errors.push(`${trait} - ${col.label} is required`);
        }
      });
    });
    
    return errors;
  };

  const onSubmit = async () => {
    if (!SUBMISSION_ID || SUBMISSION_ID === "null" || SUBMISSION_ID === "undefined") {
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
      // Get grade from submission data or teacher's section
      const gradeLevel = submissionData?.fields?.grade || teacherSection?.grade_level || 2;
      
      const rows = toRows(data);
      console.log("=== FRONTEND SUBMIT DEBUG ===");
      console.log("Generated rows for submission:", rows);
      console.log("Current data state:", data);
      console.log("Current TRAITS:", TRAITS);
      console.log("Current submissionData:", submissionData);
      console.log("Current dynamicCols:", dynamicCols);
      console.log("Current isCoordinatorView:", isCoordinatorView);
      console.log("Current user role:", user?.role);
      console.log("Current grade level:", gradeLevel);
      console.log("Current totals:", totals);
      
      const payload = {
        status: 2, // status 2 = submitted
        grade: gradeLevel,  // use actual grade level
        rows: rows,
        totals: totals, // Include totals in the payload
        subject_id: submissionData?.fields?.subject_id,
        subject_name: submissionData?.fields?.subject_name,
      };
      
      console.log("Final payload:", payload);
      console.log("=== END FRONTEND SUBMIT DEBUG ===");
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
            Object.fromEntries(dynamicCols.map((c) => [c.key, ""])),
          ])
        );
        json.fields.rows.forEach((r) => {
          if (!r?.trait || !next[r.trait]) return;
          dynamicCols.forEach((c) => {
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
              Object.fromEntries(dynamicCols.map((c) => [c.key, ""])),
            ])
          );
          rows.forEach((r) => {
            if (!r?.trait || !next[r.trait]) return;
            dynamicCols.forEach((c) => {
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
    console.log("Exporting LAEMPL data:", { dynamicCols, data, totals });
    
    const header = ["Trait", ...dynamicCols.map((c) => c.label)];
    const rows = TRAITS.map((trait) => [
      trait,
      ...dynamicCols.map((c) => data[trait]?.[c.key] || ""),
    ]);
    const totalRow = ["Total", ...dynamicCols.map((c) => totals[c.key] || 0)];
    
    console.log("Export data:", { header, rows, totalRow });

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
    const header = ["Trait", ...dynamicCols.map((c) => c.label)];
    const blank = TRAITS.map((trait) => [trait, ...dynamicCols.map(() => "")]);
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
          Object.fromEntries(dynamicCols.map((c) => [c.key, ""])),
        ])
      );

      body.forEach((row) => {
        const trait = row[0];
        if (!TRAITS.includes(trait)) return;
        dynamicCols.forEach((c, i) => {
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
        Object.fromEntries(dynamicCols.map((c) => [c.key, ""])),
      ])
    );
    setData(blank);
  };

  const [open, setOpen] = useState(false);
  const [openSec, setOpenSec] = useState(false);

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
  // Default MPS traits - will be replaced with teacher's actual section
  const DEFAULT_TRAITS_MPS = ["Masipag","Matulungin","Masunurin","Magalang","Matapat","Matiyaga"];
  const COLS_MPS = [
    { key: "m",      label: "Male" },
    { key: "f",      label: "Female" },
    { key: "total",  label: "Total no. of Pupils" },
    { key: "total_score", label: "Total Score" },
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

  const [mpsData, setMpsData] = useState(() => {
    const initialMpsData = {};
    TRAITS.forEach(trait => {
      initialMpsData[trait] = {};
      COLS_MPS.forEach(col => {
        initialMpsData[trait][col.key] = "";
      });
    });
    return initialMpsData;
  });

  // Reinitialize MPS data when TRAITS changes
  useEffect(() => {
    setMpsData(prevData => {
      const newMpsData = {};
      TRAITS.forEach(trait => {
        newMpsData[trait] = {};
        COLS_MPS.forEach(col => {
          newMpsData[trait][col.key] = prevData[trait]?.[col.key] || "";
        });
      });
      return newMpsData;
    });
  }, [TRAITS]);

  const handleMpsChange = (trait, key, val) => {
    // Prevent changes to synced fields
    const syncedFields = ["m", "f", "total", "total_score", "mean", "hs", "ls", "total_items", "median", "pl", "mps", "sd", "target"];
    if (syncedFields.includes(key)) {
      console.log("Cannot edit synced field:", key);
      return;
    }
    
    mpsTouchedRef.current = true;
    // Only allow digits and decimal point, prevent letters and negative numbers
    const cleaned = val.replace(/[^\d.]/g, "");
    // If the value starts with a negative sign, remove it
    const noNegative = cleaned.replace(/^-/, "");
    setMpsData(prev => ({
      ...prev,
      [trait]: { ...prev[trait], [key]: noNegative },
    }));
  };

  const handleMpsKeyDown = (e) => {
    // Prevent letters, special characters, and negative signs
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    const isNumber = e.key >= '0' && e.key <= '9';
    const isDecimal = e.key === '.';
    const isAllowedKey = allowedKeys.includes(e.key);
    
    if (!isNumber && !isDecimal && !isAllowedKey) {
      e.preventDefault();
    }
  };

  const mpsTotals = COLS_MPS.reduce((acc, c) => {
    acc[c.key] = TRAITS.reduce(
      (sum, t) => sum + (Number(mpsData[t]?.[c.key]) || 0), 0
    );
    return acc;
  }, {});

  // Prefill MPS
  useEffect(() => {
    if (!SUBMISSION_ID || SUBMISSION_ID === "null" || SUBMISSION_ID === "undefined" || SUBMISSION_ID === null) {
      console.log("Skipping MPS fetch - no valid submission ID");
      return;
    }
    
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
            TRAITS.map(t => [t, Object.fromEntries(COLS_MPS.map(c => [c.key, ""]))])
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
    TRAITS.map(trait => {
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
    TRAITS.forEach(trait => {
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
    if (!SUBMISSION_ID || SUBMISSION_ID === "null" || SUBMISSION_ID === "undefined" || SUBMISSION_ID === null) {
      console.log("Cannot save MPS - no valid submission ID");
      setMpsErr("No valid submission ID");
      return;
    }
    
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
    const rows = TRAITS.map(trait => [
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
      TRAITS.map(t => [t, Object.fromEntries(COLS_MPS.map(c => [c.key, ""]))])
    );
    const header = ["Trait", ...COLS_MPS.map(c => c.label)];
    const rows = TRAITS.map(trait => [trait, ...COLS_MPS.map(c => blank[trait][c.key])]);
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
      TRAITS.map(t => [t, Object.fromEntries(COLS_MPS.map(c => [c.key, ""]))])
    );

    let imported = 0;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const firstCell = String(row[traitIdx] || "").trim();
      if (!firstCell) continue;
      if (firstCell.toLowerCase() === "total") break;
      if (!TRAITS.includes(firstCell)) continue;

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
      TRAITS.map(t => [t, Object.fromEntries(COLS_MPS.map(c => [c.key, ""]))])
    );
    setMpsData(blank);
  };

  // Open consolidate modal and fetch peer data
  const handleConsolidate = async () => {
    if (!isCoordinatorView) return;
    
    setConsolidateError("");
    setConsolidateSuccess("");
    
    try {
      // Fetch peer LAEMPL & MPS data
      const url = `${API_BASE}/reports/laempl-mps/${SUBMISSION_ID}/peers`;
      console.log("[Consolidate] Fetching peer data from:", url);
      
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed to load peer data: ${res.status} ${txt}`);
      }
      
      const peerData = await res.json();
      console.log("[Consolidate] Peer data received:", peerData);
      
      setPeerData(Array.isArray(peerData) ? peerData : []);
      setShowConsolidate(true);
    } catch (error) {
      console.error("[Consolidate] Error:", error);
      setConsolidateError(error.message || "Failed to load peer data");
    }
  };

  // Consolidate data from selected peers
  const consolidateFromPeers = async (selectedPeers) => {
    try {
      setConsolidateError("");
      
      console.log("Consolidating data from selected peers:", selectedPeers);
      
      // Initialize consolidated data for each section
      const consolidatedData = {};
      allSections.forEach(section => {
        consolidatedData[section.section_name] = {};
        dynamicCols.forEach(col => {
          consolidatedData[section.section_name][col.key] = 0;
        });
      });
      
      // Process each selected peer
      selectedPeers.forEach(peer => {
        console.log("Processing peer:", peer);
        
        try {
          const fields = typeof peer.fields === 'string' ? JSON.parse(peer.fields) : peer.fields;
          console.log("Parsed fields:", fields);
          
          // Get the section name from the peer data - ensure it matches our predefined sections
          let sectionName = peer.section_name || "Rosal"; // Default to Rosal if not specified
          
          // Map peer section to our predefined sections if needed
          const predefinedSections = ["Gumamela", "Rosal", "Rose", "Sampaguita"];
          if (!predefinedSections.includes(sectionName)) {
            // If the peer section doesn't match our predefined sections, default to Rosal
            sectionName = "Rosal";
            console.log("Peer section", peer.section_name, "not in predefined sections, mapping to Rosal");
          }
          
          // Get the subject from report title or fields
          let subjectName = "";
          if (peer.report_title) {
            const titleParts = peer.report_title.split(" - ");
            subjectName = titleParts.length > 1 ? titleParts[titleParts.length - 1] : peer.report_title;
          } else if (fields?.subject_name) {
            subjectName = fields.subject_name;
          }
          
          console.log("Section:", sectionName, "Subject:", subjectName);
          
          // Only process if the section is in our predefined sections
          if (predefinedSections.includes(sectionName)) {
            // If this section doesn't exist in our consolidated data, create it
            if (!consolidatedData[sectionName]) {
              consolidatedData[sectionName] = {};
              dynamicCols.forEach(col => {
                consolidatedData[sectionName][col.key] = 0;
              });
            }
            
            // Process the peer's data
            if (fields?.rows && Array.isArray(fields.rows)) {
              // Sum up data from all rows in this peer's submission
              fields.rows.forEach(row => {
                dynamicCols.forEach(col => {
                  const value = Number(row[col.key]) || 0;
                  consolidatedData[sectionName][col.key] += value;
                });
                
                // Also extract subject-specific scores
                Object.keys(row).forEach(key => {
                  if (key.startsWith('subject_') && row[key] !== null && row[key] !== '') {
                    const subjectScore = Number(row[key]) || 0;
                    const subjectKey = key; // Use the original key like 'subject_10'
                    
                    if (!consolidatedData[sectionName][subjectKey]) {
                      consolidatedData[sectionName][subjectKey] = 0;
                    }
                    consolidatedData[sectionName][subjectKey] += subjectScore;
                    console.log("DEBUG: Added subject score for", sectionName, key, ":", subjectScore, "Total:", consolidatedData[sectionName][subjectKey]);
                  }
                });
              });
            }
            // Add subject information to the consolidated data
            if (subjectName) {
              // Store subject info in a special field for display
              if (!consolidatedData[sectionName].subjects) {
                consolidatedData[sectionName].subjects = [];
              }
              if (!consolidatedData[sectionName].subjects.includes(subjectName)) {
                consolidatedData[sectionName].subjects.push(subjectName);
              }
            }
          } else {
            console.log("Skipping peer data for non-predefined section:", sectionName);
            return; // Skip this peer
          }
          
        } catch (parseError) {
          console.error("Error parsing peer fields:", parseError);
        }
      });
      
      console.log("Consolidated data:", consolidatedData);
      
      // Update the current data with consolidated values
      const newData = { ...data };
      allSections.forEach(section => {
        const sectionName = section.section_name;
        if (consolidatedData[sectionName]) {
          if (!newData[sectionName]) newData[sectionName] = {};
          dynamicCols.forEach(col => {
            newData[sectionName][col.key] = consolidatedData[sectionName][col.key].toString();
          });
          
          // Copy all subject scores that exist in consolidated data
          Object.keys(consolidatedData[sectionName]).forEach(key => {
            if (key.startsWith('subject_') && key !== 'subjects') {
              const subjectScore = consolidatedData[sectionName][key] || 0;
              newData[sectionName][key] = subjectScore.toString();
              console.log("DEBUG: Copied subject score for", sectionName, key, ":", subjectScore);
            }
          });
        }
      });
      
      setData(newData);
      setConsolidatedData(consolidatedData);
      
      // Update columns to include ALL subject columns if subjects were found
      const hasSubjectData = Object.values(consolidatedData).some(section => 
        Object.keys(section).some(key => key.startsWith('subject_') && key !== 'subjects')
      );
      
      if (hasSubjectData) {
        // Collect all unique subject keys from all sections
        const allSubjectKeys = new Set();
        Object.values(consolidatedData).forEach(section => {
          Object.keys(section).forEach(key => {
            if (key.startsWith('subject_') && key !== 'subjects') {
              allSubjectKeys.add(key);
            }
          });
        });
        
        console.log("DEBUG: Found unique subject keys:", Array.from(allSubjectKeys));
        
        // Create columns for each subject key
        const updatedCols = [
          { key: "m", label: "M" },
          { key: "f", label: "F" }
        ];
        
        // Add a column for each unique subject key
        Array.from(allSubjectKeys).forEach(subjectKey => {
          // Try to find the actual subject name from selected peers
          let subjectName = subjectKey.replace('subject_', 'Subject ');
          
          // Look through selected peers to find the actual subject name for this key
          selectedPeers.forEach(peer => {
            try {
              const fields = typeof peer.fields === 'string' ? JSON.parse(peer.fields) : peer.fields;
              if (fields && fields.subject_name && fields.subject_id) {
                const peerSubjectKey = `subject_${fields.subject_id}`;
                if (peerSubjectKey === subjectKey) {
                  subjectName = fields.subject_name;
                  console.log("DEBUG: Found subject name for", subjectKey, ":", subjectName);
                }
              }
            } catch (e) {
              console.log("DEBUG: Error parsing peer fields:", e);
            }
          });
          
          updatedCols.push({ 
            key: subjectKey, 
            label: `${subjectName} (15 - 25 points)` 
          });
          console.log("DEBUG: Adding subject column:", subjectKey, "with label:", subjectName);
        });
        
        // Add remaining columns
        updatedCols.push(
          { key: "total_score", label: "Total Score" },
          { key: "hs", label: "HS" },
          { key: "ls", label: "LS" },
          { key: "total_items", label: "Total no. of Items" }
        );
        
        setDynamicCols(updatedCols);
        
        // Update column rules for all subjects
        const updatedRules = {
          m: [0, 9999],
          f: [0, 9999],
          total_score: [0, 9999],
          hs: [0, 9999],
          ls: [0, 9999],
          total_items: [0, 9999]
        };
        
        // Add rules for each subject column
        Array.from(allSubjectKeys).forEach(subjectKey => {
          updatedRules[subjectKey] = [0, 9999];
        });
        
        setDynamicColRules(updatedRules);
      }
      
      // Update MPS data with consolidated values
      const newMpsData = {};
      allSections.forEach(section => {
        const sectionName = section.section_name;
        newMpsData[sectionName] = {};
        COLS_MPS.forEach(col => {
          if (col.key === "m") newMpsData[sectionName][col.key] = newData[sectionName]?.["m"] || "";
          else if (col.key === "f") newMpsData[sectionName][col.key] = newData[sectionName]?.["f"] || "";
          else if (col.key === "total") {
            const male = Number(newData[sectionName]?.["m"]) || 0;
            const female = Number(newData[sectionName]?.["f"]) || 0;
            newMpsData[sectionName][col.key] = (male + female).toString();
          }
          else if (col.key === "total_score") newMpsData[sectionName][col.key] = newData[sectionName]?.["total_score"] || "";
          else if (col.key === "hs") newMpsData[sectionName][col.key] = newData[sectionName]?.["hs"] || "";
          else if (col.key === "ls") newMpsData[sectionName][col.key] = newData[sectionName]?.["ls"] || "";
          else if (col.key === "total_items") newMpsData[sectionName][col.key] = newData[sectionName]?.["total_items"] || "";
          else if (col.key === "mean") {
            const totalScore = Number(newData[sectionName]?.["total_score"]) || 0;
            const male = Number(newData[sectionName]?.["m"]) || 0;
            const female = Number(newData[sectionName]?.["f"]) || 0;
            const totalPupils = male + female;
            const mean = totalPupils > 0 ? (totalScore / totalPupils).toFixed(2) : "0.00";
            newMpsData[sectionName][col.key] = mean;
          }
          else if (col.key === "median") {
            const hs = Number(newData[sectionName]?.["hs"]) || 0;
            const ls = Number(newData[sectionName]?.["ls"]) || 0;
            const median = ((hs + ls) / 2).toFixed(2);
            newMpsData[sectionName][col.key] = median;
          }
          else if (col.key === "pl") {
            const mean = Number(newMpsData[sectionName]["mean"]) || 0;
            const totalItems = Number(newData[sectionName]?.["total_items"]) || 0;
            const pl = totalItems > 0 ? ((mean / totalItems) * 100).toFixed(2) : "0.00";
            newMpsData[sectionName][col.key] = pl;
          }
          else if (col.key === "mps") {
            const pl = Number(newMpsData[sectionName]["pl"]) || 0;
            const mps = ((100 - pl) * 0.02 + pl).toFixed(2);
            newMpsData[sectionName][col.key] = mps;
          }
          else if (col.key === "sd") {
            const mean = Number(newMpsData[sectionName]["mean"]) || 0;
            const sd = Math.sqrt(mean).toFixed(2);
            newMpsData[sectionName][col.key] = sd;
          }
          else if (col.key === "target") {
            const mps = Number(newMpsData[sectionName]["mps"]) || 0;
            const target = (mps * 0.06 + mps).toFixed(2);
            newMpsData[sectionName][col.key] = target;
          }
          else {
            newMpsData[sectionName][col.key] = "";
          }
        });
      });
      
      setMpsData(newMpsData);
      setShowConsolidate(false);
      
      // Create success message with subject information
      const subjectsList = selectedPeers.map(peer => {
        const titleParts = peer.report_title ? peer.report_title.split(" - ") : [];
        return titleParts.length > 1 ? titleParts[titleParts.length - 1] : "Unknown";
      }).join(", ");
      
      setConsolidateSuccess(`Successfully consolidated data from ${selectedPeers.length} peer submissions. Subjects: ${subjectsList}`);
      
    } catch (error) {
      console.error("[Consolidate] Error consolidating:", error);
      setConsolidateError(error.message || "Failed to consolidate data");
    }
  };

  try {
    
    // Simple test render first
    if (loading) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Loading LAEMPL Report...</h2>
          <p>Please wait while we load your report data.</p>
        </div>
      );
    }
    
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
              {/* Consolidate button for coordinator view */}
              {isCoordinatorView && (
                <button onClick={handleConsolidate}>Consolidate</button>
              )}
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
              {console.log("DEBUG: About to render LAEMPL table - isCoordinatorView:", isCoordinatorView, "allSections:", allSections, "dynamicCols:", dynamicCols)}
              <table className="laempl-table">
                <caption>
                  {isCoordinatorView 
                    ? `Grade ${submissionData?.fields?.grade || 2} - All Sections - LAEMPL (Coordinator View)`
                    : teacherSection 
                      ? `Grade ${teacherSection.grade_level} - ${teacherSection.section} - LAEMPL` 
                      : 'Grade 1 - LAEMPL'
                  }
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="row-head">&nbsp;</th>
                    {dynamicCols.map((col) => {
                      console.log("DEBUG: Rendering LAEMPL column header:", col.key, col.label);
                      return (
                        <th key={col.key} scope="col">{col.label}</th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {isCoordinatorView ? (
                    // Coordinator view: show all sections
                    allSections.map((section, index) => {
                      console.log("DEBUG: Rendering LAEMPL row for section:", section, "section_name:", section.section_name);
                      console.log("DEBUG: Full allSections array:", allSections);
                      return (
                        <tr key={section.section_id || index}>
                          <th scope="row" className="row-head">{(() => {
                            console.log("DEBUG: About to render section name:", section.section_name);
                            return section.section_name;
                          })()}</th>
                          {dynamicCols.map((col) => (
                          <td key={col.key}>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max={dynamicColRules[col.key]?.[1]}
                              step="1"
                              value={String(data[section.section_name]?.[col.key] || "")}
                              onChange={(e) => {
                                console.log("Input changed:", section.section_name, col.key, e.target.value);
                                handleChange(section.section_name, col.key, e.target.value);
                              }}
                              onKeyDown={handleKeyDown}
                              className="cell-input"
                              disabled={false}
                            />
                          </td>
                        ))}
                        </tr>
                      );
                    })
                  ) : (
                    // Teacher view: show traits
                    TRAITS.map((trait) => (
                      <tr key={trait}>
                        <th scope="row" className="row-head">{trait}</th>
                        {dynamicCols.map((col) => (
                          <td key={col.key}>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max={dynamicColRules[col.key]?.[1]}
                              step="1"
                              value={String(data[trait]?.[col.key] || "")}
                              onChange={(e) => {
                                console.log("Input changed:", trait, col.key, e.target.value);
                                handleChange(trait, col.key, e.target.value);
                              }}
                              onKeyDown={handleKeyDown}
                              className="cell-input"
                              disabled={false}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  )}

                  <tr className="total-row">
                    <th scope="row" className="row-head">Total</th>
                    {dynamicCols.map((col) => (
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
                <caption>
                  {isCoordinatorView 
                    ? `Grade ${submissionData?.fields?.grade || 2} - All Sections - MPS (Coordinator View)`
                    : teacherSection 
                      ? `Grade ${teacherSection.grade_level} - ${teacherSection.section} - MPS` 
                      : 'Grade 1 - MPS'
                  }
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="row-head"> </th>
                    {COLS_MPS.map(col => (
                      <th key={col.key} scope="col">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isCoordinatorView ? (
                    // Coordinator view: show all sections
                    allSections.map((section, index) => {
                      console.log("DEBUG: Rendering MPS row for section:", section, "section_name:", section.section_name);
                      console.log("DEBUG: Full allSections array in MPS:", allSections);
                      return (
                        <tr key={section.section_id || index}>
                          <th scope="row" className="row-head">{(() => {
                            console.log("DEBUG: About to render MPS section name:", section.section_name);
                            return section.section_name;
                          })()}</th>
                        {COLS_MPS.map(col => {
                          // Fields that are synced from LAEMPL should be read-only
                          const isSyncedField = ["m", "f", "total", "total_score", "mean", "hs", "ls", "total_items", "median", "pl", "mps", "sd", "target"].includes(col.key);
                          return (
                            <td key={col.key}>
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                step="any"
                                value={mpsData[section.section_name]?.[col.key] ?? ""}
                                onChange={(e) => handleMpsChange(section.section_name, col.key, e.target.value)}
                                onKeyDown={handleMpsKeyDown}
                                className="cell-input"
                                disabled={mpsDisabled || isSyncedField}
                                style={{
                                  backgroundColor: isSyncedField ? "#f5f5f5" : "white",
                                  cursor: isSyncedField ? "not-allowed" : "text"
                                }}
                                title={isSyncedField ? "This field is automatically calculated from LAEMPL data" : ""}
                              />
                            </td>
                          );
                        })}
                        </tr>
                      );
                    })
                  ) : (
                    // Teacher view: show traits
                    TRAITS.map(trait => (
                      <tr key={trait}>
                        <th scope="row" className="row-head">{trait}</th>
                        {COLS_MPS.map(col => {
                          // Fields that are synced from LAEMPL should be read-only
                          const isSyncedField = ["m", "f", "total", "total_score", "mean", "hs", "ls", "total_items", "median", "pl", "mps", "sd", "target"].includes(col.key);
                          return (
                            <td key={col.key}>
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                step="any"
                                value={mpsData[trait]?.[col.key] ?? ""}
                                onChange={(e) => handleMpsChange(trait, col.key, e.target.value)}
                                onKeyDown={handleMpsKeyDown}
                                className="cell-input"
                                disabled={mpsDisabled || isSyncedField}
                                style={{
                                  backgroundColor: isSyncedField ? "#f5f5f5" : "white",
                                  cursor: isSyncedField ? "not-allowed" : "text"
                                }}
                                title={isSyncedField ? "This field is automatically calculated from LAEMPL data" : ""}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
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
      {/* Consolidate Modal */}
      {showConsolidate && (
        <div className="modal-overlay">
          <div className="import-popup" style={{ maxWidth: 1000, width: "90%" }}>
            <div className="popup-header">
              <h2>Consolidate LAEMPL & MPS Reports</h2>
              <button className="close-button" onClick={() => setShowConsolidate(false)}>X</button>
            </div>
            <hr />
            {!!consolidateError && (
              <div style={{ marginBottom: 10, color: '#b91c1c', background: '#fee2e2', border: '1px solid #fecaca', padding: 8, borderRadius: 6 }}>
                {consolidateError}
              </div>
            )}
            {!!consolidateSuccess && (
              <div style={{ marginBottom: 10, color: '#059669', background: '#d1fae5', border: '1px solid #a7f3d0', padding: 8, borderRadius: 6 }}>
                {consolidateSuccess}
              </div>
            )}
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              {peerData.length === 0 ? (
                <p style={{ opacity: 0.8 }}>No submitted peer reports to consolidate.</p>
              ) : (
                <div>
                  <p style={{ marginBottom: 15, fontWeight: 'bold' }}>
                    Select peer submissions to consolidate into this report:
                  </p>
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ddd" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f8f9fa" }}>
                        <th style={{ padding: 12, border: "1px solid #ddd", textAlign: "left" }}>Select</th>
                        <th style={{ padding: 12, border: "1px solid #ddd", textAlign: "left" }}>Teacher</th>
                        <th style={{ padding: 12, border: "1px solid #ddd", textAlign: "left" }}>Grade</th>
                        <th style={{ padding: 12, border: "1px solid #ddd", textAlign: "left" }}>Section</th>
                        <th style={{ padding: 12, border: "1px solid #ddd", textAlign: "left" }}>Subjects</th>
                        <th style={{ padding: 12, border: "1px solid #ddd", textAlign: "left" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {peerData.map((peer, index) => (
                        <tr key={peer.submission_id || index}>
                          <td style={{ padding: 12, border: "1px solid #ddd", textAlign: "center" }}>
                            <input 
                              type="checkbox" 
                              id={`peer-${index}`}
                              onChange={(e) => {
                                // Handle selection logic here
                                console.log("Selected peer:", peer, e.target.checked);
                              }}
                            />
                          </td>
                          <td style={{ padding: 12, border: "1px solid #ddd" }}>
                            {peer.teacher_name || "Unknown Teacher"}
                          </td>
                          <td style={{ padding: 12, border: "1px solid #ddd" }}>
                            Grade {peer.grade_level || "Unknown"}
                          </td>
                          <td style={{ padding: 12, border: "1px solid #ddd" }}>
                            {peer.section_name || "Unknown Section"}
                          </td>
                          <td style={{ padding: 12, border: "1px solid #ddd" }}>
                            {(() => {
                              try {
                                const fields = typeof peer.fields === 'string' ? JSON.parse(peer.fields) : peer.fields;
                                
                                // First try to get subject from fields
                                if (fields?.subjects && Array.isArray(fields.subjects)) {
                                  return fields.subjects.map(s => s.subject_name).join(", ");
                                } else if (fields?.subject_name) {
                                  return fields.subject_name;
                                }
                                
                                // If no subject in fields, try to extract from report title
                                if (peer.report_title) {
                                  // Extract subject from title like "LAEMPL & MPS - MAPEH" -> "MAPEH"
                                  // or "LAEMPL - MTB" -> "MTB"
                                  const titleParts = peer.report_title.split(" - ");
                                  if (titleParts.length > 1) {
                                    return titleParts[titleParts.length - 1];
                                  }
                                  // If no " - " separator, try to extract from the end
                                  const words = peer.report_title.split(" ");
                                  if (words.length > 1) {
                                    return words[words.length - 1];
                                  }
                                  return peer.report_title;
                                }
                                
                                return "No subjects";
                              } catch (e) {
                                return "No subjects";
                              }
                            })()}
                          </td>
                          <td style={{ padding: 12, border: "1px solid #ddd" }}>
                            <span style={{ 
                              padding: "4px 8px", 
                              borderRadius: "4px", 
                              backgroundColor: peer.status >= 2 ? "#d1fae5" : "#fef3c7",
                              color: peer.status >= 2 ? "#059669" : "#d97706"
                            }}>
                              {peer.status >= 2 ? "Submitted" : "Draft"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button 
                      className="btn" 
                      onClick={() => setShowConsolidate(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      className="btn primary" 
                      onClick={() => {
                        // Get selected peers and consolidate
                        const selectedPeers = peerData.filter((_, index) => {
                          const checkbox = document.getElementById(`peer-${index}`);
                          return checkbox?.checked;
                        });
                        if (selectedPeers.length > 0) {
                          consolidateFromPeers(selectedPeers);
                        } else {
                          setConsolidateError("Please select at least one peer submission to consolidate.");
                        }
                      }}
                    >
                      Consolidate Selected
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  );
  } catch (error) {
    console.error("Error rendering LAEMPLReport:", error);
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Error Loading LAEMPL Report</h2>
        <p>There was an error loading the report. Please check the console for details.</p>
        <p>Error: {error.message}</p>
      </div>
    );
  }
}

export default LAEMPLReport;
