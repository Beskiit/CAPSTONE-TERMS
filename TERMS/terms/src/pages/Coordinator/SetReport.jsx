import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import Header from "../../components/shared/Header.jsx";
import Breadcrumb from "../../components/Breadcrumb.jsx";
import Sidebar from "../../components/shared/SidebarCoordinator.jsx";
import SidebarPrincipal from "../../components/shared/SidebarPrincipal.jsx";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import toast from "react-hot-toast";
import "./SetReport.css";
import Laempl from "../../assets/templates/LAEMPL.png";
import LaemplTeacher from "../../assets/templates/LAEMPLTeacher.png";
import AccomplishmentReport from "../../assets/templates/accomplishment-report.png";
// import MpsTemplate from "../../assets/templates/mps.png";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:5000").replace(/\/$/, "");
console.log(import.meta.env.VITE_API_BASE);

// Preview mapping (category_id → sub_category_id → image)
const TEMPLATE_MAP = {
  "1": { "10": AccomplishmentReport },
  "2": { "20": Laempl },
  // "3": { "30": MpsTemplate },
};

function SetReport() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const role = (user?.role || "").toLowerCase();
  const isCoordinator = role === "coordinator";
  const isPrincipal = role === "principal";
  
  // Report editing state
  const [editingReportId, setEditingReportId] = useState(null);
  const [isEditingPrincipalReport, setIsEditingPrincipalReport] = useState(false);
  const [originalReportData, setOriginalReportData] = useState(null);
  const [subjectToExtractFromTitle, setSubjectToExtractFromTitle] = useState(null);

  const [users, setUsers] = useState([]);
  const [usersWithGrades, setUsersWithGrades] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [attempts, setAttempts] = useState("");
  const [allowLate, setAllowLate] = useState(false);
  const [activeYearQuarter, setActiveYearQuarter] = useState({ year: 1, quarter: 1 });
  
  // School year and quarter selection
  const [availableSchoolYears, setAvailableSchoolYears] = useState([]);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("");
  const [quarters, setQuarters] = useState([
    { value: 1, label: '1st Quarter' },
    { value: 2, label: '2nd Quarter' },
    { value: 3, label: '3rd Quarter' },
    { value: 4, label: '4th Quarter' }
  ]);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedTeachers, setSelectedTeachers] = useState([]); // For multiple teacher selection

  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [instruction, setInstruction] = useState("");
  const [title, setTitle] = useState("");

  // Date validation functions
  const getMinStartDate = () => {
    const today = new Date();
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);
    return oneWeekAgo.toISOString().split('T')[0];
  };

  const getMaxStartDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getMinDueDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getMaxDueDate = () => {
    const today = new Date();
    const oneMonthFromNow = new Date(today);
    oneMonthFromNow.setMonth(today.getMonth() + 1);
    return oneMonthFromNow.toISOString().split('T')[0];
  };

  const [showModal, setShowModal] = useState(false);

  // workflow management
  const [workflowType, setWorkflowType] = useState("direct"); // "direct" or "coordinated"
  const [selectedCoordinator, setSelectedCoordinator] = useState("");
  const [coordinators, setCoordinators] = useState([]);

  // Grade level and subject selection for LAEMPL & MPS
  const [gradeLevels, setGradeLevels] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedGradeLevel, setSelectedGradeLevel] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState([]);

  // NEW: prevent double-submit
  const [submitting, setSubmitting] = useState(false);
  const [teacherMenuOpen, setTeacherMenuOpen] = useState(false);
  const [subjectMenuOpen, setSubjectMenuOpen] = useState(false);
  const teacherMenuRef = useRef(null);
  const subjectMenuRef = useRef(null);

  // Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // LAEMPL & MPS assignments for grade level auto-fill
  const [laemplAssignments, setLaemplAssignments] = useState([]);
  
  // Store coordinator's inherited subject IDs for auto-population
  const [inheritedSubjectIds, setInheritedSubjectIds] = useState([]);

  // Preview image resolver
  const previewSrc = useMemo(() => {
    if (!selectedCategory) return "";
    
    // For Accomplishment Report (category_id = 0), show preview directly
    if (String(selectedCategory) === "0") {
      return TEMPLATE_MAP["1"]["10"]; // Accomplishment Report template
    }
    
    if (!selectedSubCategory) return "";
    
    // Special handling for LAEMPL & MPS based on user role
    if (String(selectedCategory) === "2" && String(selectedSubCategory) === "3") {
      // Check if any of the selected users are teachers
      const allSelectedUsers = [...selectedTeachers, selectedTeacher].filter(Boolean);
      const hasTeacherSelected = allSelectedUsers.some(userId => {
        const user = users.find(u => u.user_id === userId);
        return user && user.role && user.role.toLowerCase() === "teacher";
      });
      
      if (hasTeacherSelected) {
        return LaemplTeacher; // Show teacher template
      }
      return Laempl; // Show coordinator template
    }
    
    const cat = TEMPLATE_MAP[String(selectedCategory)];
    return cat ? cat[String(selectedSubCategory)] || "" : "";
  }, [selectedCategory, selectedSubCategory, selectedTeacher, selectedTeachers, users]);

  // Merge teachers + coordinators for principals, with grade filtering for LAEMPL & MPS
  const selectableUsers = useMemo(() => {
    const isLAEMPLMPS = selectedSubCategory === "3"; // LAEMPL & MPS sub-category ID
    
    if (isLAEMPLMPS && selectedGradeLevel) {
      // Filter users by grade level for LAEMPL & MPS, but always include coordinators
      const filteredTeachers = usersWithGrades.filter(user => 
        user.grade_level == selectedGradeLevel
      );
      
      // Always include coordinators (they don't have grade_level in usersWithGrades)
      const coordinatorsList = Array.isArray(coordinators) ? coordinators : [];
      const byId = new Map();
      
      // Add filtered teachers
      filteredTeachers.forEach((u) => {
        if (u && u.user_id != null) byId.set(u.user_id, u);
      });
      
      // Add coordinators (they should always be available for LAEMPL & MPS)
      coordinatorsList.forEach((u) => {
        if (u && u.user_id != null) byId.set(u.user_id, u);
      });
      
      return Array.from(byId.values());
    }
    
    // Default behavior for other report types
    const base = Array.isArray(users) ? users : [];
    if (!isPrincipal) return base;
    const extra = Array.isArray(coordinators) ? coordinators : [];
    const byId = new Map();
    [...base, ...extra].forEach((u) => {
      if (!u || u.user_id == null) return;
      byId.set(u.user_id, u);
    });
    return Array.from(byId.values());
  }, [isPrincipal, users, coordinators, usersWithGrades, selectedSubCategory, selectedGradeLevel]);

  // Check if any selected teachers have coordinator role
  const hasCoordinatorSelected = useMemo(() => {
    const allSelectedUsers = [...selectedTeachers, selectedTeacher].filter(Boolean);
    return allSelectedUsers.some(userId => {
      const user = usersWithGrades.find(u => u.user_id === userId);
      return user?.role?.toLowerCase() === 'coordinator';
    });
  }, [selectedTeachers, selectedTeacher, usersWithGrades]);

  // Get the selected coordinator ID for LAEMPL & MPS
  const selectedCoordinatorId = useMemo(() => {
    if (!isPrincipal || selectedSubCategory !== "3") return null;
    const allSelectedUsers = [...selectedTeachers, selectedTeacher].filter(Boolean);
    const coordinator = allSelectedUsers.find((userId) => {
      const user = usersWithGrades.find(u => u.user_id === userId);
      return user?.role?.toLowerCase() === 'coordinator';
    });
    return coordinator ?? null;
  }, [isPrincipal, selectedSubCategory, selectedTeachers, selectedTeacher, usersWithGrades]);

  // ✅ Load logged-in user
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

  // ✅ Check for report editing parameters and load report data
  useEffect(() => {
    const reportId = searchParams.get('reportId');
    const isPrincipalReport = searchParams.get('isPrincipalReport') === 'true';
    
    if (reportId && isPrincipalReport && isCoordinator) {
      setEditingReportId(reportId);
      setIsEditingPrincipalReport(true);
      loadReportData(reportId);
    }
  }, [searchParams, isCoordinator]);

  // ✅ Load active year and quarter
  useEffect(() => {
    const fetchActiveYearQuarter = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/active-year-quarter-for-reports`, {
          credentials: "include",
        });
        if (!res.ok) {
          console.warn("No active year/quarter set, using defaults");
          return;
        }
        const data = await res.json();
        setActiveYearQuarter(data);
      } catch (err) {
        console.error("Failed to fetch active year/quarter:", err);
      }
    };
    fetchActiveYearQuarter();
  }, []);

  // ✅ Load available school years
  useEffect(() => {
    const fetchSchoolYears = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/school-years`, {
          credentials: "include",
        });
        if (!res.ok) {
          console.warn("Failed to fetch school years");
          return;
        }
        const data = await res.json();
        setAvailableSchoolYears(data);
        
        // Set default selection to the first available year if none selected
        if (data.length > 0 && !selectedSchoolYear) {
          setSelectedSchoolYear(data[0].school_year);
        }
      } catch (err) {
        console.error("Failed to fetch school years:", err);
      }
    };
    fetchSchoolYears();
  }, []);

  // ✅ Load teachers (users)
  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const res = await fetch(`${API_BASE}/users/teachers`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch teachers");
        const data = await res.json(); // [{ user_id, name }]
        setUsers(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTeachers();
  }, []);

  // ✅ Load coordinators (for principals to assign through coordinators)
  useEffect(() => {
    const fetchCoordinators = async () => {
      try {
        const res = await fetch(`${API_BASE}/users/coordinators`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch coordinators");
        const data = await res.json(); // [{ user_id, name }]
        setCoordinators(data);
      } catch (err) {
        console.error(err);
      }
    };
    if (isPrincipal) {
      fetchCoordinators();
    }
  }, [isPrincipal]);

  // ✅ Fetch LAEMPL & MPS assignments for principals
  useEffect(() => {
    if (!isPrincipal) return;

    const fetchLaemplAssignments = async () => {
      try {
        const res = await fetch(`${API_BASE}/reports/laempl-mps/assignments`, {
          credentials: "include",
        });
        if (!res.ok) {
          console.warn("[SetReport] Failed to fetch LAEMPL & MPS assignments, status:", res.status);
          return;
        }
        const data = await res.json();
        console.log("[SetReport] Fetched LAEMPL & MPS assignments:", data);
        setLaemplAssignments(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("[SetReport] Failed to fetch LAEMPL & MPS assignments:", err);
      }
    };

    fetchLaemplAssignments();
  }, [isPrincipal]);

  // ✅ Auto-fill grade level when coordinator is selected for LAEMPL & MPS
  useEffect(() => {
    if (!isPrincipal || selectedSubCategory !== "3") return;
    if (!selectedCoordinatorId) {
      // Clear grade level if no coordinator selected
      if (selectedGradeLevel) setSelectedGradeLevel("");
      return;
    }

    const fetchGradeLevel = async () => {
      try {
        console.log("[SetReport] Fetching grade level for coordinator ID:", selectedCoordinatorId);
        
        // First, try to get from LAEMPL & MPS assignments
        const assignment = laemplAssignments.find(
          (a) => Number(a.coordinator_user_id) === Number(selectedCoordinatorId)
        );

        if (assignment?.grade_level_id) {
          const gl = String(assignment.grade_level_id);
          console.log("[SetReport] Setting grade level to:", gl, "(from LAEMPL & MPS assignment)");
          if (selectedGradeLevel !== gl) setSelectedGradeLevel(gl);
          return;
        }

        // Fallback to coordinator_grade table
        console.log("[SetReport] No LAEMPL & MPS assignment found, checking coordinator_grade table");
        const cgRes = await fetch(`${API_BASE}/users/coordinator-grade/${selectedCoordinatorId}`, {
          credentials: "include",
        });
        
        if (cgRes.ok) {
          const cgData = await cgRes.json();
          if (cgData?.grade_level_id) {
            const gl = String(cgData.grade_level_id);
            console.log("[SetReport] Setting grade level to:", gl, "(from coordinator_grade table - fallback)");
            if (selectedGradeLevel !== gl) setSelectedGradeLevel(gl);
          } else {
            console.log("[SetReport] No grade level found in coordinator_grade table");
            if (selectedGradeLevel) setSelectedGradeLevel("");
          }
        } else if (cgRes.status === 404) {
          console.log("[SetReport] Coordinator grade not found (404)");
          if (selectedGradeLevel) setSelectedGradeLevel("");
        }
      } catch (err) {
        console.error("[SetReport] Failed to fetch coordinator grade:", err);
        if (selectedGradeLevel) setSelectedGradeLevel("");
      }
    };

    fetchGradeLevel();
  }, [isPrincipal, selectedSubCategory, selectedCoordinatorId, laemplAssignments, selectedGradeLevel]);

  // Lock grade level when it's auto-filled for LAEMPL & MPS
  const shouldLockGradeLevel = useMemo(() => {
    return isPrincipal && selectedSubCategory === "3" && selectedCoordinatorId != null && selectedGradeLevel != null;
  }, [isPrincipal, selectedSubCategory, selectedCoordinatorId, selectedGradeLevel]);

  // ✅ Load categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_BASE}/categories`);
        if (!res.ok) return;
        const data = await res.json();
        setCategories(data);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      }
    };
    fetchCategories();
  }, []);

  // ✅ Load subcategories whenever category changes
  useEffect(() => {
    if (!selectedCategory) {
      setSubCategories([]);
      return;
    }
    const fetchSubCategories = async () => {
      try {
        const res = await fetch(`${API_BASE}/subcategories/${selectedCategory}`);
        if (!res.ok) return;
        const data = await res.json();
        setSubCategories(data); // expects [{sub_category_id, sub_category_name}, ...]
      } catch (err) {
        console.error("Failed to fetch subcategories:", err);
      }
    };
    fetchSubCategories();
  }, [selectedCategory]);

  // ✅ Load grade levels
  useEffect(() => {
    const fetchGradeLevels = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/grade-levels`);
        if (!res.ok) return;
        const data = await res.json();
        setGradeLevels(data);
      } catch (err) {
        console.error("Failed to fetch grade levels:", err);
      }
    };
    fetchGradeLevels();
  }, []);

  // ✅ Auto-populate grade level for coordinators when Category is "Quarterly Achievement Test" and Sub-Category is "LAEMPL & MPS"
  useEffect(() => {
    // Only for coordinators
    if (!isCoordinator || !user?.user_id) return;
    
    // Include editingReportId in dependencies so we refetch when editing a different assignment
    
    // Check if Category is "Quarterly Achievement Test" (category_id = 1) and Sub-Category is "LAEMPL & MPS" (sub_category_id = 3)
    const isQuarterlyAchievementTest = String(selectedCategory) === "1";
    const isLAEMPLMPS = String(selectedSubCategory) === "3";
    
    if (!isQuarterlyAchievementTest || !isLAEMPLMPS) {
      // Clear grade level if conditions are not met
      if (selectedGradeLevel && isQuarterlyAchievementTest && !isLAEMPLMPS) {
        // Only clear if we're still on Quarterly Achievement Test but not LAEMPL & MPS
        // Don't clear if category changed
      }
      return;
    }

    // Fetch coordinator's assigned grade level from report_assignment
    const fetchCoordinatorGrade = async () => {
      try {
        console.log("[SetReport] Fetching coordinator's LAEMPL & MPS grade level for user:", user.user_id);
        const res = await fetch(`${API_BASE}/reports/laempl-mps/coordinator-grade`, {
          credentials: "include"
        });
        
        if (!res.ok) {
          console.warn("[SetReport] Failed to fetch coordinator grade level, status:", res.status);
          return;
        }
        
        const data = await res.json();
        console.log("[SetReport] Coordinator grade level data:", data);
        console.log("[SetReport] Full API response:", JSON.stringify(data, null, 2));
        
        if (data?.grade_level_id) {
          const gradeLevelId = String(data.grade_level_id);
          console.log("[SetReport] Setting grade level to:", gradeLevelId, "(Grade", data.grade_level, ")");
          if (selectedGradeLevel !== gradeLevelId) {
            setSelectedGradeLevel(gradeLevelId);
          }
          
          // Store subject IDs for auto-population (will be set when subjects list is loaded)
          // BUT skip if we're editing a specific report (extracting from title)
          if (editingReportId) {
            console.log("[SetReport] Skipping inherited subjects - editing specific report, will extract from title");
            setInheritedSubjectIds([]);
          } else if (data?.subject_ids && Array.isArray(data.subject_ids) && data.subject_ids.length > 0) {
            const subjectIds = data.subject_ids.map(id => String(id));
            console.log("[SetReport] Storing inherited subject IDs:", subjectIds);
            setInheritedSubjectIds(subjectIds);
          } else {
            console.log("[SetReport] No subjects found for coordinator's LAEMPL & MPS assignment. subject_ids:", data?.subject_ids);
            setInheritedSubjectIds([]);
          }
        } else {
          console.log("[SetReport] No grade level assigned to coordinator for LAEMPL & MPS");
          setInheritedSubjectIds([]);
          // Don't clear existing selection if no assignment found
        }
      } catch (err) {
        console.error("[SetReport] Failed to fetch coordinator grade level:", err);
      }
    };

    fetchCoordinatorGrade();
  }, [isCoordinator, user?.user_id, selectedCategory, selectedSubCategory, selectedGradeLevel, editingReportId, subjectToExtractFromTitle]);

  // ✅ Auto-populate subjects when they're loaded and we have inherited subject IDs
  useEffect(() => {
    // Only for coordinators with LAEMPL & MPS
    if (!isCoordinator) return;
    const isQuarterlyAchievementTest = String(selectedCategory) === "1";
    const isLAEMPLMPS = String(selectedSubCategory) === "3";
    if (!isQuarterlyAchievementTest || !isLAEMPLMPS) {
      setInheritedSubjectIds([]);
      return;
    }
    
    // Skip auto-population if we're extracting subject from title (editing specific report)
    if (subjectToExtractFromTitle) {
      console.log("[SetReport] Skipping inherited subjects auto-population - extracting from title instead");
      return;
    }
    
    console.log("[SetReport] Subject auto-population check:", {
      inheritedSubjectIds,
      subjectsCount: subjects.length,
      selectedSubjectsCount: selectedSubjects.length
    });
    
    // If we have inherited subject IDs and subjects are loaded, auto-populate
    if (inheritedSubjectIds.length > 0 && subjects.length > 0) {
      // Verify that the subject IDs exist in the available subjects list
      const validSubjectIds = inheritedSubjectIds.filter(id => 
        subjects.some(s => String(s.subject_id) === id)
      );
      
      console.log("[SetReport] Valid subject IDs after filtering:", validSubjectIds);
      
      if (validSubjectIds.length > 0) {
        // Convert to numbers to match subject.subject_id type
        const numericSubjectIds = validSubjectIds.map(id => Number(id));
        
        // Only set if the current selection is different or empty
        if (selectedSubjects.length === 0 || 
            selectedSubjects.length !== numericSubjectIds.length ||
            !numericSubjectIds.every(id => selectedSubjects.includes(id))) {
          console.log("[SetReport] Auto-populating subjects:", numericSubjectIds);
          setSelectedSubjects(numericSubjectIds);
        } else {
          console.log("[SetReport] Subjects already match, skipping auto-population");
        }
      } else {
        console.log("[SetReport] No valid subject IDs found after filtering with available subjects");
      }
    } else {
      console.log("[SetReport] Waiting for subjects to load or inherited IDs. inheritedSubjectIds:", inheritedSubjectIds.length, "subjects:", subjects.length);
    }
  }, [isCoordinator, selectedCategory, selectedSubCategory, inheritedSubjectIds, subjects, selectedSubjects, subjectToExtractFromTitle]);

  // ✅ Extract and set subject from report title when editing
  useEffect(() => {
    // Only for LAEMPL & MPS reports when we have a subject name to extract
    if (!subjectToExtractFromTitle || 
        String(selectedCategory) !== "1" || 
        String(selectedSubCategory) !== "3" ||
        subjects.length === 0) {
      return;
    }
    
    console.log('[SetReport] Looking for subject:', subjectToExtractFromTitle, 'in', subjects.length, 'subjects');
    
    const matchingSubject = subjects.find(s => {
      const subjectName = s.subject_name?.trim();
      // Try exact match first
      if (subjectName === subjectToExtractFromTitle) return true;
      // Try matching if subject name starts with the extracted name (handles cases like "GMRC (15 - 25 points)")
      if (subjectName && subjectName.startsWith(subjectToExtractFromTitle)) return true;
      // Try matching if extracted name starts with subject name
      if (subjectToExtractFromTitle.startsWith(subjectName)) return true;
      return false;
    });
    
    if (matchingSubject) {
      console.log('[SetReport] Found matching subject from title:', matchingSubject.subject_id, matchingSubject.subject_name);
      // Set ONLY this subject (clear any other selections)
      setSelectedSubjects([matchingSubject.subject_id]);
      // Clear inherited subject IDs to prevent auto-population from overriding
      setInheritedSubjectIds([]);
      // Clear the extraction flag
      setSubjectToExtractFromTitle(null);
    } else {
      console.log('[SetReport] No matching subject found for:', subjectToExtractFromTitle, 'Available subjects:', subjects.map(s => s.subject_name));
      // Clear the extraction flag even if not found to prevent infinite loop
      setSubjectToExtractFromTitle(null);
    }
  }, [subjectToExtractFromTitle, subjects, selectedCategory, selectedSubCategory, selectedSubjects]);

  // ✅ Load subjects when grade level changes
  useEffect(() => {
    if (!selectedGradeLevel) {
      setSubjects([]);
      setSelectedSubjects([]);
      return;
    }
    const fetchSubjects = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/subjects/${selectedGradeLevel}`);
        if (!res.ok) return;
        const data = await res.json();
        setSubjects(data);
      } catch (err) {
        console.error("Failed to fetch subjects:", err);
      }
    };
    fetchSubjects();
  }, [selectedGradeLevel]);

  // ✅ Load users with their grade assignments
  useEffect(() => {
    const fetchUsersWithGrades = async () => {
      try {
        const res = await fetch(`${API_BASE}/users/teachers`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        setUsers(data);
        
        // Fetch grade assignments for each user
        const usersWithGradeData = await Promise.all(
          data.map(async (user) => {
            try {
              const gradeRes = await fetch(`${API_BASE}/users/teacher-section/${user.user_id}`, {
                credentials: "include",
              });
              if (gradeRes.ok) {
                const gradeData = await gradeRes.json();
                return { ...user, grade_level: gradeData.grade_level };
              } else if (gradeRes.status === 404) {
                // User has no teacher-section assignment, which is normal
                return { ...user, grade_level: null };
              } else {
                console.warn(`Failed to fetch grade for user ${user.user_id}: ${gradeRes.status}`);
                return { ...user, grade_level: null };
              }
            } catch (err) {
              console.warn(`Failed to fetch grade for user ${user.user_id}:`, err);
              return { ...user, grade_level: null };
            }
          })
        );
        setUsersWithGrades(usersWithGradeData);
      } catch (err) {
        console.error("Failed to fetch users with grades:", err);
      }
    };
    fetchUsersWithGrades();
  }, []);

  // Decide report type using sub-category name (preferred) or known IDs (fallback)
  function detectReportType(subCategories, selectedSubCategoryId, selectedCategoryId) {
    // Check if this is Accomplishment Report (category_id = 0)
    if (String(selectedCategoryId) === "0") {
      return "accomplishment";
    }

    const sub = subCategories.find(
      (s) => String(s.sub_category_id) === String(selectedSubCategoryId)
    );
    const name = (sub?.sub_category_name || "").toLowerCase();

    if (name.includes("laempl")) return "laempl";
    if (name.includes("mps")) return "mps";

    // Optional fallback by ID (adjust to match your DB if you like)
    const id = Number(selectedSubCategoryId);
    if ([20].includes(id)) return "laempl"; // e.g., 20 = LAEMPL
    if ([30].includes(id)) return "mps"; // e.g., 30 = MPS

    return "generic";
  }

  // Load report data for editing
  const loadReportData = async (reportId) => {
    try {
      console.log('🔄 [DEBUG] Loading report data for editing:', reportId);
      console.log('🔄 [DEBUG] API_BASE:', API_BASE);
      
      const res = await fetch(`${API_BASE}/reports/assignment/${reportId}`, {
        credentials: "include"
      });
      
      console.log('🔄 [DEBUG] Response status:', res.status, res.statusText);
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        console.error('🔄 [DEBUG] Response error:', errorText);
        throw new Error(`Failed to fetch report data: ${res.status} ${res.statusText}. ${errorText}`);
      }
      
      const reportData = await res.json();
      console.log('🔄 [DEBUG] Loaded report data:', reportData);
      
      if (!reportData || !reportData.report_assignment_id) {
        throw new Error('Invalid report data received from server');
      }

      // Guard: coordinators cannot edit when already given (unless coming from AssignedReport)
      const fromAssignedReport = location.state?.fromAssignedReport || location.state?.prefillData;
      if (isCoordinator && (reportData?.is_given === 1 || reportData?.is_given === '1') && !fromAssignedReport) {
        toast.error('This report has already been given to teachers.');
        navigate(-1);
        return;
      }
      
      // If coming from AssignedReport and report is already given, show a warning but allow editing
      if (isCoordinator && (reportData?.is_given === 1 || reportData?.is_given === '1') && fromAssignedReport) {
        toast('This report has already been given to teachers. Changes may affect existing submissions.', {
          icon: '⚠️',
          style: {
            background: '#f59e0b',
            color: '#fff',
          },
        });
      }
      
      // Store original data
      setOriginalReportData(reportData);
      
      // Pre-fill form with principal's settings
      if (reportData.title) setTitle(reportData.title);
      if (reportData.category_id !== undefined && reportData.category_id !== null) {
        setSelectedCategory(String(reportData.category_id));
      }
      if (reportData.sub_category_id !== undefined && reportData.sub_category_id !== null) {
        setSelectedSubCategory(String(reportData.sub_category_id));
      }
      if (reportData.instruction) setInstruction(reportData.instruction);
      if (reportData.allow_late !== undefined) setAllowLate(reportData.allow_late === 1);
      if (reportData.number_of_submission !== undefined) {
        setAttempts(reportData.number_of_submission === null ? "unlimited" : reportData.number_of_submission.toString());
      }
      
      // Set dates
      if (reportData.from_date) {
        const startDate = new Date(reportData.from_date);
        setStartDate(startDate.toISOString().split('T')[0]);
      }
      if (reportData.to_date) {
        const dueDate = new Date(reportData.to_date);
        setDueDate(dueDate.toISOString().split('T')[0]);
      }
      
      // Set school year and quarter
      if (reportData.year) {
        // Find the school year that matches this year_id
        const matchingYear = availableSchoolYears.find(year => year.year_id === reportData.year);
        if (matchingYear) {
          setSelectedSchoolYear(matchingYear.school_year);
        }
      }
      if (reportData.quarter) {
        setSelectedQuarter(reportData.quarter.toString());
      }
      
      // Fetch and set assignees from submissions
      try {
        console.log('[SetReport] Fetching assignees for report:', reportId);
        const subRes = await fetch(`${API_BASE}/submissions/by-assignment/${reportId}`, {
          credentials: "include"
        });
        
        console.log('[SetReport] Submissions response status:', subRes.status);
        
        if (subRes.ok) {
          const submissions = await subRes.json();
          console.log('[SetReport] Received submissions:', submissions);
          
          // Get unique submitted_by user IDs (these are the assignees)
          const assigneeIds = [...new Set(submissions.map(s => s.submitted_by).filter(Boolean))];
          console.log('[SetReport] Extracted assignee IDs:', assigneeIds);
          
          if (assigneeIds.length > 0) {
            // Always use selectedTeachers for the multi-select UI
            // Convert all assignee IDs to strings for consistency
            const assigneeIdsAsStrings = assigneeIds.map(id => String(id));
            console.log('[SetReport] Setting selectedTeachers to:', assigneeIdsAsStrings);
            setSelectedTeachers(assigneeIdsAsStrings);
            setSelectedTeacher(""); // Clear single selection since we're using multi-select
            console.log('[SetReport] Successfully loaded assignees:', assigneeIds);
          } else {
            console.warn('[SetReport] No assignees found in submissions');
          }
        } else {
          const errorText = await subRes.text().catch(() => 'Unknown error');
          console.error('[SetReport] Failed to fetch assignees. Status:', subRes.status, 'Error:', errorText);
        }
      } catch (err) {
        console.error('[SetReport] Error fetching assignees:', err);
      }
      
      // Extract subject from title for LAEMPL & MPS reports (format: "Title - SubjectName")
      if (reportData.title && 
          reportData.category_id === 1 && 
          reportData.sub_category_id === 3 && 
          reportData.title.includes(' - ')) {
        const subjectNameFromTitle = reportData.title.split(' - ').pop()?.trim();
        console.log('[SetReport] Extracted subject from title:', subjectNameFromTitle);
        
        // Store the subject name to match later when subjects list is loaded
        if (subjectNameFromTitle) {
          setSubjectToExtractFromTitle(subjectNameFromTitle);
          // Set grade level first if available, so subjects can load
          if (reportData.grade_level_id) {
            setSelectedGradeLevel(String(reportData.grade_level_id));
          }
        }
      } else {
        setSubjectToExtractFromTitle(null);
      }
      
      toast.success('Report data loaded. You can now modify the schedule before assigning to teachers.');
      
    } catch (error) {
      console.error('Error loading report data:', error);
      const errorMessage = error.message || 'Failed to load report data';
      toast.error(errorMessage);
      // Don't navigate away, let user see the error and try again
    }
  };

  // Update existing report assignment
  const updateExistingReport = async () => {
    try {
      console.log('🔄 [DEBUG] Updating existing report:', editingReportId);
      
      const reportType = detectReportType(subCategories, selectedSubCategory, selectedCategory);
      const numberValue = attempts === "" || attempts === "unlimited" ? null : Number(attempts);
      const recipients = selectedTeachers.length > 0 ? selectedTeachers : [selectedTeacher];
      
      // Get the year_id from the selected school year
      const selectedYearData = availableSchoolYears.find(year => year.school_year === selectedSchoolYear);
      const yearId = selectedYearData ? selectedYearData.year_id : (activeYearQuarter.year || 1);
      const quarterId = selectedQuarter ? Number(selectedQuarter) : (activeYearQuarter.quarter || 1);

      const updateData = {
        title: title || (reportType === "accomplishment" ? "Accomplishment Report" : 
                        reportType === "laempl" ? "LAEMPL Report" : 
                        reportType === "mps" ? "MPS Report" : "Report"),
        quarter: quarterId,
        year: yearId,
        from_date: startDate || null,
        to_date: dueDate,
        instruction,
        is_given: 1, // Update to pending when coordinator assigns to teachers
        allow_late: allowLate ? 1 : 0,
        number_of_submission: numberValue,
        assignees: recipients.map((x) => Number(x))
      };

      const res = await fetch(`${API_BASE}/reports/assignment/${editingReportId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updateData)
      });

      if (!res.ok) {
        const errText = await res.text();
        toast.error("Failed to update report: " + errText);
        return;
      }

      // Update status from 0 to 1 for existing submissions
      try {
        const updateResponse = await fetch(`${API_BASE}/reports/update-status-to-pending`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            category_id: Number(selectedCategory),
            sub_category_id: reportType === "accomplishment" ? null : Number(selectedSubCategory),
            quarter: quarterId,
            year: yearId,
            assignees: recipients.map((x) => Number(x))
          })
        });

        if (updateResponse.ok) {
          console.log("Updated existing reports from status 0 to 1");
        }
      } catch (error) {
        console.error("Failed to update existing reports:", error);
      }

      toast.success(`Report schedule updated successfully!`);
      
      // Redirect to Assigned Reports
      const redirectUrl = `/AssignedReport?year=${yearId}&quarter=${quarterId}`;
      navigate(redirectUrl);
      
    } catch (error) {
      console.error("Error updating report:", error);
      toast.error("Error updating report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- handleSubmit ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // guard against double-click

    // Basic validation
    if (!user?.user_id) {
      toast.error("User not loaded yet. Please try again in a moment.");
      return;
    }
    
    // Validate school year and quarter selection
    if (!selectedSchoolYear) {
      toast.error("Please select a school year.");
      return;
    }
    if (!selectedQuarter) {
      toast.error("Please select a quarter.");
      return;
    }
    
    // For Accomplishment Report (category_id = 0), subcategory is not required
    const isAccomplishmentReport = String(selectedCategory) === "0";
    if (!selectedCategory || !dueDate) {
      toast.error("Please complete Category and Due Date.");
      return;
    }
    if (!isAccomplishmentReport && !selectedSubCategory) {
      toast.error("Please complete Sub-Category.");
      return;
    }

    // Validate date ranges
    if (startDate) {
      const startDateObj = new Date(startDate);
      const minStartDate = new Date(getMinStartDate());
      const maxStartDate = new Date(getMaxStartDate());
      
      if (startDateObj < minStartDate || startDateObj > maxStartDate) {
        toast.error("Start date must be within the last week (one week ago to today).");
        return;
      }
    }

    if (dueDate) {
      const dueDateObj = new Date(dueDate);
      const minDueDate = new Date(getMinDueDate());
      const maxDueDate = new Date(getMaxDueDate());
      
      if (dueDateObj < minDueDate || dueDateObj > maxDueDate) {
        toast.error("Due date must be within the next month (today to one month from now).");
        return;
      }
    }

    // Validate that due date is not before start date
    if (startDate && dueDate) {
      const startDateObj = new Date(startDate);
      const dueDateObj = new Date(dueDate);
      
      if (dueDateObj < startDateObj) {
        toast.error("Due date cannot be before start date.");
        return;
      }
    }

    // Validate LAEMPL & MPS with subject selection
    const isLAEMPLMPS = selectedSubCategory === "3"; // LAEMPL & MPS sub-category ID
    if (isLAEMPLMPS) {
      if (!selectedGradeLevel) {
        toast.error("Please select a grade level for LAEMPL & MPS.");
        return;
      }
      // Always require subject selection for LAEMPL & MPS
      if (selectedSubjects.length === 0) {
        toast.error("Please select at least one subject for LAEMPL & MPS.");
        return;
      }
    }

    // Validate teacher selection based on workflow
    if (workflowType === "direct") {
      if (!selectedTeacher && selectedTeachers.length === 0) {
        toast.error("Please select at least one teacher.");
        return;
      }
    } else if (workflowType === "coordinated") {
      if (!selectedCoordinator) {
        toast.error("Please select a coordinator for the coordinated workflow.");
        return;
      }
      if (!selectedTeacher && selectedTeachers.length === 0) {
        toast.error("Please select at least one teacher.");
        return;
      }
    }

    // Show confirmation modal
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);

    try {
      // Handle editing existing principal's report
      // Previously this path UPDATED the existing assignment. Per new requirement,
      // coordinators should CREATE a new assignment instead, preserving original as-is.
      // if (isEditingPrincipalReport && editingReportId) {
      //   await updateExistingReport();
      //   return;
      // }

      const reportType = detectReportType(subCategories, selectedSubCategory, selectedCategory);

      // FIX: map attempts to INT or NULL (NULL = unlimited)
      const numberValue =
        attempts === "" || attempts === "unlimited" ? null : Number(attempts);

      const recipients =
        selectedTeachers.length > 0 ? selectedTeachers : [selectedTeacher];

      const givenBy =
        workflowType === "coordinated" ? Number(selectedCoordinator) : user.user_id;

      // Get the year_id from the selected school year
      const selectedYearData = availableSchoolYears.find(year => year.school_year === selectedSchoolYear);
      const yearId = selectedYearData ? selectedYearData.year_id : (activeYearQuarter.year || 1);
      const quarterId = selectedQuarter ? Number(selectedQuarter) : (activeYearQuarter.quarter || 1);

      // Determine if any recipients are coordinators
      const hasCoordinatorRecipients = recipients.some(userId => {
        const user = usersWithGrades.find(u => u.user_id === userId);
        return user?.role?.toLowerCase() === 'coordinator';
      });

      // Set status based on workflow:
      // - Principal → Coordinator: is_given = 0 (not given, shows upcoming deadline)
      // - Coordinator → Teacher: is_given = 1 (pending, allows normal flow)
      // - Principal → Teacher: is_given = 1 (pending, allows normal flow)
      const isGiven = (isPrincipal && hasCoordinatorRecipients) ? 0 : 1;

      // If coordinator is assigning to teachers, we need to update any existing 
      // reports with status 0 (from principal) to status 1 (pending)
      if (isCoordinator && !hasCoordinatorRecipients) {
        // This is coordinator assigning to teachers, so status should be 1
        // We'll also need to update any existing reports with status 0
      }

      const base = {
        category_id: Number(selectedCategory),
        sub_category_id: reportType === "accomplishment" ? null : Number(selectedSubCategory),
        given_by: Number(givenBy),
        assignees: recipients.map((x) => Number(x)),
        quarter: quarterId,
        year: yearId,
        from_date: startDate || null,
        to_date: dueDate,
        instruction,
        is_given: isGiven,
        is_archived: 0,
        allow_late: allowLate ? 1 : 0,
      };

      let endpoint = "";
      let body = {};
      const fallbackTitle =
        (title && title.trim()) ||
        (reportType === "accomplishment"
          ? "Accomplishment Report"
          : reportType === "laempl"
          ? "LAEMPL Report"
          : reportType === "mps"
          ? "MPS Report"
          : "Report");

      if (reportType === "accomplishment") {
        // Handle Accomplishment Report
        endpoint = `${API_BASE}/reports/accomplishment/give`;
        body = {
          ...base,
          title: fallbackTitle,
        };
      } else if (reportType === "laempl") {
        // Check if this is LAEMPL & MPS with subject selection
        const isLAEMPLMPS = selectedSubCategory === "3"; // LAEMPL & MPS sub-category ID
        if (isLAEMPLMPS && selectedGradeLevel && selectedSubjects.length > 0) {
          // For both coordinators and teachers: create separate submissions per subject
          // The laempl-mps endpoint automatically creates one assignment per subject
          const subjectIds = selectedSubjects.map((id) => Number(id));
          
          // Determine assignees based on whether coordinator or teachers are selected
          let assigneesList = [];
          if (hasCoordinatorSelected) {
            // Use the selected coordinator as assignee
            assigneesList = [selectedCoordinatorId];
          } else {
            // Use selected teachers as assignees
            assigneesList = selectedTeachers.length > 0 ? selectedTeachers : (selectedTeacher ? [selectedTeacher] : []);
          }
          
          // If no assignees selected and we're editing, try to get from original report's submissions
          if (assigneesList.length === 0 && editingReportId) {
            try {
              // Fetch submissions for this report to get the original assignees
              const subRes = await fetch(`${API_BASE}/submissions/by-assignment/${editingReportId}`, {
                credentials: "include"
              });
              if (subRes.ok) {
                const submissions = await subRes.json();
                if (submissions && submissions.length > 0) {
                  // Extract unique submitted_by user IDs
                  const originalAssignees = [...new Set(submissions.map(s => s.submitted_by).filter(Boolean))];
                  if (originalAssignees.length > 0) {
                    console.log("[SetReport] Using original assignees from submissions:", originalAssignees);
                    assigneesList = originalAssignees;
                  }
                }
              }
            } catch (err) {
              console.warn("[SetReport] Failed to fetch original assignees:", err);
            }
          }
          
          // Validate assignees are not empty
          if (assigneesList.length === 0) {
            toast.error('Please select at least one teacher or coordinator to assign this report to.');
            return;
          }
          
          // Ensure all assignees are valid numbers
          assigneesList = assigneesList.filter(id => id != null && !isNaN(Number(id))).map(id => Number(id));
          
          if (assigneesList.length === 0) {
            toast.error('Invalid assignees selected. Please select valid teachers or coordinators.');
            return;
          }
          
          endpoint = `${API_BASE}/reports/laempl-mps`;
          body = {
            ...base,
            assignees: assigneesList, // Set assignees (coordinator or teachers)
            title: fallbackTitle,
            grade_level_id: Number(selectedGradeLevel),
            subject_ids: subjectIds, // This will create one assignment per subject
            number_of_submission: numberValue, // INT or NULL
            parent_report_assignment_id: editingReportId || null // Link child assignments to parent if editing
          };
        } else {
          endpoint = `${API_BASE}/reports/laempl`;
          body = {
            ...base,
            title: fallbackTitle,
            grade: 1,
            number_of_submission: numberValue, // INT or NULL
          };
        }
      } else {
        // generic + MPS both go here (MPS rows filled by teacher UI later)
        endpoint = `${API_BASE}/reports/give`;
        body = {
          ...base,
          title: fallbackTitle,
          field_definitions: [],
          number_of_submission: numberValue, // INT or NULL
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        toast.error("Failed to set report: " + errText);
        return;
      }

      const data = await res.json();

      // After creating a new assignment (res received and data parsed):
      // Handle parent linking for both Accomplishment Reports and LAEMPL & MPS
      if (isCoordinator && editingReportId) {
        // editingReportId = parent/coordinator assignment
        // For LAEMPL & MPS, data.assignments is an array of assignments (one per subject)
        // For Accomplishment Reports, data.report_assignment_id is a single ID
        const assignmentsToLink = [];
        
        if (reportType === "laempl" && selectedSubCategory === "3" && data.assignments && Array.isArray(data.assignments)) {
          // LAEMPL & MPS: link all subject assignments to parent
          assignmentsToLink.push(...data.assignments.map(a => a.report_assignment_id));
        } else if (data.report_assignment_id) {
          // Accomplishment Report: single assignment
          assignmentsToLink.push(data.report_assignment_id);
        }
        
        // Link all assignments to the parent
        if (assignmentsToLink.length > 0) {
          try {
            // Link all assignments in parallel
            const linkPromises = assignmentsToLink.map(assignmentId => 
              fetch(`${API_BASE}/reports/accomplishment/link-parent`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  teacher_assignment_id: assignmentId,
                  coordinator_assignment_id: editingReportId
                })
              })
            );
            
            const linkResults = await Promise.allSettled(linkPromises);
            const successCount = linkResults.filter(r => r.status === 'fulfilled' && r.value.ok).length;
            console.log(`Parent assignment linked to ${successCount}/${assignmentsToLink.length} teacher assignment(s) automatically!`);
            
            if (successCount < assignmentsToLink.length) {
              console.warn("Some parent-link operations failed");
            }
          } catch (e) {
            console.warn("Parent-link API threw error:", e);
          }
        }
      }

      // If coordinator is assigning to teachers, update any existing reports 
      // with status 0 (from principal) to status 1 (pending)
      if (isCoordinator && !hasCoordinatorRecipients) {
        try {
          const updateResponse = await fetch(`${API_BASE}/reports/update-status-to-pending`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              category_id: Number(selectedCategory),
              sub_category_id: reportType === "accomplishment" ? null : Number(selectedSubCategory),
              quarter: quarterId,
              year: yearId,
              assignees: recipients.map((x) => Number(x))
            })
          });

          if (updateResponse.ok) {
            console.log("Updated existing reports from status 0 to 1");
          }
        } catch (error) {
          console.error("Failed to update existing reports:", error);
          // Don't fail the main operation if status update fails
        }
      }

      // If this was editing a principal's report, mark the original as given
      if (isEditingPrincipalReport && editingReportId) {
        try {
          const markGivenResponse = await fetch(`${API_BASE}/reports/assignment/${editingReportId}/mark-given`, {
            method: "POST",
            credentials: "include"
          });

          if (markGivenResponse.ok) {
            console.log("Marked original report assignment as given");
          }
        } catch (error) {
          console.error("Failed to mark original assignment as given:", error);
          // Don't fail the main operation if this fails
        }
      }

      const workflowMessage =
        workflowType === "coordinated"
          ? "Report assigned to coordinator for distribution to teachers!"
          : "Report assigned directly to teachers!";

      // If backend returns submission_ids, great; otherwise we at least show RA id.
      const subCount = Array.isArray(data.submission_ids)
        ? ` Created ${data.submission_ids.length} submission record(s).`
        : "";

      toast.success(`Report has been set successfully!`);

      // Redirect to Assigned Reports with pre-selected school year and quarter
      const redirectUrl = `/AssignedReport?year=${yearId}&quarter=${quarterId}`;
      console.log('Redirecting to:', redirectUrl, 'with selected year:', yearId, 'quarter:', quarterId);
      navigate(redirectUrl);
    } catch (err) {
      console.error("Error submitting report:", err);
      toast.error("Error submitting report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- Teacher multi-select helpers ---
  const toggleTeacher = (userId) => {
    const userIdStr = String(userId);
    setSelectedTeachers((prev) =>
      prev.includes(userIdStr)
        ? prev.filter((id) => id !== userIdStr)
        : prev.concat(userIdStr)
    );
  };
  const selectAllTeachers = () => setSelectedTeachers(selectableUsers.map((u) => String(u.user_id)));
  const clearAllTeachers = () => setSelectedTeachers([]);

  // --- Subject selection helpers ---
  const toggleSubject = (subjectId) => {
    setSelectedSubjects((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : prev.concat(subjectId)
    );
  };
  const selectAllSubjects = () => setSelectedSubjects(subjects.map((s) => s.subject_id));
  const clearAllSubjects = () => setSelectedSubjects([]);

  // Close teacher menu on outside click
  useEffect(() => {
    function onDocClick(e) {
      if (!teacherMenuOpen) return;
      if (teacherMenuRef.current && !teacherMenuRef.current.contains(e.target)) {
        setTeacherMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [teacherMenuOpen]);

  // Close subject menu on outside click
  useEffect(() => {
    function onDocClick(e) {
      if (!subjectMenuOpen) return;
      if (subjectMenuRef.current && !subjectMenuRef.current.contains(e.target)) {
        setSubjectMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [subjectMenuOpen]);

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container" style={{ overflowY: "auto" }}>
        {isCoordinator ? (
          <Sidebar activeLink="Set Report Schedule" />
        ) : (
          <SidebarPrincipal activeLink="Set Report Schedule" />
        )}

        <div className="dashboard-content">
          <Breadcrumb />
          <div className="dashboard-main">

            <form className="schedule-form" onSubmit={handleSubmit}>
              <div className="form-row allow-late-row">
                <label>Title:</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isCoordinator}
                />
              </div>

              <div className="form-row">
                <label>School Year:</label>
                <select
                  value={selectedSchoolYear}
                  onChange={(e) => setSelectedSchoolYear(e.target.value)}
                  required
                  disabled={isCoordinator}
                >
                  <option value="">Select School Year</option>
                  {availableSchoolYears.map((year) => (
                    <option key={year.year_id} value={year.school_year}>
                      {year.school_year}
                    </option>
                  ))}
                </select>

                <label>Quarter:</label>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value)}
                  required
                  disabled={isCoordinator}
                >
                  <option value="">Select Quarter</option>
                  {quarters.map((quarter) => (
                    <option key={quarter.value} value={quarter.value}>
                      {quarter.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label>Category:</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedSubCategory("");
                  }}
                  disabled={isCoordinator}
                >
                  <option value="">Select Category</option>
                  {categories.map((category) => (
                    <option
                      key={category.category_id}
                      value={category.category_id}
                    >
                      {category.category_name}
                    </option>
                  ))}
                </select>

                {/* Teachers multi-select dropdown placed in same row */}
                <label>Teachers & Coordinators:</label>
                <div ref={teacherMenuRef} style={{ position: "relative", width: "100%" }}>
                  <button
                    className="teacher-trigger"
                    type="button"
                    onClick={() => setTeacherMenuOpen((v) => !v)}
                    aria-haspopup="listbox"
                    aria-expanded={teacherMenuOpen}
                    title={
                      selectedTeachers.length
                        ? selectableUsers
                            .filter(u => selectedTeachers.includes(String(u.user_id)))
                            .map(u => u.name)
                            .join(", ")
                        : "Select Teachers & Coordinators"
                    }
                  >
                    <span className="teacher-trigger-label">
                      {selectedTeachers.length > 0
                        ? (() => {
                            // Try to get names from selectableUsers
                            const matchedUsers = selectableUsers.filter(u => selectedTeachers.includes(String(u.user_id)));
                            
                            if (matchedUsers.length === 0) {
                              // Users not loaded yet, show count
                              return `${selectedTeachers.length} teacher${selectedTeachers.length > 1 ? 's' : ''} selected`;
                            }
                            
                            if (selectedTeachers.length === 1) {
                              return matchedUsers[0]?.name || `${selectedTeachers.length} teacher selected`;
                            } else if (selectedTeachers.length <= 3) {
                              const names = matchedUsers.map(u => u.name).join(", ");
                              return names || `${selectedTeachers.length} teachers selected`;
                            } else {
                              return `${selectedTeachers.length} teachers selected`;
                            }
                          })()
                        : "Select Teachers & Coordinators"}
                    </span>
                  </button>
                  {teacherMenuOpen && (
                    <div
                      role="listbox"
                      className="teacher-menu"
                    >
                      <div className="teacher-menu-header">
                        <label>
                          <input
                            className="menu-checkbox"
                            type="checkbox"
                            checked={selectedTeachers.length === selectableUsers.length && selectableUsers.length > 0}
                            onChange={(e) => (e.target.checked ? selectAllTeachers() : clearAllTeachers())}
                          />
                          <span>Select all</span>
                        </label>
                        <span className="teacher-menu-count">
                          {selectedTeachers.length} selected
                        </span>
                        <button type="button" onClick={clearAllTeachers} className="teacher-menu-clear">
                          Clear
                        </button>
                      </div>

                      <div className="teacher-menu-content">
                        {selectableUsers.map((u) => {
                          // Compare as strings to handle type mismatch
                          const checked = selectedTeachers.includes(String(u.user_id));
                          return (
                            <div
                              key={u.user_id}
                              onClick={() => toggleTeacher(String(u.user_id))}
                              className={`teacher-menu-item ${checked ? 'selected' : ''}`}
                            >
                              <input
                                className="menu-checkbox"
                                type="checkbox"
                                readOnly
                                checked={checked}
                              />
                              <span>{u.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedCategory && String(selectedCategory) !== "0" && (
                <div className="form-row">
                  <label>Sub-Category:</label>
                  <select
                    value={selectedSubCategory}
                    onChange={(e) => setSelectedSubCategory(e.target.value)}
                    disabled={isCoordinator}
                  >
                    <option value="">Select Sub-Category</option>
                    {subCategories.map((sub) => (
                      <option
                        key={sub.sub_category_id}
                        value={sub.sub_category_id}
                      >
                        {sub.sub_category_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Grade Level and Subject Selection for LAEMPL & MPS */}
              {selectedSubCategory === "3" && (
                <>
                  <div className="form-row">
                    <label>Grade Level:</label>
                    <select
                      value={selectedGradeLevel}
                      onChange={(e) => {
                        const newGradeLevel = e.target.value;
                        setSelectedGradeLevel(newGradeLevel);
                        setSelectedSubjects([]); // Clear subjects when grade changes
                        // Only clear teachers if no coordinator is selected (to preserve coordinator selection)
                        if (!hasCoordinatorSelected) {
                          setSelectedTeachers([]); // Clear teachers when grade changes (for LAEMPL & MPS)
                        }
                      }}
                      disabled={isCoordinator || shouldLockGradeLevel}
                    >
                      <option value="">Select Grade Level</option>
                      {gradeLevels.map((grade) => (
                        <option key={grade.grade_level_id} value={grade.grade_level_id}>
                          Grade {grade.grade_level}
                        </option>
                      ))}
                    </select>

                    {selectedGradeLevel && (
                      <>
                        <label>Subjects:</label>
                        <div ref={subjectMenuRef} style={{ position: "relative", width: "100%" }}>
                        <button
                          className="teacher-trigger"
                          type="button"
                          onClick={() => setSubjectMenuOpen((v) => !v)}
                          aria-haspopup="listbox"
                          aria-expanded={subjectMenuOpen}
                          title={
                            selectedSubjects.length
                              ? subjects
                                  .filter(s => selectedSubjects.includes(s.subject_id))
                                  .map(s => s.subject_name)
                                  .join(", ")
                              : "Select Subjects"
                          }
                        >
                          <span className="teacher-trigger-label">
                            {selectedSubjects.length
                              ? subjects
                                  .filter(s => selectedSubjects.includes(s.subject_id))
                                  .map(s => s.subject_name)
                                  .join(", ")
                              : "Select Subjects"}
                          </span>
                        </button>
                        {subjectMenuOpen && (
                          <div
                            role="listbox"
                            className="teacher-menu"
                            style={{ position: "absolute", zIndex: 10, background: "white", border: "1px solid #ccc", borderRadius: "4px", width: "100%", maxHeight: "200px", overflowY: "auto" }}
                          >
                            <div className="teacher-menu-header">
                              <label>
                                <input
                                  className="menu-checkbox"
                                  type="checkbox"
                                  checked={selectedSubjects.length === subjects.length && subjects.length > 0}
                                  onChange={(e) => (e.target.checked ? selectAllSubjects() : clearAllSubjects())}
                                />
                                <span>Select all</span>
                              </label>
                              <span className="teacher-menu-count">
                                {selectedSubjects.length} selected
                              </span>
                              <button type="button" onClick={clearAllSubjects} className="teacher-menu-clear">
                                Clear
                              </button>
                            </div>

                            <div className="teacher-menu-content">
                              {subjects.map((subject) => {
                                const checked = selectedSubjects.includes(subject.subject_id);
                                return (
                                  <div
                                    key={subject.subject_id}
                                    onClick={() => toggleSubject(subject.subject_id)}
                                    className={`teacher-menu-item ${checked ? 'selected' : ''}`}
                                  >
                                    <input
                                      className="menu-checkbox"
                                      type="checkbox"
                                      readOnly
                                      checked={checked}
                                    />
                                    <span>{subject.subject_name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              <div className="form-row">
                <label>Start Date:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={getMinStartDate()}
                  max={getMaxStartDate()}
                  title="Start date can be from one week ago to today"
                />

                <label>Due Date:</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={getMinDueDate()}
                  max={getMaxDueDate()}
                  title="Due date can be from today to one month from now"
                />
              </div>

              <div className="form-row allow-late-row">
                <label>Allow Late:</label>
                <input
                  type="checkbox"
                  checked={allowLate}
                  onChange={(e) => setAllowLate(e.target.checked)}
                />

                <label>Number of Attempts:</label>
                <select
                  className="attempts-select"
                  value={attempts}
                  onChange={(e) => setAttempts(e.target.value)}
                >
                  <option value="" disabled>
                    Select Number of Attempts
                  </option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                  <option value="unlimited">Unlimited</option>
                </select>
              </div>

              <div className="form-row-ins form-row textarea-row">
                <label>Instructions:</label>
                <textarea
                  placeholder="Enter instructions for the report"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                ></textarea>
              </div>

              <div className="form-actions">
                <button type="submit" disabled={submitting}>
                  {submitting ? "Setting..." : "Set Schedule"}
                </button>
              </div>
            </form>

            {/* Optional: preview image */}
            {previewSrc && (
              <div className="template-preview">
                <img src={previewSrc} alt="Template preview" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmit}
        title="Set Report Schedule"
        message="Are you sure you want to set this report schedule? This will assign the report to the selected teachers and they will be notified."
        confirmText="Set Schedule"
        cancelText="Cancel"
        type="info"
      />
    </>
  );
}

export default SetReport;
