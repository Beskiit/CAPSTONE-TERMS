import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "../../components/shared/Header.jsx";
import Breadcrumb from "../../components/Breadcrumb.jsx";
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import "./LAEMPLReport.css";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

const API_BASE = import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com";

/* ===============================
   LAEMPL (your existing)
=============================== */
// Default traits - will be replaced with teacher's actual section
const DEFAULT_TRAITS = ["Masipag","Matulungin","Masunurin","Magalang","Matapat","Matiyaga"];

// Old COLS - kept for reference but not used
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

const clampVal = (k, v, colRules = COL_RULES) => {
  if (v === "" || v == null) return "";
  const n = Number(v);
  if (Number.isNaN(n)) return "";
  const [min, max] =
    colRules[k] || [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
  return Math.max(min, Math.min(max, n)).toString();
};

// statuses that lock the UI (submitted/approved)
const LOCK_STATUSES = new Set([2, 3]);

function LAEMPLReport() {
  const navigate = useNavigate();
  const location = useLocation();
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
  
  // Consolidation flagging: prevent re-consolidation
  const [hasUnsavedConsolidation, setHasUnsavedConsolidation] = useState(false); // Temporary flag (frontend only)
  const [isAlreadyConsolidated, setIsAlreadyConsolidated] = useState(false); // Permanent flag (from backend)
  
  // Track unsaved changes for beforeunload warning
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [originalData, setOriginalData] = useState(null);
  const [originalMpsData, setOriginalMpsData] = useState(null);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  
  // Track flag changes
  useEffect(() => {
    console.log('[Consolidation Flag] isAlreadyConsolidated changed to:', isAlreadyConsolidated);
  }, [isAlreadyConsolidated]);
  const [dynamicCols, setDynamicCols] = useState([
    { key: "m", label: "No. of Male" },
    { key: "f", label: "No. of Female" },
    { key: "no_of_cases", label: "No. of Cases" },
    { key: "no_of_items", label: "No. of Items" },
    { key: "total_score", label: "Total Score" },
    { key: "highest_score", label: "Highest Score" },
    { key: "lowest_score", label: "Lowest Score" },
    { key: "male_passed", label: "Number of Male Learners who Passed (MPL)" },
    { key: "male_mpl_percent", label: "% MPL (MALE)" },
    { key: "female_passed", label: "Number of Female who passed(MPL)" },
    { key: "female_mpl_percent", label: "% MPL(FEMALE)" },
    { key: "total_passed", label: "Number of Learners who Passed(MPL)" },
    { key: "total_mpl_percent", label: "% MPL(TOTAL)" }
  ]);
  const [dynamicColRules, setDynamicColRules] = useState({
    m: [0, 9999],
    f: [0, 9999],
    no_of_cases: [0, 9999],
    no_of_items: [0, 9999],
    total_score: [0, 9999],
    highest_score: [0, 9999],
    lowest_score: [0, 9999],
    male_passed: [0, 9999],
    male_mpl_percent: [0, 100],
    female_passed: [0, 9999],
    female_mpl_percent: [0, 100],
    total_passed: [0, 9999],
    total_mpl_percent: [0, 100]
  });
  const [loading, setLoading] = useState(true);

  // Get submission ID from URL parameters
  const SUBMISSION_ID = new URLSearchParams(window.location.search).get("id");

  // Dynamic traits based on teacher's section
  const [TRAITS, setTRAITS] = useState(DEFAULT_TRAITS);

  // table state - initialize with fixed LAEMPL columns
  const [data, setData] = useState(() => {
    const initialData = {};
    TRAITS.forEach(trait => {
      initialData[trait] = {};
      // Initialize with all required LAEMPL columns
      initialData[trait]["m"] = "";
      initialData[trait]["f"] = "";
      initialData[trait]["no_of_cases"] = "";
      initialData[trait]["no_of_items"] = "";
      initialData[trait]["total_score"] = "";
      initialData[trait]["highest_score"] = "";
      initialData[trait]["lowest_score"] = "";
      initialData[trait]["male_passed"] = "";
      initialData[trait]["male_mpl_percent"] = "";
      initialData[trait]["female_passed"] = "";
      initialData[trait]["female_mpl_percent"] = "";
      initialData[trait]["total_passed"] = "";
      initialData[trait]["total_mpl_percent"] = "";
    });
    return initialData;
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Reinitialize data when dynamicCols changes
  useEffect(() => {
    // Don't reinitialize if we're still loading or if data was just loaded
    if (loading) {
      return;
    }
    
    setData(prevData => {
      // Check if prevData has actual values (not all empty)
      const hasValues = Object.keys(prevData).some(key => {
        const sectionData = prevData[key];
        if (!sectionData || typeof sectionData !== 'object') return false;
        return Object.values(sectionData).some(val => val !== "" && val !== null && val !== undefined);
      });
      
      if (hasValues) {
        // Preserve existing data, only add missing columns
        const newData = { ...prevData };
        TRAITS.forEach(trait => {
          if (!newData[trait]) {
            newData[trait] = {};
          }
          dynamicCols.forEach(col => {
            // Only set if missing, preserve existing value
            if (!(col.key in newData[trait])) {
              newData[trait][col.key] = "";
            }
          });
        });
        return newData;
      } else {
        // Data is empty, safe to reinitialize
        const newData = {};
        TRAITS.forEach(trait => {
          newData[trait] = {};
          dynamicCols.forEach(col => {
            // Preserve existing value or use empty string for new columns
            newData[trait][col.key] = prevData[trait]?.[col.key] || "";
          });
        });
        return newData;
      }
    });
  }, [dynamicCols, TRAITS, loading]);

  // Sync MPS data with LAEMPL data
  useEffect(() => {
    // Don't sync if we're still loading or if there's no originalData (to avoid false positives)
    if (loading || !originalData) {
      return;
    }
    
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
        
        // Sync No. of Cases from LAEMPL (calculated as M + F)
        const noOfCases = male + female; // Use calculated value, not stored value
        
        // Sync Highest Score and Lowest Score from LAEMPL
        newMpsData[trait]["hs"] = data[trait]?.["highest_score"] || "";
        newMpsData[trait]["ls"] = data[trait]?.["lowest_score"] || "";
        
        // Sync No. of Items from LAEMPL
        newMpsData[trait]["total_items"] = data[trait]?.["no_of_items"] || "";
        
        // Sync Total Score from LAEMPL
        const totalScore = Number(data[trait]?.["total_score"]) || 0;
        newMpsData[trait]["total_score"] = totalScore.toString();
        
        // Calculate Mean (Total Score / Total Pupils)
        const totalPupils = male + female;
        const mean = totalPupils > 0 ? (totalScore / totalPupils).toFixed(2) : "0.00";
        newMpsData[trait]["mean"] = mean;
        
        // Get values for calculations
        const hs = Number(data[trait]?.["highest_score"]) || 0;
        const ls = Number(data[trait]?.["lowest_score"]) || 0;
        const totalItems = Number(data[trait]?.["no_of_items"]) || 0;
        
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
      });
      
      return newMpsData;
    });
  }, [data, TRAITS, loading, originalData]);

  // Auto-compute no_of_cases and MPL percentages
  useEffect(() => {
    if (loading || !originalData) {
      return;
    }
    
    setData(prevData => {
      const newData = { ...prevData };
      let hasChanges = false;
      
      TRAITS.forEach(trait => {
        if (!newData[trait]) {
          newData[trait] = {};
        }
        
        const male = Number(prevData[trait]?.["m"]) || 0;
        const female = Number(prevData[trait]?.["f"]) || 0;
        const malePassed = Number(prevData[trait]?.["male_passed"]) || 0;
        const femalePassed = Number(prevData[trait]?.["female_passed"]) || 0;
        
        // Calculate No. of Cases = M + F
        const noOfCases = male + female;
        const currentNoOfCases = Number(prevData[trait]?.["no_of_cases"]) || 0;
        if (noOfCases !== currentNoOfCases) {
          newData[trait]["no_of_cases"] = noOfCases.toString();
          hasChanges = true;
        }
        
        // Calculate Number of Learners who Passed = male_passed + female_passed
        const totalPassed = malePassed + femalePassed;
        const currentTotalPassed = Number(prevData[trait]?.["total_passed"]) || 0;
        if (totalPassed !== currentTotalPassed) {
          newData[trait]["total_passed"] = totalPassed.toString();
          hasChanges = true;
        }
        
        // Calculate % MPL (MALE) = (male_passed / m) * 100
        let maleMplPercent = "";
        if (male > 0) {
          maleMplPercent = ((malePassed / male) * 100).toFixed(2);
        }
        const currentMaleMpl = prevData[trait]?.["male_mpl_percent"] || "";
        if (maleMplPercent !== currentMaleMpl) {
          newData[trait]["male_mpl_percent"] = maleMplPercent;
          hasChanges = true;
        }
        
        // Calculate % MPL (FEMALE) = (female_passed / f) * 100
        let femaleMplPercent = "";
        if (female > 0) {
          femaleMplPercent = ((femalePassed / female) * 100).toFixed(2);
        }
        const currentFemaleMpl = prevData[trait]?.["female_mpl_percent"] || "";
        if (femaleMplPercent !== currentFemaleMpl) {
          newData[trait]["female_mpl_percent"] = femaleMplPercent;
          hasChanges = true;
        }
        
        // Calculate % MPL (TOTAL) = (total_passed / no_of_cases) * 100
        // Use the calculated noOfCases, not the stored value
        let totalMplPercent = "";
        if (noOfCases > 0) {
          totalMplPercent = ((totalPassed / noOfCases) * 100).toFixed(2);
        }
        const currentTotalMpl = prevData[trait]?.["total_mpl_percent"] || "";
        if (totalMplPercent !== currentTotalMpl) {
          newData[trait]["total_mpl_percent"] = totalMplPercent;
          hasChanges = true;
        }
      });
      
      // Only update if there are actual changes to prevent infinite loops
      return hasChanges ? newData : prevData;
    });
  }, [data, TRAITS, loading, originalData]);

  // backend status -> compute locked
  const [status, setStatus] = useState(null);
  const locked = LOCK_STATUSES.has(Number(status));

  // FRONT-END override: allow editing after Clear/Import even if locked (only when not submitted)
  const [editOverride, setEditOverride] = useState(false);

  // single flag to disable inputs/actions when submission is locked
  const isDisabled = locked && !editOverride;

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
        const res = await fetch(`${API_BASE}/submissions/${SUBMISSION_ID}`, {
          credentials: "include"
        });
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        setSubmissionData(data);
        
        // NOTE: Consolidation flag check is now done in the data loading useEffect
        // (where rows are actually loaded into the data state) to ensure we check
        // the actual loaded data, not just the raw rows from submissionData
        
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
              }
            }
            
            const raRes = await fetch(`${API_BASE}/reports/assignment/${data.report_assignment_id}`, {
              credentials: "include"
            });
            if (raRes.ok) {
              raData = await raRes.json();
              assignmentGradeLevelId = raData?.grade_level_id;
              
              // For coordinator submissions, the coordinator's report_assignment_id IS the parent
              // Determine if this is a coordinator submission based on submission type only
              // Don't check user role - submission type is the source of truth
              const isCoordinatorSubmission = data.fields && data.fields.type === "LAEMPL_COORDINATOR";
              if (isCoordinatorSubmission) {
                // Coordinator's own assignment is the parent - use it to find child assignments
                setParentAssignmentId(data.report_assignment_id);
              } else {
                // For teacher submissions, use the parent_report_assignment_id from the report assignment
                setParentAssignmentId(raData?.parent_report_assignment_id ?? null);
              }
            }
          } catch (err) {
          }
        }
        
        // Extract subjects from the submission fields
        
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
            // Ensure parent assignment points to this coordinator assignment
            setParentAssignmentId((prev) => prev ?? data.report_assignment_id);
          } else if (isCoordinatorUser && raData) {
            // Check if current coordinator is the assigned coordinator for this assignment
            const assignmentCoordinatorId = raData?.coordinator_user_id;
            const currentUserId = currentUser?.user_id;
            
            // If coordinator is the assigned coordinator for this assignment, use coordinator view
            // Otherwise, they're acting as a teacher (recipient) → use teacher view
            if (assignmentCoordinatorId != null && Number(assignmentCoordinatorId) === Number(currentUserId)) {
              shouldUseCoordinatorView = true;
              // Coordinator's assignment is the parent for child teacher submissions
              setParentAssignmentId((prev) => prev ?? data.report_assignment_id);
            }
          }
          
          if (shouldUseCoordinatorView) {
            setIsCoordinatorView(true);
          
            // Use grade level from assignment or submission fields or default to 2
            const gradeLevelId = assignmentGradeLevelId || (data.fields && data.fields.grade) || 2;
            
            // Fetch sections dynamically from database based on grade level
            const fetchSectionsForGrade = async () => {
            try {
              const sectionsRes = await fetch(`${API_BASE}/sections/grade/${gradeLevelId}`, {
                credentials: "include"
              });
              
              if (sectionsRes.ok) {
                const sectionsData = await sectionsRes.json();
                
                if (sectionsData && sectionsData.length > 0) {
                  // Map the database format to our expected format
                  const sections = sectionsData.map(s => ({
                    section_name: s.section_name || s.section,
                    section_id: s.section_id
                  }));
                  setAllSections(sections);
                  return sections;
                } else {
                  // Fallback to empty array or default sections
                  setAllSections([]);
                  return [];
                }
              } else {
                setAllSections([]);
                return [];
              }
            } catch (err) {
              setAllSections([]);
              return [];
            }
          };
          
            // Fetch sections and then initialize data
            fetchSectionsForGrade().then(sections => {
              if (sections.length > 0) {
                // Only initialize empty data if data is currently empty
                // Don't overwrite loaded data
                setData(prevData => {
                  // Check if prevData is empty
                  const isEmpty = Object.keys(prevData).length === 0 || 
                    Object.keys(prevData).every(key => {
                      const sectionData = prevData[key];
                      if (!sectionData || typeof sectionData !== 'object') return true;
                      return Object.values(sectionData).every(val => val === "" || val === null || val === undefined);
                    });
                  
                  if (isEmpty) {
                    // Initialize data for all sections
                    const newData = {};
                    sections.forEach(section => {
                      newData[section.section_name] = {};
                      dynamicCols.forEach(col => {
                        newData[section.section_name][col.key] = "";
                      });
                    });
                    return newData;
                  } else {
                    // Preserve existing data, only add missing sections
                    const newData = { ...prevData };
                    sections.forEach(section => {
                      if (!newData[section.section_name]) {
                        newData[section.section_name] = {};
                        dynamicCols.forEach(col => {
                          newData[section.section_name][col.key] = "";
                        });
                      }
                    });
                    return newData;
                  }
                });
                setTRAITS(sections.map(s => s.section_name));
              }
            });
          
          // Set a temporary empty array while fetching
          setAllSections([]);
        } else {
          // Teacher view - not coordinator view
        }
      };
      
      // Call the async function to determine view type
      determineViewType();
      
      // Continue with teacher view logic if not coordinator view
      // All views now use the same fixed columns
      if (!isCoordinatorView) {
        // For teacher view, use the teacher's section name as the trait
        const sectionName = teacherSection?.section || "Default Section";
        setTRAITS([sectionName]);
        
        // Initialize data with the teacher's section name as the trait
        const newData = {};
        newData[sectionName] = {};
        dynamicCols.forEach(col => {
          newData[sectionName][col.key] = "";
        });
        setData(newData);
      }
      } catch (error) {
      }
    };
    
    
    if (SUBMISSION_ID && SUBMISSION_ID !== "null" && SUBMISSION_ID !== "undefined" && SUBMISSION_ID !== "") {
      fetchSubmissionData();
    } else {
    }
  }, [teacherSection]);

  // Helper function to format percentage for display
  const formatPercentage = (value) => {
    if (value === "" || value == null || value === undefined) return "";
    const num = Number(value);
    if (isNaN(num)) return "";
    // Show 0% if value is 0, but don't show anything if empty
    return `${num}%`;
  };

  // Helper function to parse percentage from input (remove % symbol)
  const parsePercentage = (value) => {
    if (!value) return "";
    return value.toString().replace(/%/g, "").trim();
  };

  const handleChange = (trait, colKey, value) => {
    // Prevent editing of auto-calculated fields
    const calculatedFields = ['no_of_cases', 'total_passed', 'male_mpl_percent', 'female_mpl_percent', 'total_mpl_percent'];
    if (calculatedFields.includes(colKey)) {
      return; // Ignore changes to calculated fields
    }
    
    touchedRef.current = true;
    setIsFormSubmitted(false); // Reset submission flag when data changes
    console.log('[Unsaved Changes] Data changed:', { trait, colKey, value });
    
    // Check if this is a percentage column
    const isPercentageColumn = colKey.includes('mpl_percent');
    
    if (isPercentageColumn) {
      // For percentage columns, allow decimals and parse the value
      const cleaned = parsePercentage(value).replace(/[^\d.]/g, "");
      const numValue = cleaned === "" ? "" : clampVal(colKey, cleaned, dynamicColRules);
      setData((prev) => ({
        ...prev,
        [trait]: { ...prev[trait], [colKey]: numValue },
      }));
    } else {
      // For non-percentage columns, only allow digits
      const cleaned = value.replace(/[^\d]/g, "");
      setData((prev) => ({
        ...prev,
        [trait]: { ...prev[trait], [colKey]: clampVal(colKey, cleaned, dynamicColRules) },
      }));
    }
  };

  const handleKeyDown = (e, isPercentage = false) => {
    // Prevent letters, special characters, negative signs
    // For percentage columns, allow decimal points
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    const isNumber = e.key >= '0' && e.key <= '9';
    const isDecimal = isPercentage && e.key === '.';
    const isAllowedKey = allowedKeys.includes(e.key);
    
    if (!isNumber && !isDecimal && !isAllowedKey) {
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
    
    // For teacher submissions, use the teacher's section name as the trait
    if (teacherSection?.section && !isCoordinatorView) {
      const sectionName = teacherSection.section;
      const row = { trait: sectionName };
      dynamicCols.forEach(col => {
        const value = obj[sectionName]?.[col.key];
        row[col.key] = value === "" ? null : Number(value) || 0;
      });
      return [row];
    }
    
    // For coordinator view or fallback, use TRAITS
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
      setIsFormSubmitted(true);

      if (typeof json?.status !== "undefined") {
        setStatus(json.status);
        setMpsStatus(json.status);
      }

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
        // Update original data after successful submission
        const updatedOriginalData = JSON.parse(JSON.stringify(next));
        setOriginalData(updatedOriginalData);
        // Also update originalMpsData after successful submission
        setTimeout(() => {
          setMpsData(currentMpsData => {
            const updatedOriginalMpsData = JSON.parse(JSON.stringify(currentMpsData));
            setOriginalMpsData(updatedOriginalMpsData);
            console.log('[Unsaved Changes] Original MPS data updated after submission');
            return currentMpsData;
          });
        }, 100);
        console.log('[Unsaved Changes] Original data updated after submission');
      }

      // If consolidation was done and data was saved, set permanent flag
      if (hasUnsavedConsolidation && json?.fields?.rows && Array.isArray(json.fields.rows) && json.fields.rows.length > 0) {
        // Update submission with permanent consolidation flag
        const updatedFields = {
          ...json.fields,
          meta: {
            ...json.fields?.meta,
            consolidatedAt: new Date().toISOString(),
            isConsolidated: true
          }
        };
        
        // Save flag to backend
        try {
          await fetch(`${API_BASE}/submissions/${SUBMISSION_ID}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ fields: updatedFields })
          });
          // Keep isAlreadyConsolidated as true (it's now permanent)
        } catch (flagError) {
        }
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
      if (!SUBMISSION_ID) {
        return;
      }
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
        
        // Check consolidation flag AFTER loading data
        const isConsolidated = json?.fields?.meta?.isConsolidated;
        const consolidatedAt = json?.fields?.meta?.consolidatedAt;
        
        console.log('[Consolidation Flag] Initial check from backend:', { isConsolidated, consolidatedAt });
        
        if (Array.isArray(rows) && rows.length > 0) {
          if (touchedRef.current) return; // don't overwrite local edits

          // FIRST: Extract all traits from rows to determine the data structure
          const rowTraits = rows.map(r => r?.trait).filter(Boolean);
          
          // Check if row traits are section names (not default traits)
          // This works even if isCoordinatorView is false or allSections is empty
          const hasSectionNames = rowTraits.length > 0 && 
            rowTraits.some(t => !DEFAULT_TRAITS.includes(t));
          
          // Determine which traits to use
          let traitsToUse = [];
          if (hasSectionNames) {
            // Rows have section names (not default traits)
            // Use row traits directly, or match with allSections if available
            if (allSections.length > 0) {
              // Use section names from allSections, but verify rows match
              const sectionNames = allSections.map(s => s.section_name);
              const rowTraitsSet = new Set(rowTraits);
              const sectionNamesSet = new Set(sectionNames);
              
              // If all row traits are in section names, use section names
              // Otherwise, use row traits directly
              if ([...rowTraitsSet].every(t => sectionNamesSet.has(t))) {
                traitsToUse = sectionNames;
              } else {
                traitsToUse = rowTraits;
              }
            } else {
              // No allSections loaded, use row traits directly
              traitsToUse = rowTraits;
            }
            
            // Update TRAITS to match BEFORE loading data
            const traitsMatchCurrent = JSON.stringify([...TRAITS].sort()) === JSON.stringify([...traitsToUse].sort());
            if (!traitsMatchCurrent) {
              setTRAITS(traitsToUse);
            }
            
            // Create data structure using the determined traits
            const next = Object.fromEntries(
              traitsToUse.map((t) => [
                t,
                Object.fromEntries(dynamicCols.map((c) => [c.key, ""])),
              ])
            );
            
            // Load rows into the data structure
            let loadedRowsCount = 0;
            
            rows.forEach((r) => {
              if (!r?.trait) {
                return;
              }
              if (!next[r.trait]) {
                // Add the trait if it's not in our list
                next[r.trait] = Object.fromEntries(dynamicCols.map((c) => [c.key, ""]));
                traitsToUse.push(r.trait);
              }
              
              // Check if this is old data format (has old column names like gmrc, math, lang, etc.)
              const hasOldColumns = r.hasOwnProperty('gmrc') || r.hasOwnProperty('math') || r.hasOwnProperty('lang') || r.hasOwnProperty('read') || r.hasOwnProperty('makabasa');
              
              dynamicCols.forEach((c) => {
                const value = r[c.key];
                
                // Convert null/undefined to empty string, but preserve 0 values
                let stringValue;
                if (value === null || value === undefined) {
                  stringValue = "";
                } else if (value === 0) {
                  stringValue = "0"; // Preserve 0 as "0", not empty string
                } else {
                  stringValue = value.toString();
                }
                next[r.trait][c.key] = stringValue;
              });
              
              // If old data format detected, log a warning (but still load the data)
              if (hasOldColumns && loadedRowsCount === 0) {
                console.warn('[LAEMPL Data Migration] Detected old column structure in loaded data. New columns will be empty. Old data structure:', Object.keys(r));
              }
              
              loadedRowsCount++;
            });
            
            
            // Check if rows were successfully loaded
            const hasLoadedRows = rows && Array.isArray(rows) && rows.length > 0;
            const hasDataStructure = traitsToUse.length > 0 && Object.keys(next).length > 0;
            
            // Check if all values are empty/zero (data was cleared)
            // This checks all numeric columns across all traits/sections
            const hasAnyNonZeroValues = traitsToUse.some(trait => {
              const traitData = next[trait];
              if (!traitData) return false;
              // Check all keys except non-numeric fields
              return Object.keys(traitData).some(key => {
                if (key === 'subjects') return false; // Skip non-numeric fields
                const val = traitData[key];
                // Check if value is a non-empty, non-zero number
                if (val === null || val === undefined || val === '') return false;
                const numVal = Number(val);
                return !isNaN(numVal) && numVal !== 0;
              });
            });
            
            
            // Check consolidation flag AFTER data is loaded
            // Clear flag if: no rows loaded OR all values are empty/zero (data was cleared)
            console.log('[Consolidation Flag] Checking conditions:', { isConsolidated, hasLoadedRows, hasDataStructure, hasAnyNonZeroValues });
            if (isConsolidated && (!hasLoadedRows || !hasDataStructure || !hasAnyNonZeroValues)) {
              console.log('[Consolidation Flag] Setting isAlreadyConsolidated to false - Backend data check: no rows or all empty/zero');
              console.log('[Consolidation Flag] Reason:', { 
                noRows: !hasLoadedRows, 
                noStructure: !hasDataStructure, 
                noValues: !hasAnyNonZeroValues 
              });
              setIsAlreadyConsolidated(false);
              setHasUnsavedConsolidation(false);
              
              // Clear the flag from backend
              try {
                const currentFields = json?.fields || {};
                const updatedFields = {
                  ...currentFields,
                  meta: {
                    ...currentFields?.meta,
                    isConsolidated: false,
                    consolidatedAt: null
                  }
                };
                
                await fetch(`${API_BASE}/submissions/${SUBMISSION_ID}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ fields: updatedFields })
                });
              } catch (clearError) {
              }
            } else if (isConsolidated && hasLoadedRows && hasDataStructure && hasAnyNonZeroValues) {
              console.log('[Consolidation Flag] Setting isAlreadyConsolidated to true - Coordinator view: Backend has consolidated data with values');
              console.log('[Consolidation Flag] Check details:', { isConsolidated, hasLoadedRows, hasDataStructure, hasAnyNonZeroValues });
              setIsAlreadyConsolidated(true);
              setHasUnsavedConsolidation(false);
            } else {
              console.log('[Consolidation Flag] Not setting flag - Conditions:', { isConsolidated, hasLoadedRows, hasDataStructure, hasAnyNonZeroValues });
            }
            
            
            // Check if next has any non-empty values
            const hasNonEmptyValues = Object.keys(next).some(key => {
              const sectionData = next[key];
              if (!sectionData || typeof sectionData !== 'object') return false;
              return Object.values(sectionData).some(val => {
                const numVal = Number(val);
                return val !== "" && val !== null && val !== undefined && !isNaN(numVal) && numVal !== 0;
              });
            });
            
            // IMPORTANT: Always use loaded data if it has values, don't merge with empty state
            setData(prevData => {
              // Check if prevData is empty (all values are empty strings or 0)
              const prevIsEmpty = Object.keys(prevData).length === 0 || 
                Object.keys(prevData).every(key => {
                  const sectionData = prevData[key];
                  if (!sectionData || typeof sectionData !== 'object') return true;
                  return Object.values(sectionData).every(val => {
                    const numVal = Number(val);
                    return val === "" || val === null || val === undefined || (numVal === 0 && val !== "0");
                  });
                });
              
              // If we have loaded data with values, always use it (don't merge with empty state)
              if (hasNonEmptyValues || prevIsEmpty) {
                // Store original data when loading
                const dataToStore = JSON.parse(JSON.stringify(next));
                setOriginalData(dataToStore);
                console.log('[Unsaved Changes] Original data stored after loading (coordinator view):', { 
                  hasData: !!dataToStore,
                  dataKeys: Object.keys(dataToStore || {})
                });
                
                // Also set originalMpsData after a short delay to allow MPS sync to complete
                setTimeout(() => {
                  setMpsData(currentMpsData => {
                    const originalMpsDataCopy = JSON.parse(JSON.stringify(currentMpsData));
                    setOriginalMpsData(originalMpsDataCopy);
                    console.log('[Unsaved Changes] Original MPS data stored after LAEMPL load (coordinator view)');
                    return currentMpsData; // Don't change the data, just set the original
                  });
                }, 100);
                
                return next;
              } else {
                // Merge: use loaded data for keys that exist in next, preserve existing for others
                const merged = { ...prevData };
                Object.keys(next).forEach(key => {
                  merged[key] = { ...merged[key], ...next[key] };
                });
                // Store original data even when merging
                if (!originalData) {
                  const mergedOriginal = JSON.parse(JSON.stringify(merged));
                  setOriginalData(mergedOriginal);
                  console.log('[Unsaved Changes] Original data stored after merging');
                }
                return merged;
              }
            });
          } else {
            // Teacher view or default - use TRAITS
            const next = Object.fromEntries(
              TRAITS.map((t) => [
                t,
                Object.fromEntries(dynamicCols.map((c) => [c.key, ""])),
              ])
            );
            rows.forEach((r) => {
              if (!r?.trait || !next[r.trait]) {
                return;
              }
              dynamicCols.forEach((c) => {
                next[r.trait][c.key] = (r[c.key] ?? "").toString();
              });
            });
            
            // Check if rows were successfully loaded
            const hasLoadedRows = rows && Array.isArray(rows) && rows.length > 0;
            const hasDataStructure = TRAITS.length > 0 && Object.keys(next).length > 0;
            
            // Check if all values are empty/zero (data was cleared)
            // This checks all numeric columns across all traits
            const hasAnyNonZeroValues = TRAITS.some(trait => {
              const traitData = next[trait];
              if (!traitData) return false;
              // Check all keys except non-numeric fields
              return Object.keys(traitData).some(key => {
                if (key === 'subjects') return false; // Skip non-numeric fields
                const val = traitData[key];
                // Check if value is a non-empty, non-zero number
                if (val === null || val === undefined || val === '') return false;
                const numVal = Number(val);
                return !isNaN(numVal) && numVal !== 0;
              });
            });
            
            
            // Clear flag if: no rows loaded OR all values are empty/zero (data was cleared)
            if (isConsolidated && (!hasLoadedRows || !hasDataStructure || !hasAnyNonZeroValues)) {
              console.log('[Consolidation Flag] Setting isAlreadyConsolidated to false - Teacher view: no rows or all empty/zero');
              setIsAlreadyConsolidated(false);
              setHasUnsavedConsolidation(false);
              
              // Clear the flag from backend
              try {
                const currentFields = json?.fields || {};
                const updatedFields = {
                  ...currentFields,
                  meta: {
                    ...currentFields?.meta,
                    isConsolidated: false,
                    consolidatedAt: null
                  }
                };
                
                await fetch(`${API_BASE}/submissions/${SUBMISSION_ID}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ fields: updatedFields })
                });
              } catch (clearError) {
              }
            } else if (isConsolidated && hasLoadedRows && hasDataStructure && hasAnyNonZeroValues) {
              console.log('[Consolidation Flag] Setting isAlreadyConsolidated to true - Teacher view: Backend has consolidated data with values');
              setIsAlreadyConsolidated(true);
              setHasUnsavedConsolidation(false);
            }
            
            setData(next);
            // Store original data after loading for change detection
            const originalDataCopy = JSON.parse(JSON.stringify(next));
            setOriginalData(originalDataCopy);
            console.log('[Unsaved Changes] Original data stored after loading (teacher view):', { 
              hasData: !!originalDataCopy,
              dataKeys: Object.keys(originalDataCopy || {})
            });
            
            // Also set originalMpsData after a short delay to allow MPS sync to complete
            // This prevents false positives from MPS auto-calculation
            setTimeout(() => {
              setMpsData(currentMpsData => {
                const originalMpsDataCopy = JSON.parse(JSON.stringify(currentMpsData));
                setOriginalMpsData(originalMpsDataCopy);
                console.log('[Unsaved Changes] Original MPS data stored after LAEMPL load (teacher view)');
                return currentMpsData; // Don't change the data, just set the original
              });
            }, 100);
          }
        } else {
          // No rows or empty rows array - check if consolidation flag should be cleared
          // Set originalData to empty structure so change detection works
          const emptyData = {};
          TRAITS.forEach((t) => {
            emptyData[t] = Object.fromEntries(dynamicCols.map((c) => [c.key, ""]));
          });
          // Only set if we don't have originalData yet, or if current data matches empty structure
          if (!originalData) {
            setOriginalData(emptyData);
            console.log('[Unsaved Changes] Original data set to empty (no rows loaded)');
          }
          if (isConsolidated) {
            console.log('[Consolidation Flag] Setting isAlreadyConsolidated to false - No rows found in backend');
            setIsAlreadyConsolidated(false);
            setHasUnsavedConsolidation(false);
            
            // Clear the flag from backend
            try {
              const currentFields = json?.fields || {};
              const updatedFields = {
                ...currentFields,
                meta: {
                  ...currentFields?.meta,
                  isConsolidated: false,
                  consolidatedAt: null
                }
              };
              
              await fetch(`${API_BASE}/submissions/${SUBMISSION_ID}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ fields: updatedFields })
              });
            } catch (clearError) {
            }
          }
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Check frontend state to determine if consolidation flag should be cleared
  // This checks what the user actually sees in the UI, not just backend data
  useEffect(() => {
    // Only check if we have a submission ID and the component is not loading
    if (!SUBMISSION_ID || loading) {
      return;
    }

    // Check if all sections in the frontend state are empty/blank
    const checkFrontendData = () => {
      console.log('[Consolidation Flag] Frontend check running:', { isCoordinatorView, allSectionsCount: allSections.length, isAlreadyConsolidated, dataKeys: Object.keys(data) });
      
      // For coordinator view, check all sections
      if (isCoordinatorView && allSections.length > 0) {
        const allSectionsEmpty = allSections.every(section => {
          const sectionData = data[section.section_name];
          if (!sectionData || typeof sectionData !== 'object') return true;
          
          // Check if all numeric columns are empty/zero
          return dynamicCols.every(col => {
            const val = sectionData[col.key];
            if (val === null || val === undefined || val === '') return true;
            const numVal = Number(val);
            return isNaN(numVal) || numVal === 0;
          });
        });

        console.log('[Consolidation Flag] Frontend check result:', { allSectionsEmpty, isAlreadyConsolidated });

        // If all sections are empty and flag is set, clear it
        if (allSectionsEmpty && isAlreadyConsolidated) {
          console.log('[Consolidation Flag] Setting isAlreadyConsolidated to false - Frontend check: All sections are blank/empty');
          setIsAlreadyConsolidated(false);
          setHasUnsavedConsolidation(false);

          // Clear the flag from backend
          (async () => {
            try {
              const res = await fetch(`${API_BASE}/submissions/${SUBMISSION_ID}`, {
                credentials: "include"
              });
              if (!res.ok) return;
              const json = await res.json();
              
              const currentFields = json?.fields || {};
              const updatedFields = {
                ...currentFields,
                meta: {
                  ...currentFields?.meta,
                  isConsolidated: false,
                  consolidatedAt: null
                }
              };

              await fetch(`${API_BASE}/submissions/${SUBMISSION_ID}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ fields: updatedFields })
              });
            } catch (error) {
            }
          })();
        }
      } else if (!isCoordinatorView && TRAITS.length > 0) {
        // For teacher view, check all traits
        const allTraitsEmpty = TRAITS.every(trait => {
          const traitData = data[trait];
          if (!traitData || typeof traitData !== 'object') return true;
          
          // Check if all numeric columns are empty/zero
          return dynamicCols.every(col => {
            const val = traitData[col.key];
            if (val === null || val === undefined || val === '') return true;
            const numVal = Number(val);
            return isNaN(numVal) || numVal === 0;
          });
        });

        console.log('[Consolidation Flag] Frontend check result (teacher view):', { allTraitsEmpty, isAlreadyConsolidated });

        // If all traits are empty and flag is set, clear it
        if (allTraitsEmpty && isAlreadyConsolidated) {
          console.log('[Consolidation Flag] Setting isAlreadyConsolidated to false - Frontend check: All traits are blank/empty');
          setIsAlreadyConsolidated(false);
          setHasUnsavedConsolidation(false);

          // Clear the flag from backend
          (async () => {
            try {
              const res = await fetch(`${API_BASE}/submissions/${SUBMISSION_ID}`, {
                credentials: "include"
              });
              if (!res.ok) return;
              const json = await res.json();
              
              const currentFields = json?.fields || {};
              const updatedFields = {
                ...currentFields,
                meta: {
                  ...currentFields?.meta,
                  isConsolidated: false,
                  consolidatedAt: null
                }
              };

              await fetch(`${API_BASE}/submissions/${SUBMISSION_ID}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ fields: updatedFields })
              });
            } catch (error) {
            }
          })();
        }
      }
    };

    // Only check after a short delay to avoid checking during initial load
    const timeoutId = setTimeout(() => {
      checkFrontendData();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [data, isCoordinatorView, allSections, TRAITS, dynamicCols, isAlreadyConsolidated, SUBMISSION_ID, loading]);

  const exportLAEMPLAndMPSExcel = () => {
    const workbook = XLSX.utils.book_new();

    const laemplHeader = ["Trait", ...dynamicCols.map((c) => c.label)];
    const laemplRows = TRAITS.map((trait) => [
      trait,
      ...dynamicCols.map((c) => data[trait]?.[c.key] || ""),
    ]);
    const laemplTotalRow = ["Total", ...dynamicCols.map((c) => totals[c.key] || 0)];
    const laemplData = [laemplHeader, ...laemplRows, laemplTotalRow];
    const laemplSheet = XLSX.utils.aoa_to_sheet(laemplData);
    applySheetSizing(laemplSheet, laemplData);
    XLSX.utils.book_append_sheet(workbook, laemplSheet, "LAEMPL");

    const mpsHeader = ["Trait", ...COLS_MPS.map((c) => c.label)];
    const mpsRows = TRAITS.map((trait) => [
      trait,
      ...COLS_MPS.map((c) =>
        mpsData[trait][c.key] === "" ? "" : mpsData[trait][c.key]
      ),
    ]);
    const mpsTotalRow = ["Total", ...COLS_MPS.map((c) => mpsTotals[c.key])];
    const mpsDataSheet = [mpsHeader, ...mpsRows, mpsTotalRow];
    const mpsSheet = XLSX.utils.aoa_to_sheet(mpsDataSheet);
    applySheetSizing(mpsSheet, mpsDataSheet);
    XLSX.utils.book_append_sheet(workbook, mpsSheet, "MPS");

    XLSX.writeFile(workbook, "LAEMPL_MPS_Grade1.xlsx");
  };

  const exportTemplateExcel = () => {
    const workbook = XLSX.utils.book_new();

    const laemplHeader = ["Trait", ...dynamicCols.map((c) => c.label)];
    const laemplBlank = TRAITS.map((trait) => [trait, ...dynamicCols.map(() => "")]);
    const laemplData = [laemplHeader, ...laemplBlank];
    const laemplSheet = XLSX.utils.aoa_to_sheet(laemplData);
    applySheetSizing(laemplSheet, laemplData);
    XLSX.utils.book_append_sheet(workbook, laemplSheet, "LAEMPL_Template");

    const mpsHeader = ["Trait", ...COLS_MPS.map((c) => c.label)];
    const mpsBlank = TRAITS.map((trait) => [trait, ...COLS_MPS.map(() => "")]);
    const mpsDataSheet = [mpsHeader, ...mpsBlank];
    const mpsSheet = XLSX.utils.aoa_to_sheet(mpsDataSheet);
    applySheetSizing(mpsSheet, mpsDataSheet);
    XLSX.utils.book_append_sheet(workbook, mpsSheet, "MPS_Template");

    XLSX.writeFile(workbook, "LAEMPL_MPS_Template.xlsx");
  };

  const onImport = async (file) => {
    if (isDisabled) {
      toast.error("This submission has already been submitted and is read-only.");
      return;
    }
    try {
      const lines = await parseSpreadsheet(file);
      const body = lines.slice(1, 1 + TRAITS.length);
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
      setIsFormSubmitted(false); // Reset submission flag when data changes
      // Update originalData to the imported data so changes are tracked from this point
      setOriginalData(JSON.parse(JSON.stringify(next)));
      toast.success("File imported successfully!");
      setOpenPopup(false);       // close modal after success (optional)
    } catch (e) {
      setErr("Failed to import file. " + (e?.message || ""));
    }
  };

  // CLEAR TABLE — also enable edit override
  const handleClear = () => {
    if (isDisabled) {
      toast.error("This submission has already been submitted and is read-only.");
      return;
    }
    touchedRef.current = true;
    setEditOverride(true);
    setIsFormSubmitted(false); // Reset submission flag when data changes
    const blank = Object.fromEntries(
      TRAITS.map((t) => [
        t,
        Object.fromEntries(dynamicCols.map((c) => [c.key, ""])),
      ])
    );
    setData(blank);
    // Update originalData to the cleared data so changes are tracked from this point
    setOriginalData(JSON.parse(JSON.stringify(blank)));
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
  const mpsDisabled = isDisabled || (mpsLocked && !mpsEditOverride);
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
      return;
    }
    
    mpsTouchedRef.current = true;
    setIsFormSubmitted(false); // Reset submission flag when data changes
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
          // Store original MPS data after loading for change detection
          const originalMpsDataCopy = JSON.parse(JSON.stringify(next));
          setOriginalMpsData(originalMpsDataCopy);
          console.log('[Unsaved Changes] Original MPS data stored after loading:', { 
            hasData: !!originalMpsDataCopy,
            dataKeys: Object.keys(originalMpsDataCopy || {})
          });
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

  // Track form changes to detect unsaved data (moved after mpsData declaration)
  useEffect(() => {
    // Don't track changes if form was just submitted successfully
    if (isFormSubmitted) {
      console.log('[Unsaved Changes] Form submitted, clearing unsaved changes flag');
      setHasUnsavedChanges(false);
      return;
    }

    // Don't track changes until data has been loaded
    if (loading) {
      console.log('[Unsaved Changes] Still loading');
      setHasUnsavedChanges(false);
      return;
    }

    // If no originalData yet, don't track changes (wait for data to load)
    if (!originalData) {
      console.log('[Unsaved Changes] No original data yet, waiting for data to load');
      setHasUnsavedChanges(false);
      return;
    }

    // Also wait for originalMpsData if it should exist (if we have mpsData, we should have originalMpsData)
    // This prevents false positives during initial load when MPS is being synced
    if (Object.keys(mpsData || {}).length > 0 && !originalMpsData) {
      console.log('[Unsaved Changes] MPS data exists but originalMpsData not set yet, waiting...');
      setHasUnsavedChanges(false);
      return;
    }

    // Check if LAEMPL data has been modified
    // Normalize both data objects for comparison (handle empty strings, null, undefined consistently)
    const normalizeData = (obj) => {
      if (!obj || typeof obj !== 'object') return {};
      const normalized = {};
      Object.keys(obj).forEach(key => {
        normalized[key] = {};
        Object.keys(obj[key] || {}).forEach(colKey => {
          const val = obj[key][colKey];
          // Normalize: treat null, undefined, empty string as empty string
          normalized[key][colKey] = (val === null || val === undefined || val === '') ? '' : String(val);
        });
      });
      return normalized;
    };
    
    const normalizedData = normalizeData(data);
    const normalizedOriginalData = normalizeData(originalData);
    const laemplHasChanges = JSON.stringify(normalizedData) !== JSON.stringify(normalizedOriginalData);
    
    // Check if MPS data has been modified (only if originalMpsData exists)
    const normalizedMpsData = normalizeData(mpsData);
    const normalizedOriginalMpsData = originalMpsData ? normalizeData(originalMpsData) : {};
    const mpsHasChanges = originalMpsData ? JSON.stringify(normalizedMpsData) !== JSON.stringify(normalizedOriginalMpsData) : false;

    const hasChanges = laemplHasChanges || mpsHasChanges;
    console.log('[Unsaved Changes] Checking changes:', { 
      laemplHasChanges, 
      mpsHasChanges, 
      hasChanges,
      isFormSubmitted,
      dataKeys: Object.keys(data || {}),
      originalDataKeys: Object.keys(originalData || {}),
      dataSample: normalizedData[Object.keys(normalizedData)[0]],
      originalSample: normalizedOriginalData[Object.keys(normalizedOriginalData)[0]]
    });
    
    setHasUnsavedChanges(hasChanges);
    console.log('[Unsaved Changes] ✅ hasUnsavedChanges set to:', hasChanges);
  }, [data, mpsData, isFormSubmitted, loading, originalData, originalMpsData]);

  // Intercept back/forward button navigation
  useEffect(() => {
    if (!hasUnsavedChanges || isFormSubmitted) return;

    const handlePopState = (e) => {
      // Prevent back/forward navigation
      window.history.pushState(null, '', location.pathname + location.search);
      
      // Show alert
      const shouldLeave = window.confirm("⚠️ WARNING: You have unsaved changes!\n\nAre you sure you want to leave? Your changes will be lost.\n\nClick OK to leave, or Cancel to stay on the page.");
      
      if (shouldLeave) {
        setHasUnsavedChanges(false);
        setIsFormSubmitted(true);
        window.history.back();
      }
      // If cancel, stay on page (already pushed state back)
    };

    // Push a state to enable back button detection
    window.history.pushState(null, '', location.pathname + location.search);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasUnsavedChanges, isFormSubmitted, location]);

  // Handle unsaved changes modal confirmation
  const handleLeavePage = () => {
    setHasUnsavedChanges(false);
    setIsFormSubmitted(true);
    setShowUnsavedChangesModal(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  const handleStayOnPage = () => {
    setShowUnsavedChangesModal(false);
    setPendingNavigation(null);
  };

  // Add beforeunload warning for page refresh/close (like Gmail's "Reload site?" dialog)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      console.log('[BeforeUnload] Event triggered:', { hasUnsavedChanges, isFormSubmitted });
      if (hasUnsavedChanges && !isFormSubmitted) {
        // This will show the browser's native "Reload site?" dialog (like Gmail)
        // Modern browsers require both preventDefault and returnValue
        e.preventDefault();
        e.returnValue = ""; // Empty string is required for modern browsers
        console.log('[BeforeUnload] ✅ Showing browser warning dialog');
        return ""; // Return empty string for modern browsers
      }
    };

    if (hasUnsavedChanges && !isFormSubmitted) {
      window.addEventListener("beforeunload", handleBeforeUnload);
      console.log('[BeforeUnload] ✅ Event listener added', { hasUnsavedChanges, isFormSubmitted });
    }

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (hasUnsavedChanges && !isFormSubmitted) {
        console.log('[BeforeUnload] Event listener removed');
      }
    };
  }, [hasUnsavedChanges, isFormSubmitted]);
  
  // Intercept link clicks and navigation
  useEffect(() => {
    if (!hasUnsavedChanges || isFormSubmitted) return;

    const handleClick = (e) => {
      const target = e.target.closest('a');
      if (target && target.href) {
        const url = new URL(target.href);
        const currentUrl = new URL(window.location.href);
        // Only intercept if navigating to a different page
        if (url.pathname !== currentUrl.pathname || url.search !== currentUrl.search) {
          e.preventDefault();
          // Show alert first
          const shouldLeave = window.confirm("⚠️ WARNING: You have unsaved changes!\n\nAre you sure you want to leave? Your changes will be lost.\n\nClick OK to leave, or Cancel to stay on the page.");
          
          if (shouldLeave) {
            setHasUnsavedChanges(false);
            setIsFormSubmitted(true);
            window.location.href = target.href;
          }
          // If cancel, do nothing - stay on page
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [hasUnsavedChanges, isFormSubmitted]);

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
      setIsFormSubmitted(true);
      if (json?.status !== undefined) setMpsStatus(json.status);
      // Update original MPS data after successful save
      setOriginalMpsData(JSON.parse(JSON.stringify(mpsData)));
      setMpsEditOverride(false);
    } catch (e) {
      setMpsErr(e.message || "Failed to save.");
    } finally {
      setMpsSaving(false);
    }
  };

  const exportMpsExcel = () => {
    const workbook = XLSX.utils.book_new();
    const header = ["Trait", ...COLS_MPS.map((c) => c.label)];
    const rows = TRAITS.map((trait) => [
      trait,
      ...COLS_MPS.map((c) => (mpsData[trait][c.key] === "" ? "" : mpsData[trait][c.key])),
    ]);
    const totalRow = ["Total", ...COLS_MPS.map((c) => mpsTotals[c.key])];
    const sheetData = [header, ...rows, totalRow];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    applySheetSizing(sheet, sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, "MPS");
    XLSX.writeFile(workbook, "MPS_Grade1.xlsx");
  };

  const exportMpsTemplateExcel = () => {
    const workbook = XLSX.utils.book_new();
    const header = ["Trait", ...COLS_MPS.map((c) => c.label)];
    const rows = TRAITS.map((trait) => [trait, ...COLS_MPS.map(() => "")]);
    const sheetData = [header, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    applySheetSizing(sheet, sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, "MPS_Template");
    XLSX.writeFile(workbook, "MPS_Template.xlsx");
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

const parseMpsRows = (rowsInput) => {
    const rows = rowsInput.filter(r => r.some(v => String(v ?? "").trim() !== ""));
    if (!rows.length) throw new Error("File is empty.");
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
    if (mpsDisabled) {
      toast.error("This submission has already been submitted and is read-only.");
      return;
    }
    try {
      const lower = file.name.toLowerCase();
      let rows;
      if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      } else {
        const text = await file.text();
        rows = mpsCsvToRows(text);
      }
      const { nextData, importedCount } = parseMpsRows(rows);
      mpsTouchedRef.current = true;
      setMpsEditOverride(true);
      setMpsData(nextData);
      setIsFormSubmitted(false); // Reset submission flag when data changes
      setOriginalMpsData(JSON.parse(JSON.stringify(nextData)));
      toast.success(`Imported ${importedCount} row(s) successfully!`);
      setMpsOpenPopup(false);
    } catch (e) {
      setMpsErr("Failed to import file. " + (e?.message || ""));
    }
  };

  const handleMpsClear = () => {
    if (mpsDisabled) {
      toast.error("This submission has already been submitted and is read-only.");
      return;
    }
    mpsTouchedRef.current = true;
    setMpsEditOverride(true);
    setIsFormSubmitted(false); // Reset submission flag when data changes
    const blank = Object.fromEntries(
      TRAITS.map(t => [t, Object.fromEntries(COLS_MPS.map(c => [c.key, ""]))])
    );
    setMpsData(blank);
    // Update originalMpsData to the cleared data so changes are tracked from this point
    setOriginalMpsData(JSON.parse(JSON.stringify(blank)));
  };

  // Open consolidate modal and fetch peer data
  const handleConsolidate = async () => {
    if (!isCoordinatorView) {
      return;
    }
    
    
    setConsolidateError("");
    setConsolidateSuccess("");
    
    try {
      // Build URL with parent_assignment_id for coordinator view (similar to accomplishment reports)
      // Coordinator: use 'pra' (parent assignment) to get teacher submissions from child assignments
      // Teacher/Principal: use 'ra' (same assignment) or no parameter (default behavior)
      let url = `${API_BASE}/reports/laempl-mps/${SUBMISSION_ID}/peers`;
      
      if (isCoordinatorView && parentAssignmentId) {
        url += `?pra=${encodeURIComponent(parentAssignmentId)}`;
      } else if (reportAssignmentId) {
        url += `?ra=${encodeURIComponent(reportAssignmentId)}`;
      } else {
      }
      
      const res = await fetch(url, { credentials: "include" });
      
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed to load peer data: ${res.status} ${txt}`);
      }
      
      const responseText = await res.text();
      
      let peerData;
      try {
        peerData = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error("Invalid JSON response from server");
      }
      
      
      // Handle case where response might be wrapped in an object
      if (peerData && !Array.isArray(peerData)) {
        if (peerData.data && Array.isArray(peerData.data)) {
          peerData = peerData.data;
        } else if (peerData.peers && Array.isArray(peerData.peers)) {
          peerData = peerData.peers;
        } else {
          peerData = [];
        }
      }
      
      // Automatically unconsolidate peers whose sections are missing or have empty rows
      if (Array.isArray(peerData) && allSections.length > 0) {
        const currentSectionNames = new Set(allSections.map(s => s.section_name));
        
        // Helper function to check if a section row is empty
        const isSectionRowEmpty = (sectionName) => {
          const sectionData = data[sectionName];
          if (!sectionData || typeof sectionData !== 'object') return true;
          
          // Check if all numeric columns are empty/zero
          return dynamicCols.every(col => {
            const val = sectionData[col.key];
            if (val === null || val === undefined || val === '') return true;
            const numVal = Number(val);
            return isNaN(numVal) || numVal === 0;
          });
        };
        
        // Process each peer to check if their section exists or is empty
        const unconsolidatePromises = peerData.map(async (peer) => {
          try {
            const fields = typeof peer.fields === 'string' ? JSON.parse(peer.fields) : (peer.fields || {});
            const consolidatedInto = fields?.meta?.consolidatedInto;
            const isConsolidated = consolidatedInto != null && consolidatedInto !== '' && consolidatedInto !== 'null';
            
            // If peer is consolidated, check if their section is missing or empty
            if (isConsolidated && peer.section_name) {
              const sectionMissing = !currentSectionNames.has(peer.section_name);
              const sectionEmpty = currentSectionNames.has(peer.section_name) && isSectionRowEmpty(peer.section_name);
              
              if (sectionMissing || sectionEmpty) {
                // Section is missing or empty - automatically unconsolidate
                const updatedFields = {
                  ...fields,
                  meta: {
                    ...fields?.meta,
                    consolidatedInto: null,
                    consolidatedAt: null
                  }
                };
                
                // Update the peer submission silently
                try {
                  await fetch(`${API_BASE}/submissions/${peer.submission_id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ fields: updatedFields })
                  });
                } catch (updateError) {
                  // Silently fail - don't block the UI
                }
              }
            }
          } catch (parseError) {
            // Silently continue
          }
        });
        
        // Wait for all unconsolidation operations to complete
        await Promise.all(unconsolidatePromises);
        
        // Reload peer data to reflect the changes
        const refreshRes = await fetch(url, { credentials: "include" });
        if (refreshRes.ok) {
          const refreshText = await refreshRes.text();
          try {
            let refreshedData = JSON.parse(refreshText);
            if (refreshedData && !Array.isArray(refreshedData)) {
              if (refreshedData.data && Array.isArray(refreshedData.data)) {
                refreshedData = refreshedData.data;
              } else if (refreshedData.peers && Array.isArray(refreshedData.peers)) {
                refreshedData = refreshedData.peers;
              } else {
                refreshedData = [];
              }
            }
            peerData = Array.isArray(refreshedData) ? refreshedData : [];
          } catch (parseErr) {
            // Keep original peerData if refresh fails
          }
        }
      }
      
      const finalPeerData = Array.isArray(peerData) ? peerData : [];
      
      setPeerData(finalPeerData);
      setShowConsolidate(true);
    } catch (error) {
      setConsolidateError(error.message || "Failed to load peer data");
    }
  };

  // Consolidate data from selected peers
  const consolidateFromPeers = async (selectedPeers) => {
    try {
      setConsolidateError("");
      
      
      // Initialize consolidated data with existing data (preserve current values)
      // Store reference to existing consolidatedData state before creating new local variable
      const existingConsolidatedDataState = consolidatedData;
      const consolidatedDataLocal = {};
      allSections.forEach(section => {
        const sectionName = section.section_name;
        consolidatedDataLocal[sectionName] = {};
        
        // Start with existing data if it exists, otherwise initialize to 0
        const existingSectionData = data[sectionName] || {};
        const existingConsolidatedSection = existingConsolidatedDataState[sectionName] || {};
        
        dynamicCols.forEach(col => {
          const existingValue = existingSectionData[col.key];
          if (existingValue !== null && existingValue !== undefined && existingValue !== '') {
            consolidatedDataLocal[sectionName][col.key] = Number(existingValue) || 0;
          } else {
            consolidatedDataLocal[sectionName][col.key] = 0;
          }
        });
        
        // Preserve existing subject-specific columns
        Object.keys(existingSectionData).forEach(key => {
          if (key.startsWith('subject_') && key !== 'subjects') {
            const existingValue = existingSectionData[key];
            if (existingValue !== null && existingValue !== undefined && existingValue !== '') {
              consolidatedDataLocal[sectionName][key] = Number(existingValue) || 0;
            } else {
              consolidatedDataLocal[sectionName][key] = 0;
            }
          }
        });
        
        // Preserve existing _subjectMap from consolidatedData state if it exists
        if (existingConsolidatedSection && existingConsolidatedSection._subjectMap) {
          consolidatedDataLocal[sectionName]._subjectMap = { ...existingConsolidatedSection._subjectMap };
        }
      });
      
      // Process each selected peer - ADD their data to existing values
      selectedPeers.forEach(peer => {
        
        try {
          const fields = typeof peer.fields === 'string' ? JSON.parse(peer.fields) : peer.fields;
          
          // Get the section name from the peer data - ensure it matches our loaded sections
          let sectionName = peer.section_name || (allSections.length > 0 ? allSections[0].section_name : "Unknown");
          
          // Map peer section to our loaded sections if needed
          const loadedSectionNames = allSections.map(s => s.section_name);
          if (!loadedSectionNames.includes(sectionName)) {
            // If the peer section doesn't match our loaded sections, use the first available section
            if (allSections.length > 0) {
              sectionName = allSections[0].section_name;
            } else {
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
          
          
          // Only process if the section is in our loaded sections
          if (loadedSectionNames.includes(sectionName)) {
            // Ensure this section exists in consolidated data
            if (!consolidatedDataLocal[sectionName]) {
              consolidatedDataLocal[sectionName] = {};
              dynamicCols.forEach(col => {
                consolidatedDataLocal[sectionName][col.key] = 0;
              });
            }
            
            // Get subject_id from fields if available
            let subjectId = fields?.subject_id || null;
            if (!subjectId && peer.report_title) {
              // Try to extract from report title or other sources if needed
            }
            
            // Process the peer's data - ADD to existing values
            if (fields?.rows && Array.isArray(fields.rows)) {
              // Sum up data from all rows in this peer's submission and add to existing values
              fields.rows.forEach(row => {
                dynamicCols.forEach(col => {
                  const value = Number(row[col.key]) || 0;
                  // Add to existing value, don't replace
                  consolidatedDataLocal[sectionName][col.key] = (consolidatedDataLocal[sectionName][col.key] || 0) + value;
                });
                
                // Also extract subject-specific scores and add to existing values
                Object.keys(row).forEach(key => {
                  if (key.startsWith('subject_') && row[key] !== null && row[key] !== '') {
                    const subjectScore = Number(row[key]) || 0;
                    const subjectKey = key; // Use the original key like 'subject_10'
                    
                    // Add to existing value, don't replace
                    consolidatedDataLocal[sectionName][subjectKey] = (consolidatedDataLocal[sectionName][subjectKey] || 0) + subjectScore;
                    
                    // Store subject name mapping for this subject key
                    if (subjectName && subjectId) {
                      if (!consolidatedDataLocal[sectionName]._subjectMap) {
                        consolidatedDataLocal[sectionName]._subjectMap = {};
                      }
                      consolidatedDataLocal[sectionName]._subjectMap[subjectKey] = {
                        name: subjectName,
                        id: subjectId
                      };
                    }
                  }
                });
              });
            }
            
            // Also check if subject info is in fields directly (not in rows)
            if (subjectId && subjectName) {
              const subjectKey = `subject_${subjectId}`;
              if (!consolidatedDataLocal[sectionName]._subjectMap) {
                consolidatedDataLocal[sectionName]._subjectMap = {};
              }
              consolidatedDataLocal[sectionName]._subjectMap[subjectKey] = {
                name: subjectName,
                id: subjectId
              };
            }
            
            // Add subject information to the consolidated data
            if (subjectName) {
              // Store subject info in a special field for display
              if (!consolidatedDataLocal[sectionName].subjects) {
                consolidatedDataLocal[sectionName].subjects = [];
              }
              if (!consolidatedDataLocal[sectionName].subjects.includes(subjectName)) {
                consolidatedDataLocal[sectionName].subjects.push(subjectName);
              }
            }
          } else {
            return; // Skip this peer
          }
          
        } catch (parseError) {
        }
      });
      
      // Update the current data with consolidated values (preserving all sections)
      const newData = { ...data };
      allSections.forEach(section => {
        const sectionName = section.section_name;
        if (consolidatedDataLocal[sectionName]) {
          if (!newData[sectionName]) newData[sectionName] = {};
          dynamicCols.forEach(col => {
            const consolidatedValue = consolidatedDataLocal[sectionName][col.key];
            newData[sectionName][col.key] = consolidatedValue.toString();
          });
          
          // Copy all subject scores that exist in consolidated data
          Object.keys(consolidatedDataLocal[sectionName]).forEach(key => {
            if (key.startsWith('subject_') && key !== 'subjects') {
              const subjectScore = consolidatedDataLocal[sectionName][key] || 0;
              newData[sectionName][key] = subjectScore.toString();
            }
          });
        }
      });
      
      setData(newData);
      setIsFormSubmitted(false); // Reset submission flag when data changes
      // DON'T update originalData here - wait until user explicitly saves
      // This ensures the warning appears if user refreshes before saving
      setConsolidatedData(consolidatedDataLocal);
      console.log('[Unsaved Changes] Data consolidated, hasUnsavedChanges should be true after this');
      
      // Columns are now fixed, no need to update them based on subjects
      
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
          else if (col.key === "total_score") {
            // Sync Total Score from LAEMPL
            const totalScore = Number(newData[sectionName]?.["total_score"]) || 0;
            newMpsData[sectionName][col.key] = totalScore.toString();
          }
          else if (col.key === "hs") newMpsData[sectionName][col.key] = newData[sectionName]?.["highest_score"] || "";
          else if (col.key === "ls") newMpsData[sectionName][col.key] = newData[sectionName]?.["lowest_score"] || "";
          else if (col.key === "total_items") newMpsData[sectionName][col.key] = newData[sectionName]?.["no_of_items"] || "";
          else if (col.key === "mean") {
            // Use Total Score from LAEMPL for Mean calculation
            const totalScore = Number(newData[sectionName]?.["total_score"]) || 0;
            const male = Number(newData[sectionName]?.["m"]) || 0;
            const female = Number(newData[sectionName]?.["f"]) || 0;
            const totalPupils = male + female;
            const mean = totalPupils > 0 ? (totalScore / totalPupils).toFixed(2) : "0.00";
            newMpsData[sectionName][col.key] = mean;
          }
          else if (col.key === "median") {
            const hs = Number(newData[sectionName]?.["highest_score"]) || 0;
            const ls = Number(newData[sectionName]?.["lowest_score"]) || 0;
            const median = ((hs + ls) / 2).toFixed(2);
            newMpsData[sectionName][col.key] = median;
          }
          else if (col.key === "pl") {
            const mean = Number(newMpsData[sectionName]["mean"]) || 0;
            const totalItems = Number(newData[sectionName]?.["no_of_items"]) || 0;
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
      
      // Set temporary flag: prevents re-consolidation during this editing session
      setHasUnsavedConsolidation(true);
      setIsAlreadyConsolidated(true); // Block consolidation in this session
      
      // Mark each selected peer submission as consolidated into this submission
      // Convert SUBMISSION_ID to number for consistency
      const currentSubmissionId = Number(SUBMISSION_ID);
      for (const peer of selectedPeers) {
        try {
          // Double-check: skip if already consolidated
          const peerFields = typeof peer.fields === 'string' ? JSON.parse(peer.fields) : peer.fields;
          if (peerFields?.meta?.consolidatedInto) {
            continue;
          }
          
          const updatedPeerFields = {
            ...peerFields,
            meta: {
              ...peerFields?.meta,
              consolidatedInto: currentSubmissionId, // Mark which submission this was consolidated into (use number)
              consolidatedAt: new Date().toISOString()
            }
          };
          
          // Update the peer submission to mark it as consolidated
          const markResponse = await fetch(`${API_BASE}/submissions/${peer.submission_id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ fields: updatedPeerFields })
          });
          
          if (!markResponse.ok) {
            throw new Error(`Failed to mark peer: ${markResponse.status}`);
          }
          
        } catch (peerError) {
          // Don't throw - continue with other peers
        }
      }
      
      // Create success message with subject information
      const subjectsList = selectedPeers.map(peer => {
        const titleParts = peer.report_title ? peer.report_title.split(" - ") : [];
        return titleParts.length > 1 ? titleParts[titleParts.length - 1] : "Unknown";
      }).join(", ");
      
      setConsolidateSuccess(`Successfully consolidated data from ${selectedPeers.length} peer submissions. Subjects: ${subjectsList}`);
      
      // Immediately save the consolidated data to the backend so it persists after page refresh
      try {
        const gradeLevel = submissionData?.fields?.grade || teacherSection?.grade_level || 2;
        
        // Wait a bit for state to update, then use the updated data state
        // Use newData directly since it has the consolidated values
        
        // For coordinator view, ensure TRAITS matches section names
        // This is important because toRows uses TRAITS to generate rows
        if (isCoordinatorView && allSections.length > 0) {
          const sectionNames = allSections.map(s => s.section_name);
          // Only update if TRAITS doesn't match section names
          if (JSON.stringify(TRAITS.sort()) !== JSON.stringify(sectionNames.sort())) {
            setTRAITS(sectionNames);
            // Wait a tick for state to update, but we'll use sectionNames directly
            const rows = sectionNames.map((sectionName) => {
              const row = { trait: sectionName };
              const sectionData = newData[sectionName];
              dynamicCols.forEach(col => {
                const value = sectionData?.[col.key];
                // Convert to number, but preserve 0 values (don't use || 0 which would convert null/undefined to 0)
                if (value === "" || value === null || value === undefined) {
                  row[col.key] = null;
                } else {
                  const numValue = Number(value);
                  row[col.key] = isNaN(numValue) ? null : numValue;
                }
              });
              return row;
            });
            
            // Calculate totals using section names
            const consolidatedTotals = dynamicCols.reduce((acc, c) => {
              acc[c.key] = sectionNames.reduce(
                (sum, sectionName) => sum + (Number(newData[sectionName]?.[c.key]) || 0),
                0
              );
              return acc;
            }, {});
            
            const savePayload = {
              status: submissionData?.status || 1,
              grade: gradeLevel,
              rows: rows,
              totals: consolidatedTotals,
              subject_id: submissionData?.fields?.subject_id,
              subject_name: submissionData?.fields?.subject_name,
              mps_rows: mpsToRows(),
              mps_totals: mpsToTotals(),
            };
            
            const saveResponse = await fetch(
              `${API_BASE}/submissions/laempl/${SUBMISSION_ID}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(savePayload),
              }
            );
            
            if (!saveResponse.ok) {
              const errorText = await saveResponse.text();
              throw new Error(errorText || `HTTP ${saveResponse.status}`);
            }
            
            const saveJson = await saveResponse.json();
            
            // Update the consolidation flag in meta to mark it as saved
            if (saveJson?.fields) {
              const updatedFields = {
                ...saveJson.fields,
                meta: {
                  ...saveJson.fields?.meta,
                  consolidatedAt: new Date().toISOString(),
                  isConsolidated: true
                }
              };
              
              const flagResponse = await fetch(`${API_BASE}/submissions/${SUBMISSION_ID}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ fields: updatedFields })
              });
              
              if (!flagResponse.ok) {
              }
            }
            
        // Clear the temporary flag since data is now saved
        setHasUnsavedConsolidation(false);
        // Keep isAlreadyConsolidated as true since data is now permanently saved
        
        // DON'T update originalData here - let the user explicitly save via Submit button
        // This ensures the warning appears if user refreshes after consolidation
        // The automatic save here is just to persist the consolidation, but user might want to make more changes
        console.log('[Unsaved Changes] Consolidation saved to backend, but originalData NOT updated - user can still make changes');
        
        toast.success('Consolidated data saved successfully!');
        return; // Exit early since we've handled the save
          }
        }
        
        // Convert consolidated data to rows format (for non-coordinator view or if TRAITS already matches)
        const rows = toRows(newData);
        
        // Calculate totals from the consolidated data
        // Use TRAITS (which should be section names for coordinator view) or allSections
        const traitsToUse = isCoordinatorView && allSections.length > 0 
          ? allSections.map(s => s.section_name) 
          : TRAITS;
        
        const consolidatedTotals = dynamicCols.reduce((acc, c) => {
          acc[c.key] = traitsToUse.reduce(
            (sum, t) => sum + (Number(newData[t]?.[c.key]) || 0),
            0
          );
          return acc;
        }, {});
        
        const savePayload = {
          status: submissionData?.status || 1, // Keep current status, don't change to submitted
          grade: gradeLevel,
          rows: rows,
          totals: consolidatedTotals,
          subject_id: submissionData?.fields?.subject_id,
          subject_name: submissionData?.fields?.subject_name,
          mps_rows: mpsToRows(),
          mps_totals: mpsToTotals(),
        };
        
        const saveResponse = await fetch(
          `${API_BASE}/submissions/laempl/${SUBMISSION_ID}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(savePayload),
          }
        );
        
        if (!saveResponse.ok) {
          const errorText = await saveResponse.text();
          throw new Error(errorText || `HTTP ${saveResponse.status}`);
        }
        
        const saveJson = await saveResponse.json();
        
        // Update the consolidation flag in meta to mark it as saved
        if (saveJson?.fields) {
          const updatedFields = {
            ...saveJson.fields,
            meta: {
              ...saveJson.fields?.meta,
              consolidatedAt: new Date().toISOString(),
              isConsolidated: true
            }
          };
          
          const flagResponse = await fetch(`${API_BASE}/submissions/${SUBMISSION_ID}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ fields: updatedFields })
          });
          
          if (!flagResponse.ok) {
          }
        }
        
        // Clear the temporary flag since data is now saved
        setHasUnsavedConsolidation(false);
        // Keep isAlreadyConsolidated as true since data is now permanently saved
        
        // DON'T update originalData here - let the user explicitly save via Submit button
        // This ensures the warning appears if user refreshes after consolidation
        // The automatic save here is just to persist the consolidation, but user might want to make more changes
        console.log('[Unsaved Changes] Consolidation saved to backend, but originalData NOT updated - user can still make changes');
        
        toast.success('Consolidated data saved successfully!');
      } catch (saveError) {
        toast.error(`Failed to save consolidated data: ${saveError.message}. Please try saving manually.`);
        // Don't throw - the consolidation still worked in the UI, just not persisted
        // The user can still save manually later
      }
      
      // TODO: Generate AI Summary after successful consolidation (if needed)
      // await generateAISummary(selectedPeers, consolidatedData);
      
    } catch (error) {
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
              <button onClick={exportTemplateExcel}>Generate Template</button>

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
                        accept=".csv,.xlsx"
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
              <button onClick={exportLAEMPLAndMPSExcel}>Export</button>
              {/* Clear */}
              <button onClick={handleClear} disabled={isDisabled}>Clear Table</button>
              {/* Consolidate button for coordinator view */}
              {isCoordinatorView && (
                <button 
                  onClick={handleConsolidate}
                  title="Consolidate data from peer submissions"
                >
                  Consolidate
                </button>
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
            <div className="table-wrap mps-table-wrap">
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
                    <th scope="col" className="row-head" style={{ width: '120px' }}>&nbsp;</th>
                    {dynamicCols.map((col) => (
                      <th key={col.key} scope="col" style={{ 
                        width: col.key === 'male_passed' || col.key === 'female_passed' || col.key === 'total_passed' 
                          ? '140px' 
                          : col.key.includes('mpl_percent') 
                            ? '90px' 
                            : '80px',
                        fontSize: '0.75rem'
                      }}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isCoordinatorView ? (
                    // Coordinator view: show all sections
                    allSections.map((section, index) => {
                      const sectionData = data[section.section_name];
                      return (
                      <tr key={section.section_id || index}>
                        <th scope="row" className="row-head">{section.section_name}</th>
                        {dynamicCols.map((col) => {
                          const cellValue = sectionData?.[col.key] || "";
                          const isPercentageColumn = col.key.includes('mpl_percent');
                          const isCalculatedField = ['no_of_cases', 'total_passed', 'male_mpl_percent', 'female_mpl_percent', 'total_mpl_percent'].includes(col.key);
                          return (
                          <td key={col.key}>
                            <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                              <input
                                type="text"
                                inputMode={isPercentageColumn ? "decimal" : "numeric"}
                                min="0"
                                max={dynamicColRules[col.key]?.[1]}
                                step={isPercentageColumn ? "0.01" : "1"}
                                value={isPercentageColumn ? formatPercentage(cellValue) : String(cellValue)}
                                onChange={(e) => {
                                  handleChange(section.section_name, col.key, e.target.value);
                                }}
                                onKeyDown={(e) => handleKeyDown(e, isPercentageColumn)}
                                className="cell-input"
                                disabled={isDisabled || isCalculatedField}
                                readOnly={isCalculatedField}
                                style={{ 
                                  paddingRight: isPercentageColumn ? '20px' : '0.25rem',
                                  backgroundColor: isCalculatedField ? '#f5f5f5' : 'transparent',
                                  cursor: isCalculatedField ? 'not-allowed' : 'text'
                                }}
                                title={isCalculatedField ? 'This field is auto-calculated' : ''}
                              />
                              {isPercentageColumn && cellValue !== "" && cellValue != null && cellValue !== undefined && (
                                <span style={{ 
                                  position: 'absolute', 
                                  right: '8px', 
                                  top: '50%', 
                                  transform: 'translateY(-50%)',
                                  pointerEvents: 'none',
                                  color: '#666',
                                  fontSize: '0.875rem'
                                }}>%</span>
                              )}
                            </div>
                          </td>
                        )})}
                      </tr>
                    )})
                  ) : (
                    // Teacher view: show traits
                    TRAITS.map((trait) => (
                      <tr key={trait}>
                        <th scope="row" className="row-head">{trait}</th>
                        {dynamicCols.map((col) => {
                          const cellValue = data[trait]?.[col.key] || "";
                          const isPercentageColumn = col.key.includes('mpl_percent');
                          const isCalculatedField = ['no_of_cases', 'total_passed', 'male_mpl_percent', 'female_mpl_percent', 'total_mpl_percent'].includes(col.key);
                          return (
                          <td key={col.key}>
                            <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                              <input
                                type="text"
                                inputMode={isPercentageColumn ? "decimal" : "numeric"}
                                min="0"
                                max={dynamicColRules[col.key]?.[1]}
                                step={isPercentageColumn ? "0.01" : "1"}
                                value={isPercentageColumn ? formatPercentage(cellValue) : String(cellValue)}
                                onChange={(e) => {
                                  handleChange(trait, col.key, e.target.value);
                                }}
                                onKeyDown={(e) => handleKeyDown(e, isPercentageColumn)}
                                className="cell-input"
                                disabled={isDisabled || isCalculatedField}
                                readOnly={isCalculatedField}
                                style={{ 
                                  paddingRight: isPercentageColumn ? '20px' : '0.25rem',
                                  backgroundColor: isCalculatedField ? '#f5f5f5' : 'transparent',
                                  cursor: isCalculatedField ? 'not-allowed' : 'text'
                                }}
                                title={isCalculatedField ? 'This field is auto-calculated' : ''}
                              />
                              {isPercentageColumn && cellValue !== "" && cellValue != null && cellValue !== undefined && (
                                <span style={{ 
                                  position: 'absolute', 
                                  right: '8px', 
                                  top: '50%', 
                                  transform: 'translateY(-50%)',
                                  pointerEvents: 'none',
                                  color: '#666',
                                  fontSize: '0.875rem'
                                }}>%</span>
                              )}
                            </div>
                          </td>
                        )})}
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
                    <th scope="col" className="row-head" style={{ width: '120px' }}> </th>
                    {COLS_MPS.map(col => (
                      <th key={col.key} scope="col" style={{ 
                        width: col.key === 'total' || col.key === 'total_score' 
                          ? '100px' 
                          : '75px',
                        fontSize: '0.75rem'
                      }}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isCoordinatorView ? (
                    // Coordinator view: show all sections
                    <>
                      {allSections.map((section, index) => (
                        <tr key={section.section_id || index}>
                          <th scope="row" className="row-head">{section.section_name}</th>
                          {COLS_MPS.map(col => {
                            // Fields that are synced from LAEMPL should be read-only
                            const isSyncedField = ["m", "f", "total", "total_score", "mean", "hs", "ls", "total_items", "median", "pl", "mps", "sd", "target"].includes(col.key);
                            // Fields that should display as percentages
                            const isPercentageField = ["mean", "median", "pl", "mps", "sd", "target"].includes(col.key);
                            const cellValue = mpsData[section.section_name]?.[col.key] ?? "";
                            return (
                              <td key={col.key}>
                                {isPercentageField ? (
                                  <div style={{ 
                                    textAlign: 'center',
                                    padding: '0.2rem 0.25rem',
                                    backgroundColor: isSyncedField ? "#f5f5f5" : "white",
                                    color: '#333'
                                  }}>
                                    {cellValue !== "" && cellValue != null ? `${cellValue}%` : ""}
                                  </div>
                                ) : (
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    step="any"
                                    value={cellValue}
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
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {/* Average row for coordinator view */}
                      {(() => {
                        const avgColumns = ['mean', 'median', 'pl', 'mps', 'sd', 'target'];
                        const averages = {};
                        avgColumns.forEach(colKey => {
                          const values = allSections
                            .map(section => {
                              const val = mpsData[section.section_name]?.[colKey];
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
                        return (
                          <tr style={{ fontWeight: 'bold', backgroundColor: '#f3f4f6' }}>
                            <th scope="row" className="row-head">Average</th>
                            {COLS_MPS.map(col => {
                              if (avgColumns.includes(col.key)) {
                                const avgValue = averages[col.key];
                                return (
                                  <td key={col.key} style={{ textAlign: 'center' }}>
                                    {avgValue !== "" && avgValue != null ? `${avgValue}%` : ""}
                                  </td>
                                );
                              }
                              return <td key={col.key}></td>;
                            })}
                          </tr>
                        );
                      })()}
                    </>
                  ) : (
                    // Teacher view: show traits
                    <>
                      {TRAITS.map(trait => (
                        <tr key={trait}>
                          <th scope="row" className="row-head">{trait}</th>
                          {COLS_MPS.map(col => {
                            // Fields that are synced from LAEMPL should be read-only
                            const isSyncedField = ["m", "f", "total", "total_score", "mean", "hs", "ls", "total_items", "median", "pl", "mps", "sd", "target"].includes(col.key);
                            // Fields that should display as percentages
                            const isPercentageField = ["mean", "median", "pl", "mps", "sd", "target"].includes(col.key);
                            const cellValue = mpsData[trait]?.[col.key] ?? "";
                            return (
                              <td key={col.key}>
                                {isPercentageField ? (
                                  <div style={{ 
                                    textAlign: 'center',
                                    padding: '0.2rem 0.25rem',
                                    backgroundColor: isSyncedField ? "#f5f5f5" : "white",
                                    color: '#333'
                                  }}>
                                    {cellValue !== "" && cellValue != null ? `${cellValue}%` : ""}
                                  </div>
                                ) : (
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    step="any"
                                    value={cellValue}
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
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {/* Average row for teacher view */}
                      {(() => {
                        const avgColumns = ['mean', 'median', 'pl', 'mps', 'sd', 'target'];
                        const averages = {};
                        avgColumns.forEach(colKey => {
                          const values = TRAITS
                            .map(trait => {
                              const val = mpsData[trait]?.[colKey];
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
                        return (
                          <tr style={{ fontWeight: 'bold', backgroundColor: '#f3f4f6' }}>
                            <th scope="row" className="row-head">Average</th>
                            {COLS_MPS.map(col => {
                              if (avgColumns.includes(col.key)) {
                                const avgValue = averages[col.key];
                                return (
                                  <td key={col.key} style={{ textAlign: 'center' }}>
                                    {avgValue !== "" && avgValue != null ? `${avgValue}%` : ""}
                                  </td>
                                );
                              }
                              return <td key={col.key}></td>;
                            })}
                          </tr>
                        );
                      })()}
                    </>
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
                      {peerData.map((peer, index) => {
                        // Check if this peer is already consolidated
                        let isAlreadyConsolidated = false;
                        let consolidatedIntoSubmissionId = null;
                        try {
                          const fields = typeof peer.fields === 'string' ? JSON.parse(peer.fields) : (peer.fields || {});
                          const consolidatedInto = fields?.meta?.consolidatedInto;
                          // Check both string and number formats, and exclude empty/null values
                          isAlreadyConsolidated = consolidatedInto != null && consolidatedInto !== '' && consolidatedInto !== 'null';
                          consolidatedIntoSubmissionId = consolidatedInto;
                        } catch (parseError) {
                        }
                        
                        return (
                        <tr key={peer.submission_id || index} style={isAlreadyConsolidated ? { opacity: 0.5, backgroundColor: '#f3f4f6' } : {}}>
                          <td style={{ padding: 12, border: "1px solid #ddd", textAlign: "center" }}>
                            <input 
                              type="checkbox" 
                              id={`peer-${index}`}
                              disabled={isAlreadyConsolidated}
                              title={isAlreadyConsolidated ? "This submission has already been consolidated" : "Select to consolidate"}
                              onChange={(e) => {
                                if (isAlreadyConsolidated) {
                                  e.target.checked = false; // Prevent checking if already consolidated
                                  return;
                                }
                              }}
                            />
                          </td>
                          <td style={{ padding: 12, border: "1px solid #ddd" }}>
                            {peer.name || peer.teacher_name || "Unknown Teacher"}
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
                        );
                      })}
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
                        const selectedPeers = peerData.filter((peer, index) => {
                          const checkbox = document.getElementById(`peer-${index}`);
                          const isChecked = checkbox?.checked;
                          
                          // Double-check: also verify the peer isn't already consolidated
                          if (isChecked) {
                            const fields = typeof peer.fields === 'string' ? JSON.parse(peer.fields) : peer.fields;
                            const consolidatedInto = fields?.meta?.consolidatedInto;
                            if (consolidatedInto) {
                              return false; // Exclude already-consolidated peers
                            }
                          }
                          
                          return isChecked;
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

      {/* Unsaved Changes Warning Modal */}
      <ConfirmationModal
        isOpen={showUnsavedChangesModal}
        onClose={handleStayOnPage}
        onConfirm={handleLeavePage}
        title="Unsaved Changes"
        message="You have unsaved changes. Are you sure you want to leave? Your changes will be lost."
        confirmText="Leave Page"
        cancelText="Stay on Page"
        type="warning"
      />

    </>
  );
  } catch (error) {
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
