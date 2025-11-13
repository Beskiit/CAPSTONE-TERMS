import React, { useState, useEffect, useRef } from "react";
import Header from "../../components/shared/Header.jsx";
import Breadcrumb from "../../components/Breadcrumb.jsx";
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import "./LAEMPLReport.css";
import toast from "react-hot-toast";

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
  
  // Report assignment tracking for parent-child linking
  const [reportAssignmentId, setReportAssignmentId] = useState(null);
  const [parentAssignmentId, setParentAssignmentId] = useState(null);
  
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
        } else {
          // If no teacher-section assignment (e.g., 404), fall back gracefully
          setTeacherSection(null);
          setTRAITS(DEFAULT_TRAITS);
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
        
        // Store report assignment IDs for parent-child linking
        setReportAssignmentId(data?.report_assignment_id ?? null);
        // Get parent_assignment_id and grade_level_id from the report_assignment if available
        let assignmentGradeLevelId = null;
        let raData = null;
        
        if (data?.report_assignment_id) {
          try {
            // Fetch user data if not already available
            let currentUser = user;
            if (!currentUser) {
              try {
                const userRes = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
                if (userRes.ok) {
                  currentUser = await userRes.json();
                }
              } catch (err) {
                console.warn("Failed to fetch user data:", err);
              }
            }
            
            const raRes = await fetch(`${API_BASE}/reports/assignment/${data.report_assignment_id}`, {
              credentials: "include"
            });
            if (raRes.ok) {
              raData = await raRes.json();
              assignmentGradeLevelId = raData?.grade_level_id;
              console.log("[LAEMPLReport] Assignment grade level:", assignmentGradeLevelId);
              
              // For coordinator submissions, the coordinator's report_assignment_id IS the parent
              // Determine if this is a coordinator submission based on submission type only
              // Don't check user role - submission type is the source of truth
              const isCoordinatorSubmission = data.fields && data.fields.type === "LAEMPL_COORDINATOR";
              console.log("[LAEMPLReport] Setting parent assignment - isCoordinatorSubmission:", isCoordinatorSubmission, "user role:", currentUser?.role, "submission type:", data.fields?.type);
              if (isCoordinatorSubmission) {
                // Coordinator's own assignment is the parent - use it to find child assignments
                console.log("[LAEMPLReport] Setting parentAssignmentId to coordinator's report_assignment_id:", data.report_assignment_id);
                setParentAssignmentId(data.report_assignment_id);
              } else {
                // For teacher submissions, use the parent_report_assignment_id from the report assignment
                console.log("[LAEMPLReport] Setting parentAssignmentId from report assignment:", raData?.parent_report_assignment_id);
                setParentAssignmentId(raData?.parent_report_assignment_id ?? null);
              }
            }
          } catch (err) {
            console.warn("Failed to fetch assignment data:", err);
          }
        }
        
        // Extract subjects from the submission fields
        console.log("Submission data:", data);
        console.log("Fields data:", data.fields);
        
        // Determine view type based on whether coordinator is the assigned coordinator for this assignment
        // If coordinator is NOT the assigned coordinator, they're acting as a teacher → teacher view
        // If coordinator IS the assigned coordinator → coordinator view
        const determineViewType = async () => {
          // Fetch user data if not already available
          let currentUser = user;
          if (!currentUser) {
            try {
              const userRes = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
              if (userRes.ok) {
                currentUser = await userRes.json();
              }
            } catch (err) {
              console.warn("Failed to fetch user data:", err);
            }
          }
          
          const isCoordinatorSubmission = data.fields && data.fields.type === "LAEMPL_COORDINATOR";
          const isCoordinatorUser = currentUser && currentUser.role === "coordinator";
          
          // If submission type is explicitly "LAEMPL_COORDINATOR", use coordinator view
          // Otherwise, check if coordinator is the assigned coordinator for this assignment
          let shouldUseCoordinatorView = false;
          
          if (isCoordinatorSubmission) {
            // Explicit coordinator submission type
            shouldUseCoordinatorView = true;
            console.log("[LAEMPLReport] Coordinator view - explicit submission type: LAEMPL_COORDINATOR");
            // Ensure parent assignment points to this coordinator assignment
            setParentAssignmentId((prev) => prev ?? data.report_assignment_id);
          } else if (isCoordinatorUser && raData) {
            // Check if current coordinator is the assigned coordinator for this assignment
            const assignmentCoordinatorId = raData?.coordinator_user_id;
            const currentUserId = currentUser?.user_id;
            
            console.log("[LAEMPLReport] Assignment coordinator_user_id:", assignmentCoordinatorId, "Current user ID:", currentUserId);
            
            // If coordinator is the assigned coordinator for this assignment, use coordinator view
            // Otherwise, they're acting as a teacher (recipient) → use teacher view
            if (assignmentCoordinatorId != null && Number(assignmentCoordinatorId) === Number(currentUserId)) {
              shouldUseCoordinatorView = true;
              console.log("[LAEMPLReport] Coordinator view - user is the assigned coordinator for this assignment");
              // Coordinator's assignment is the parent for child teacher submissions
              setParentAssignmentId((prev) => prev ?? data.report_assignment_id);
            } else {
              console.log("[LAEMPLReport] Teacher view - coordinator is acting as a teacher (not the assigned coordinator)");
            }
          }
          
          if (shouldUseCoordinatorView) {
            console.log("[LAEMPLReport] Using coordinator view");
            setIsCoordinatorView(true);
          
            // Use grade level from assignment or submission fields or default to 2
            const gradeLevelId = assignmentGradeLevelId || (data.fields && data.fields.grade) || 2;
            console.log("Using grade level:", gradeLevelId);
            
            // Fetch sections dynamically from database based on grade level
            const fetchSectionsForGrade = async () => {
            try {
              const sectionsRes = await fetch(`${API_BASE}/sections/grade/${gradeLevelId}`, {
                credentials: "include"
              });
              
              if (sectionsRes.ok) {
                const sectionsData = await sectionsRes.json();
                console.log("Fetched sections for grade", gradeLevelId, ":", sectionsData);
                
                if (sectionsData && sectionsData.length > 0) {
                  // Map the database format to our expected format
                  const sections = sectionsData.map(s => ({
                    section_name: s.section_name || s.section,
                    section_id: s.section_id
                  }));
                  console.log("Using fetched sections for Grade", gradeLevelId, ":", sections);
                  setAllSections(sections);
                  return sections;
                } else {
                  console.warn("No sections found for grade", gradeLevelId, ", using fallback");
                  // Fallback to empty array or default sections
                  setAllSections([]);
                  return [];
                }
              } else {
                console.warn("Failed to fetch sections, status:", sectionsRes.status);
                setAllSections([]);
                return [];
              }
            } catch (err) {
              console.error("Error fetching sections:", err);
              setAllSections([]);
              return [];
            }
          };
          
            // Fetch sections and then initialize data
            fetchSectionsForGrade().then(sections => {
              if (sections.length > 0) {
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
            }
          });
          
          // Set a temporary empty array while fetching
          setAllSections([]);
        } else {
          // Teacher view - not coordinator view
          console.log("[LAEMPLReport] Using teacher view");
        }
      };
      
      // Call the async function to determine view type
      determineViewType();
      
      // Continue with teacher view logic if not coordinator view
      if (!isCoordinatorView) {
          
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
      toast.error("Missing submission ID. Please access this page from the assignment link.");
      return;
    }
    if (isDisabled) {
      setErr("This submission is locked and cannot be changed.");
      toast.error("This submission is locked and cannot be changed.");
      return;
    }

    // Validate form before saving
    const validationErrors = validateLAEMPLForm();
    if (validationErrors.length > 0) {
      const errorMsg = `Please fill all required fields: ${validationErrors.slice(0, 3).join(", ")}${validationErrors.length > 3 ? "..." : ""}`;
      setErr(errorMsg);
      toast.error("Please fill all required fields before submitting.");
      return;
    }

    setSaving(true);
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
        // Include MPS data in the same submission
        mps_rows: mpsToRows(),
        mps_totals: mpsToTotals(),
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
      toast.success("Report submitted successfuly!");

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
      toast.error("Failed to submit LAEMPL report. Please try again.");
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

  // Export CSV with both LAEMPL and MPS data
  const toCSV = () => {
    console.log("Exporting LAEMPL data:", { dynamicCols, data, totals });
    console.log("Exporting MPS data:", { mpsData, mpsTotals });
    
    const lines = [];
    
    // LAEMPL Report section
    lines.push("=== LAEMPL REPORT ===");
    const laemplHeader = ["Trait", ...dynamicCols.map((c) => c.label)];
    const laemplRows = TRAITS.map((trait) => [
      trait,
      ...dynamicCols.map((c) => data[trait]?.[c.key] || ""),
    ]);
    const laemplTotalRow = ["Total", ...dynamicCols.map((c) => totals[c.key] || 0)];
    
    const laemplLines = [laemplHeader, ...laemplRows, laemplTotalRow]
      .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","));
    lines.push(...laemplLines);
    
    // MPS Report section
    lines.push(""); // Empty line separator
    lines.push("=== MPS REPORT ===");
    const mpsHeader = ["Trait", ...COLS_MPS.map(c => c.label)];
    const mpsRows = TRAITS.map(trait => [
      trait,
      ...COLS_MPS.map(c => mpsData[trait][c.key] === "" ? "" : mpsData[trait][c.key])
    ]);
    const mpsTotalRow = ["Total", ...COLS_MPS.map(c => mpsTotals[c.key])];
    
    const mpsLines = [mpsHeader, ...mpsRows, mpsTotalRow]
      .map(r => r.map(esc => {
        const s = (esc ?? "").toString();
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(","));
    lines.push(...mpsLines);

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "LAEMPL_MPS_Grade1.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate blank template CSV with both LAEMPL and MPS tables
  const handleGenerateTemplate = () => {
    const lines = [];
    
    // LAEMPL Report section
    lines.push("=== LAEMPL REPORT ===");
    const laemplHeader = ["Trait", ...dynamicCols.map((c) => c.label)];
    const laemplBlank = TRAITS.map((trait) => [trait, ...dynamicCols.map(() => "")]);
    lines.push(laemplHeader.join(","));
    laemplBlank.forEach(row => lines.push(row.join(",")));
    
    // MPS Report section
    lines.push(""); // Empty line separator
    lines.push("=== MPS REPORT ===");
    const mpsHeader = ["Trait", ...COLS_MPS.map((c) => c.label)];
    const mpsBlank = TRAITS.map((trait) => [trait, ...COLS_MPS.map(() => "")]);
    lines.push(mpsHeader.join(","));
    mpsBlank.forEach(row => lines.push(row.join(",")));
    
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "LAEMPL_MPS_Template.csv";
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
      toast.success("File imported successfully!");
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
      toast.success("MPS data saved successfully!");
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
      toast.success(`Imported ${importedCount} row(s) successfully!`);
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
    if (!isCoordinatorView) {
      console.warn("[Consolidate] Not coordinator view, cannot consolidate");
      return;
    }
    
    console.log("[Consolidate] Starting consolidation...");
    console.log("[Consolidate] SUBMISSION_ID:", SUBMISSION_ID);
    console.log("[Consolidate] parentAssignmentId:", parentAssignmentId);
    console.log("[Consolidate] reportAssignmentId:", reportAssignmentId);
    console.log("[Consolidate] submissionData:", submissionData);
    
    setConsolidateError("");
    setConsolidateSuccess("");
    
    try {
      // Build URL with parent_assignment_id for coordinator view (similar to accomplishment reports)
      // Coordinator: use 'pra' (parent assignment) to get teacher submissions from child assignments
      // Teacher/Principal: use 'ra' (same assignment) or no parameter (default behavior)
      let url = `${API_BASE}/reports/laempl-mps/${SUBMISSION_ID}/peers`;
      
      if (isCoordinatorView && parentAssignmentId) {
        url += `?pra=${encodeURIComponent(parentAssignmentId)}`;
        console.log("[Consolidate] Using parent assignment ID:", parentAssignmentId);
      } else if (reportAssignmentId) {
        url += `?ra=${encodeURIComponent(reportAssignmentId)}`;
        console.log("[Consolidate] Using report assignment ID:", reportAssignmentId);
      } else {
        console.warn("[Consolidate] No parentAssignmentId or reportAssignmentId available!");
      }
      
      console.log("[Consolidate] Fetching from URL:", url);
      const res = await fetch(url, { credentials: "include" });
      
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("[Consolidate] Request failed:", res.status, txt);
        throw new Error(`Failed to load peer data: ${res.status} ${txt}`);
      }
      
      const peerData = await res.json();
      console.log("[Consolidate] Received peer data:", peerData);
      console.log("[Consolidate] Peer count:", Array.isArray(peerData) ? peerData.length : "not an array");
      
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
          
          // Get the section name from the peer data - ensure it matches our loaded sections
          let sectionName = peer.section_name || (allSections.length > 0 ? allSections[0].section_name : "Unknown");
          
          // Map peer section to our loaded sections if needed
          const loadedSectionNames = allSections.map(s => s.section_name);
          if (!loadedSectionNames.includes(sectionName)) {
            // If the peer section doesn't match our loaded sections, use the first available section
            if (allSections.length > 0) {
              sectionName = allSections[0].section_name;
              console.log("Peer section", peer.section_name, "not in loaded sections, mapping to", sectionName);
            } else {
              console.warn("No sections loaded, cannot map peer section:", peer.section_name);
              return; // Skip this peer if we can't map it (use return instead of continue in forEach)
            }
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
          
          // Only process if the section is in our loaded sections
          if (loadedSectionNames.includes(sectionName)) {
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
      
      // TODO: Generate AI Summary after successful consolidation (if needed)
      // await generateAISummary(selectedPeers, consolidatedData);
      
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
          <Breadcrumb />
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
              {/* Submit button */}
              <button
                type="submit"
                onClick={onSubmit}
                disabled={!canSubmit || isDisabled}
              >
                {saving ? "Saving..." : "Submit"}
              </button>
            </div>

            {/* status messages */}
            {loading && <div className="ok-text" style={{ marginTop: 8 }}>Loading...</div>}

            {/* DYNAMIC TABLE — LAEMPL */}
            <div className="table-wrap">
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
                    {dynamicCols.map((col) => (
                      <th key={col.key} scope="col">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isCoordinatorView ? (
                    // Coordinator view: show all sections
                    allSections.map((section, index) => (
                      <tr key={section.section_id || index}>
                        <th scope="row" className="row-head">{section.section_name}</th>
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
                                handleChange(section.section_name, col.key, e.target.value);
                              }}
                              onKeyDown={handleKeyDown}
                              className="cell-input"
                              disabled={false}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
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

                </tbody>
              </table>
            </div>


            {/* =========================
                SECOND TABLE — MPS
            ========================== */}
            <div className="dashboard-main" style={{ marginTop: 28 }}>
              <h2>MPS</h2>
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
                    allSections.map((section, index) => (
                      <tr key={section.section_id || index}>
                        <th scope="row" className="row-head">{section.section_name}</th>
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
                    ))
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
                </tbody>
              </table>
            </div>

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
