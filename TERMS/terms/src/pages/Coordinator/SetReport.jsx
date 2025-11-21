import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams, useLocation, useParams } from "react-router-dom";
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
  const forceCreateAssignments = location.state?.forceCreate === true;
  const parentAssignmentIdFromState = location.state?.parentAssignmentId != null
    ? Number(location.state.parentAssignmentId)
    : null;
  // Track if this is an "Edit" action vs "Set as report to teachers" action
  const isEditAction = location.state?.isEditAction === true;
  const [user, setUser] = useState(null);
  const role = (user?.role || "").toLowerCase();
  const isCoordinator = role === "coordinator";
  const isPrincipal = role === "principal";
  
  // Report editing state
  const [editingReportId, setEditingReportId] = useState(null);
  const [isEditingPrincipalReport, setIsEditingPrincipalReport] = useState(false);
  const [isFromPrincipalAssignment, setIsFromPrincipalAssignment] = useState(false); // Track if report is from principal assignment
  const [isPrincipalReportParam, setIsPrincipalReportParam] = useState(false); // Track isPrincipalReport query parameter
  const [originalReportData, setOriginalReportData] = useState(null);
  const [subjectToExtractFromTitle, setSubjectToExtractFromTitle] = useState(null);
  
  // Track unsaved changes for beforeunload warning
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);

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
    
    // Check if this is coordinator's own assignment (not from principal)
    const isCoordinatorOwnAssignment = isCoordinator && !isFromPrincipalAssignment && !isPrincipalReportParam;
    
    // For Accomplishment Report (category_id = 0), show preview directly
    if (String(selectedCategory) === "0") {
      // Always show full template (coordinator/principal view) for Accomplishment Report
      return TEMPLATE_MAP["1"]["10"]; // Accomplishment Report template
    }
    
    if (!selectedSubCategory) return "";
    
    // Special handling for LAEMPL & MPS based on user role
    if (String(selectedCategory) === "2" && String(selectedSubCategory) === "3") {
      // If coordinator is creating their own assignment, show coordinator template (full template)
      if (isCoordinatorOwnAssignment) {
        return Laempl; // Show coordinator template for coordinator's own assignment
      }
      
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
  }, [selectedCategory, selectedSubCategory, selectedTeacher, selectedTeachers, users, isCoordinator, isFromPrincipalAssignment, isPrincipalReportParam]);

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
      
      // Filter out current user
      const result = Array.from(byId.values());
      if (user?.user_id) {
        return result.filter(u => String(u.user_id) !== String(user.user_id));
      }
      return result;
    }
    
    // Default behavior for other report types
    const base = Array.isArray(users) ? users : [];
    if (!isPrincipal) {
      // Filter out current user for coordinators
      if (user?.user_id) {
        return base.filter(u => String(u.user_id) !== String(user.user_id));
      }
      return base;
    }
    const extra = Array.isArray(coordinators) ? coordinators : [];
    const byId = new Map();
    [...base, ...extra].forEach((u) => {
      if (!u || u.user_id == null) return;
      byId.set(u.user_id, u);
    });
    // Filter out current user
    const result = Array.from(byId.values());
    if (user?.user_id) {
      return result.filter(u => String(u.user_id) !== String(user.user_id));
    }
    return result;
  }, [isPrincipal, users, coordinators, usersWithGrades, selectedSubCategory, selectedGradeLevel, user]);

  // Check if any selected teachers have coordinator role
  const hasCoordinatorSelected = useMemo(() => {
    const allSelectedUsers = [...selectedTeachers, selectedTeacher].filter(Boolean);
    return allSelectedUsers.some(userId => {
      const user =
        usersWithGrades.find((u) => String(u.user_id) === String(userId)) ||
        coordinators.find((u) => String(u.user_id) === String(userId));
      const role = user?.role ? user.role.toLowerCase() : 'coordinator';
      return role === 'coordinator';
    });
  }, [selectedTeachers, selectedTeacher, usersWithGrades, coordinators]);

  // Get the selected coordinator ID for LAEMPL & MPS
  const selectedCoordinatorId = useMemo(() => {
    if (!isPrincipal || selectedSubCategory !== "3") return null;
    const allSelectedUsers = [...selectedTeachers, selectedTeacher].filter(Boolean);
    const coordinator = allSelectedUsers.find((userId) => {
      const user =
        usersWithGrades.find((u) => String(u.user_id) === String(userId)) ||
        coordinators.find((u) => String(u.user_id) === String(userId));
      const role = user?.role ? user.role.toLowerCase() : 'coordinator';
      return role === 'coordinator';
    });
    return coordinator ?? null;
  }, [isPrincipal, selectedSubCategory, selectedTeachers, selectedTeacher, usersWithGrades, coordinators]);

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
    
    // Store the isPrincipalReport parameter in state
    setIsPrincipalReportParam(isPrincipalReport);
    
    if (reportId && isPrincipalReport && (isCoordinator || isPrincipal)) {
      setEditingReportId(reportId);
      setIsEditingPrincipalReport(true);
      loadReportData(reportId);
    } else if (!reportId) {
      // Reset state when not editing (creating new report)
      setEditingReportId(null);
      setIsEditingPrincipalReport(false);
      setIsFromPrincipalAssignment(false);
      setIsPrincipalReportParam(false);
    }
  }, [searchParams, isCoordinator, isPrincipal]);

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
        console.log('🔍 [DEBUG] Fetching teachers from:', `${API_BASE}/users/teachers`);
        const res = await fetch(`${API_BASE}/users/teachers`, { credentials: "include" });
        console.log('🔍 [DEBUG] Teachers response status:', res.status, res.statusText);
        if (!res.ok) {
          const errorText = await res.text();
          console.error('❌ [DEBUG] Failed to fetch teachers:', res.status, errorText);
          throw new Error(`Failed to fetch teachers: ${res.status} ${errorText}`);
        }
        const data = await res.json(); // [{ user_id, name }]
        console.log('✅ [DEBUG] Teachers fetched:', data.length, 'users', data);
        setUsers(data);
      } catch (err) {
        console.error('❌ [DEBUG] Error fetching teachers:', err);
        setUsers([]); // Set empty array on error
      }
    };
    fetchTeachers();
  }, []);

  // ✅ Load coordinators (for principals to assign through coordinators)
  useEffect(() => {
    const fetchCoordinators = async () => {
      try {
        console.log('🔍 [DEBUG] Fetching coordinators from:', `${API_BASE}/users/coordinators`);
        const res = await fetch(`${API_BASE}/users/coordinators`, { credentials: "include" });
        console.log('🔍 [DEBUG] Coordinators response status:', res.status, res.statusText);
        if (!res.ok) {
          const errorText = await res.text();
          console.error('❌ [DEBUG] Failed to fetch coordinators:', res.status, errorText);
          throw new Error(`Failed to fetch coordinators: ${res.status} ${errorText}`);
        }
        const data = await res.json(); // [{ user_id, name }]
        console.log('✅ [DEBUG] Coordinators fetched:', data.length, 'users', data);
        setCoordinators(data);
      } catch (err) {
        console.error('❌ [DEBUG] Error fetching coordinators:', err);
        setCoordinators([]); // Set empty array on error
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

        // Next, query the coordinator-grade lookup that reads directly from report_assignment
        try {
          const selectedYearData = availableSchoolYears.find(
            (year) => year.school_year === selectedSchoolYear
          );
          const yearId = selectedYearData?.year_id ?? activeYearQuarter.year ?? null;
          const quarterId = selectedQuarter ? Number(selectedQuarter) : activeYearQuarter.quarter ?? null;

          const params = new URLSearchParams();
          if (yearId != null) params.append("year", yearId);
          if (quarterId != null) params.append("quarter", quarterId);

          const coordinatorGradeUrl = `${API_BASE}/reports/laempl-mps/coordinator-grade/${selectedCoordinatorId}${
            params.toString() ? `?${params.toString()}` : ""
          }`;

          console.log("[SetReport] Checking report_assignment for coordinator grade via:", coordinatorGradeUrl);
          const directGradeRes = await fetch(coordinatorGradeUrl, { credentials: "include" });
          if (directGradeRes.ok) {
            const directGradeData = await directGradeRes.json();
            if (directGradeData?.grade_level_id) {
              const gl = String(directGradeData.grade_level_id);
              console.log("[SetReport] Setting grade level to:", gl, "(from report_assignment lookup)");
              if (selectedGradeLevel !== gl) setSelectedGradeLevel(gl);
              return;
            }
          } else if (directGradeRes.status !== 404) {
            console.warn("[SetReport] Coordinator grade lookup via report_assignment failed:", directGradeRes.status);
          }
        } catch (lookupErr) {
          console.warn("[SetReport] Failed to lookup coordinator grade via report_assignment:", lookupErr);
        }

        // No LAEMPL & MPS assignment found - leave grade level empty
        console.log("[SetReport] No LAEMPL & MPS assignment found for this coordinator. Leaving grade level empty.");
        if (selectedGradeLevel) setSelectedGradeLevel("");
      } catch (err) {
        console.error("[SetReport] Failed to fetch coordinator grade:", err);
        if (selectedGradeLevel) setSelectedGradeLevel("");
      }
    };

    fetchGradeLevel();
  }, [isPrincipal, selectedSubCategory, selectedCoordinatorId, laemplAssignments, selectedGradeLevel, availableSchoolYears, selectedSchoolYear, selectedQuarter, activeYearQuarter]);

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
          // OR if coordinator has already selected recipients (subjects should be manually selected)
          const hasSelectedRecipients = (selectedTeachers.length > 0) || 
                                        (selectedTeacher && String(selectedTeacher).trim() !== '');
          
          if (editingReportId) {
            console.log("[SetReport] Skipping inherited subjects - editing specific report, will extract from title");
            setInheritedSubjectIds([]);
          } else if (hasSelectedRecipients) {
            console.log("[SetReport] Skipping inherited subjects - recipients already selected, subjects must be manually selected");
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
  }, [isCoordinator, user?.user_id, selectedCategory, selectedSubCategory, selectedGradeLevel, editingReportId, subjectToExtractFromTitle, selectedTeachers, selectedTeacher]);

  // ✅ Auto-populate subjects when they're loaded and we have inherited subject IDs
  useEffect(() => {
    // Only for coordinators with LAEMPL & MPS
    if (!isCoordinator) return;
    const isQuarterlyAchievementTest = String(selectedCategory) === "1";
    const isLAEMPLMPS = String(selectedSubCategory) === "3";
    if (!isQuarterlyAchievementTest || !isLAEMPLMPS) {
      // Only clear if it's not already empty to prevent infinite loop
      if (inheritedSubjectIds.length > 0) {
        setInheritedSubjectIds([]);
      }
      return;
    }
    
    // Skip auto-population if we're extracting subject from title (editing specific report)
    if (subjectToExtractFromTitle) {
      console.log("[SetReport] Skipping inherited subjects auto-population - extracting from title instead");
      return;
    }
    
    // Skip auto-population when coordinator is assigning to teachers/coordinators
    // Check if coordinator has selected any teachers or coordinators to assign to
    const hasSelectedRecipients = (selectedTeachers.length > 0) || 
                                  (selectedTeacher && String(selectedTeacher).trim() !== '');
    
    if (hasSelectedRecipients || isFromPrincipalAssignment) {
      console.log("[SetReport] Skipping inherited subjects auto-population - coordinator assigning to teachers/coordinators, subjects should be manually selected", {
        hasSelectedRecipients,
        selectedTeachersCount: selectedTeachers.length,
        selectedTeacher,
        isFromPrincipalAssignment
      });
      return;
    }
    
    console.log("[SetReport] Subject auto-population check:", {
      inheritedSubjectIds,
      subjectsCount: subjects.length,
      selectedSubjectsCount: selectedSubjects.length,
      hasSelectedRecipients: false
    });
    
    // If we have inherited subject IDs and subjects are loaded, auto-populate
    // Only auto-populate when coordinator is creating their own assignment (no recipients selected)
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
  }, [isCoordinator, selectedCategory, selectedSubCategory, subjects, selectedSubjects, subjectToExtractFromTitle, isFromPrincipalAssignment, selectedTeachers, selectedTeacher]);

  // ✅ Clear selected subjects when coordinator selects recipients (teachers/coordinators)
  // This ensures subjects must be manually selected when assigning to others
  useEffect(() => {
    // Only for coordinators with LAEMPL & MPS
    if (!isCoordinator) return;
    const isQuarterlyAchievementTest = String(selectedCategory) === "1";
    const isLAEMPLMPS = String(selectedSubCategory) === "3";
    if (!isQuarterlyAchievementTest || !isLAEMPLMPS) return;
    
    // Skip if we're extracting subject from title (editing specific report)
    if (subjectToExtractFromTitle) return;
    
    // Check if coordinator has selected any teachers or coordinators to assign to
    const hasSelectedRecipients = (selectedTeachers.length > 0) || 
                                  (selectedTeacher && String(selectedTeacher).trim() !== '');
    
    // If recipients are selected, clear any auto-populated subjects
    // This ensures subjects must be manually selected when assigning to teachers/coordinators
    if (hasSelectedRecipients && selectedSubjects.length > 0) {
      // Check if the selected subjects match the inherited subject IDs (auto-populated)
      // If they do, clear them so user must manually select
      const hasInheritedSubjects = inheritedSubjectIds.length > 0 && 
        selectedSubjects.every(subjectId => 
          inheritedSubjectIds.some(inheritedId => Number(inheritedId) === subjectId)
        ) && 
        selectedSubjects.length === inheritedSubjectIds.length;
      
      if (hasInheritedSubjects) {
        console.log("[SetReport] Clearing auto-populated subjects because recipients are selected - subjects must be manually selected", {
          selectedSubjectsCount: selectedSubjects.length,
          inheritedSubjectIdsCount: inheritedSubjectIds.length
        });
        setSelectedSubjects([]);
        // Also clear inherited subject IDs to prevent re-population
        setInheritedSubjectIds([]);
      }
    }
  }, [isCoordinator, selectedCategory, selectedSubCategory, selectedTeachers, selectedTeacher, selectedSubjects, inheritedSubjectIds, subjectToExtractFromTitle]);

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
      const fromAssignedReport = location.state?.fromAssignedReport || location.state?.prefillData || forceCreateAssignments;
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
      // Reset form submission flag when loading existing report
      setIsFormSubmitted(false);
      
      // Check if this report is from a principal assignment
      // A report is from principal if it has parent_report_assignment_id or coordinator_user_id
      const hasParentAssignment = reportData.parent_report_assignment_id != null;
      const hasCoordinatorUserId = reportData.coordinator_user_id != null;
      const fromPrincipal = hasParentAssignment || hasCoordinatorUserId;
      setIsFromPrincipalAssignment(fromPrincipal);
      
      console.log('🔄 [DEBUG] Report assignment source:', {
        reportId: reportId,
        hasParentAssignment,
        hasCoordinatorUserId,
        fromPrincipal,
        parent_report_assignment_id: reportData.parent_report_assignment_id,
        coordinator_user_id: reportData.coordinator_user_id
      });
      
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
      // BUT: Do NOT inherit assignees when coordinator opens a principal's report
      // Coordinator should select their own teachers/coordinators to assign to
      const shouldInheritAssignees = !(isCoordinator && fromPrincipal);
      
      if (shouldInheritAssignees) {
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
      } else {
        console.log('[SetReport] Skipping assignee inheritance - coordinator opening principal report, should select own teachers/coordinators');
        // Clear any existing selections
        setSelectedTeachers([]);
        setSelectedTeacher("");
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
      let recipients = selectedTeachers.length > 0 ? selectedTeachers : [selectedTeacher];
      
      // Get the year_id from the selected school year
      const selectedYearData = availableSchoolYears.find(year => year.school_year === selectedSchoolYear);
      const yearId = selectedYearData ? selectedYearData.year_id : (activeYearQuarter.year || 1);
      const quarterId = selectedQuarter ? Number(selectedQuarter) : (activeYearQuarter.quarter || 1);

      // NOTE: When updating an existing report, we should UPDATE it, not create new assignments.
      // The "distributing from principal" logic only applies when CREATING new assignments,
      // not when editing existing ones. This function is called for UPDATES, so we skip that logic here.
      
      // Special handling for coordinator's own assignment (not from principal)
      // For coordinator's own assignment:
      // - Coordinator's assignment: only coordinator as assignee
      // - Teacher assignment (child): teachers as assignees
      const isCoordinatorOwnAssignment = isCoordinator && !isFromPrincipalAssignment && !isPrincipalReportParam;
      if (isCoordinatorOwnAssignment && (reportType === "accomplishment" || reportType === "laempl") && user?.user_id) {
        const coordinatorUserId = Number(user.user_id);
        const coordinatorUserIdStr = String(user.user_id);
        
        // Separate teachers from coordinator
        const teacherRecipients = recipients
          .filter(id => String(id) !== coordinatorUserIdStr)
          .map(id => Number(id));
        
        console.log('🔄 [DEBUG] Coordinator own assignment update:', {
          coordinatorUserId,
          teacherRecipients,
          originalRecipients: recipients
        });
        
        // Step 1: Update coordinator's assignment (coordinator only)
        const coordinatorUpdateData = {
          title: title || (reportType === "accomplishment" ? "Accomplishment Report" : 
                          reportType === "laempl" ? "LAEMPL Report" : 
                          reportType === "mps" ? "MPS Report" : "Report"),
          quarter: quarterId,
          year: yearId,
          from_date: startDate || null,
          to_date: dueDate,
          instruction,
          is_given: 1,
          allow_late: allowLate ? 1 : 0,
          number_of_submission: numberValue,
          assignees: [coordinatorUserId] // Coordinator only
        };
        
        const coordinatorRes = await fetch(`${API_BASE}/reports/assignment/${editingReportId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(coordinatorUpdateData)
        });
        
        if (!coordinatorRes.ok) {
          const errText = await coordinatorRes.text();
          toast.error("Failed to update coordinator assignment: " + errText);
          setSubmitting(false);
          return;
        }
        
        // Step 2: Find or create teacher assignment (child assignment)
        // First, try to find existing child assignment
        let teacherAssignmentId = null;
        try {
          const findChildRes = await fetch(`${API_BASE}/reports/assignment/${editingReportId}/child`, {
            credentials: "include"
          });
          if (findChildRes.ok) {
            const childData = await findChildRes.json();
            teacherAssignmentId = childData?.report_assignment_id || null;
            console.log('🔄 [DEBUG] Found existing child assignment:', teacherAssignmentId);
          }
        } catch (err) {
          console.warn('No existing child assignment found, will create new one:', err);
        }
        
        // Step 3: Update or create teacher assignment
        if (teacherRecipients.length > 0) {
          if (teacherAssignmentId) {
            // Update existing teacher assignment
            const teacherUpdateData = {
              title: title || (reportType === "accomplishment" ? "Accomplishment Report" : 
                              reportType === "laempl" ? "LAEMPL Report" : 
                              reportType === "mps" ? "MPS Report" : "Report"),
              quarter: quarterId,
              year: yearId,
              from_date: startDate || null,
              to_date: dueDate,
              instruction,
              is_given: 1,
              allow_late: allowLate ? 1 : 0,
              number_of_submission: numberValue,
              assignees: teacherRecipients
            };
            
            const teacherRes = await fetch(`${API_BASE}/reports/assignment/${teacherAssignmentId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(teacherUpdateData)
            });
            
            if (!teacherRes.ok) {
              const errText = await teacherRes.text();
              toast.error("Failed to update teacher assignment: " + errText);
              setSubmitting(false);
              return;
            }
            
            console.log('🔄 [DEBUG] Updated teacher assignment:', teacherAssignmentId);
          } else {
            // Create new teacher assignment
            const base = {
              category_id: Number(selectedCategory),
              sub_category_id: reportType === "accomplishment" ? null : Number(selectedSubCategory),
              given_by: coordinatorUserId,
              quarter: quarterId,
              year: yearId,
              from_date: startDate || null,
              to_date: dueDate,
              instruction: instruction || `${reportType === "accomplishment" ? "Accomplishment Report" : reportType === "laempl" ? "LAEMPL Report" : reportType === "mps" ? "MPS Report" : "Report"} assignment`,
              is_given: 1,
              is_archived: 0,
              allow_late: allowLate ? 1 : 0,
              number_of_submission: numberValue
            };
            
            const fallbackTitle = title || (reportType === "accomplishment" ? "Accomplishment Report" : 
                                           reportType === "laempl" ? "LAEMPL Report" : 
                                           reportType === "mps" ? "MPS Report" : "Report");
            
            let endpoint = "";
            let body = {};
            
            if (reportType === "accomplishment") {
              endpoint = `${API_BASE}/reports/accomplishment/give`;
              body = {
                ...base,
                assignees: teacherRecipients,
                title: fallbackTitle,
                parent_report_assignment_id: editingReportId
              };
            } else if (reportType === "laempl") {
              endpoint = `${API_BASE}/reports/laempl`;
              body = {
                ...base,
                assignees: teacherRecipients,
                title: fallbackTitle,
                parent_report_assignment_id: editingReportId,
                grade: 1
              };
            } else {
              endpoint = `${API_BASE}/reports/give`;
              body = {
                ...base,
                assignees: teacherRecipients,
                title: fallbackTitle,
                parent_report_assignment_id: editingReportId,
                field_definitions: []
              };
            }
            
            const createRes = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(body)
            });
            
            if (!createRes.ok) {
              const errText = await createRes.text();
              toast.error("Failed to create teacher assignment: " + errText);
              setSubmitting(false);
              return;
            }
            
            console.log('🔄 [DEBUG] Created new teacher assignment');
          }
        } else {
          // No teachers, update child assignment to have empty assignees (removes all submissions)
          if (teacherAssignmentId) {
            const teacherUpdateData = {
              title: title || (reportType === "accomplishment" ? "Accomplishment Report" : 
                              reportType === "laempl" ? "LAEMPL Report" : 
                              reportType === "mps" ? "MPS Report" : "Report"),
              quarter: quarterId,
              year: yearId,
              from_date: startDate || null,
              to_date: dueDate,
              instruction,
              is_given: 1,
              allow_late: allowLate ? 1 : 0,
              number_of_submission: numberValue,
              assignees: [] // Empty array removes all submissions
            };
            
            try {
              const teacherRes = await fetch(`${API_BASE}/reports/assignment/${teacherAssignmentId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(teacherUpdateData)
              });
              
              if (teacherRes.ok) {
                console.log('🔄 [DEBUG] Updated child assignment to have no assignees (no teachers)');
              } else {
                console.warn('Failed to update child assignment:', await teacherRes.text());
              }
            } catch (err) {
              console.warn('Failed to update child assignment:', err);
            }
          }
        }
        
        toast.success(`Report schedule updated successfully!`);
        setIsFormSubmitted(true);
        const redirectUrl = `/AssignedReport?year=${yearId}&quarter=${quarterId}`;
        navigate(redirectUrl);
        setSubmitting(false);
        return;
      }

      // For non-coordinator-own assignments, use normal update flow
      // BUT: If this is a parent assignment from principal (has coordinator_user_id), 
      // we need to find and update the CHILD assignment instead
      let assignmentIdToUpdate = editingReportId;
      
      // Check if this is a parent assignment (has coordinator_user_id but no parent_report_assignment_id)
      // If so, find the child assignment and update that instead
      if (isFromPrincipalAssignment && originalReportData?.coordinator_user_id != null && 
          originalReportData?.parent_report_assignment_id == null && isCoordinator) {
        console.log('🔄 [DEBUG] This is a parent assignment from principal, looking for child assignment...');
        try {
          const findChildRes = await fetch(`${API_BASE}/reports/assignment/${editingReportId}/child`, {
            credentials: "include"
          });
          if (findChildRes.ok) {
            const childData = await findChildRes.json();
            if (childData?.report_assignment_id) {
              assignmentIdToUpdate = childData.report_assignment_id;
              console.log('🔄 [DEBUG] Found child assignment, will update child instead of parent:', assignmentIdToUpdate);
            } else {
              console.log('🔄 [DEBUG] No child assignment found, will update parent:', assignmentIdToUpdate);
            }
          }
        } catch (err) {
          console.warn('🔄 [DEBUG] Failed to find child assignment, will update parent:', err);
        }
      }
      
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
      
      // For Accomplishment Report: Set coordinator_user_id if principal assigns to exactly 1 coordinator
      // AND that coordinator is actually the coordinator for Accomplishment Reports
      if (isPrincipal && reportType === "accomplishment" && recipients.length === 1) {
        const singleRecipientId = recipients[0];
        // Check if the single recipient is a coordinator
        const recipientUser = usersWithGrades.find(u => String(u.user_id) === String(singleRecipientId)) ||
          coordinators.find(u => String(u.user_id) === String(singleRecipientId));
        if (recipientUser?.role?.toLowerCase() === 'coordinator') {
          try {
            const checkRes = await fetch(`${API_BASE}/reports/given_to/${singleRecipientId}`, {
              credentials: "include"
            });
            if (checkRes.ok) {
              const assignments = await checkRes.json();
              // Check if this coordinator is the assigned coordinator for Accomplishment Reports (category_id = 0)
              const isAccomplishmentCoordinator = assignments.some(assignment => 
                Number(assignment.category_id) === 0 &&
                assignment.coordinator_user_id != null &&
                Number(assignment.coordinator_user_id) === Number(singleRecipientId)
              );
              
              if (isAccomplishmentCoordinator) {
                updateData.coordinator_user_id = Number(singleRecipientId);
                console.log("🔍 [SetReport] Update Accomplishment coordinator check:", {
                  singleRecipientId,
                  shouldSet: true,
                  reason: "Coordinator is assigned coordinator for Accomplishment Reports"
                });
              } else {
                console.log("🔍 [SetReport] Update Accomplishment coordinator check:", {
                  singleRecipientId,
                  shouldSet: false,
                  reason: "Coordinator is NOT the assigned coordinator for Accomplishment Reports - will act as teacher"
                });
              }
            } else {
              // If we can't check, default to NOT setting it (safer - let them act as teacher)
              console.log("🔍 [SetReport] Update Accomplishment coordinator check:", {
                singleRecipientId,
                shouldSet: false,
                reason: "Failed to fetch coordinator assignments - defaulting to teacher role"
              });
            }
          } catch (err) {
            console.warn("🔍 [SetReport] Failed to check coordinator assignments:", err);
            // Default to NOT setting it if check fails (safer - let them act as teacher)
          }
        }
      }
      
      // For LAEMPL: Set coordinator_user_id if principal assigns to a coordinator
      // AND that coordinator is actually the coordinator for LAEMPL & MPS
      if (isPrincipal && selectedSubCategory === "3" && selectedCoordinatorId) {
        // Check if this coordinator is the assigned coordinator for LAEMPL & MPS
        try {
          const checkRes = await fetch(`${API_BASE}/reports/given_to/${selectedCoordinatorId}`, {
            credentials: "include"
          });
          if (checkRes.ok) {
            const assignments = await checkRes.json();
            // Check if this coordinator is the assigned coordinator for LAEMPL & MPS
            const isLaemplMpsCoordinator = assignments.some(assignment => 
              Number(assignment.category_id) === 1 &&
              Number(assignment.sub_category_id) === 3 &&
              assignment.coordinator_user_id != null &&
              Number(assignment.coordinator_user_id) === Number(selectedCoordinatorId)
            );
            
            if (isLaemplMpsCoordinator) {
              updateData.coordinator_user_id = Number(selectedCoordinatorId);
              console.log("✅ [SetReport] Update - Setting coordinator_user_id for LAEMPL & MPS:", {
                coordinator_user_id: updateData.coordinator_user_id,
                reason: "Coordinator is assigned coordinator for LAEMPL & MPS"
              });
            } else {
              console.log("🔍 [SetReport] Update - NOT setting coordinator_user_id for LAEMPL & MPS:", {
                coordinatorId: selectedCoordinatorId,
                reason: "Coordinator is NOT the assigned coordinator for LAEMPL & MPS - will act as teacher"
              });
            }
          } else {
            console.log("🔍 [SetReport] Update - NOT setting coordinator_user_id for LAEMPL & MPS:", {
              coordinatorId: selectedCoordinatorId,
              reason: "Failed to fetch coordinator assignments - defaulting to teacher role"
            });
          }
        } catch (err) {
          console.warn("🔍 [SetReport] Update - Failed to check coordinator assignments for LAEMPL & MPS:", err);
          // Default to NOT setting it if check fails (safer - let them act as teacher)
        }
      }

      const res = await fetch(`${API_BASE}/reports/assignment/${assignmentIdToUpdate}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updateData)
      });
      
      console.log('🔄 [DEBUG] Updating assignment:', {
        originalEditingReportId: editingReportId,
        assignmentIdToUpdate,
        isParent: originalReportData?.coordinator_user_id != null && originalReportData?.parent_report_assignment_id == null,
        isChild: assignmentIdToUpdate !== editingReportId
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
            assignees: recipients.map((x) => Number(x)) // Use updated recipients that may include coordinator
          })
        });

        if (updateResponse.ok) {
          console.log("Updated existing reports from status 0 to 1");
        }
      } catch (error) {
        console.error("Failed to update existing reports:", error);
      }

      toast.success(`Report schedule updated successfully!`);
      setIsFormSubmitted(true);
      
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
      // Determine recipients early to check if coordinator is assigning to teachers
      // Filter out empty strings and invalid values
      const recipients = selectedTeachers.length > 0 
        ? selectedTeachers.filter(id => id && String(id).trim() !== '')
        : (selectedTeacher && String(selectedTeacher).trim() !== '' ? [selectedTeacher] : []);
      
      const coordinatorAwareRecipients = [...recipients];
      if (isPrincipal && selectedSubCategory === "3" && selectedCoordinatorId) {
        coordinatorAwareRecipients.push(String(selectedCoordinatorId));
      }
      
      // If coordinator is creating their own assignment (not from principal), add coordinator to assignees
      // for LAEMPL and Accomplishment Report
      const isCoordinatorOwnAssignment = isCoordinator && !isFromPrincipalAssignment && !isPrincipalReportParam;
      const reportType = detectReportType(subCategories, selectedSubCategory, selectedCategory);
      if (isCoordinatorOwnAssignment && (reportType === "accomplishment" || reportType === "laempl") && user?.user_id) {
        const coordinatorUserId = String(user.user_id);
        // Add coordinator to recipients if not already included
        if (!recipients.includes(coordinatorUserId) && !coordinatorAwareRecipients.includes(coordinatorUserId)) {
          coordinatorAwareRecipients.push(coordinatorUserId);
        }
      }

      // Check if any recipients are coordinators
      const hasCoordinatorRecipients = coordinatorAwareRecipients.some(userId => {
        const user = usersWithGrades.find(u => String(u.user_id) === String(userId)) ||
          coordinators.find(u => String(u.user_id) === String(userId));
        return user?.role?.toLowerCase() === 'coordinator';
      });
      
      // For Accomplishment Report: Check if coordinator recipient should get coordinator_user_id
      // Only set coordinator_user_id if the coordinator is actually the coordinator for Accomplishment Reports
      let shouldSetAccomplishmentCoordinatorId = false;
      if (isPrincipal && reportType === "accomplishment") {
        // Check if any recipient is a coordinator
        const coordinatorRecipients = recipients.filter(recipientId => {
          const recipientUser = usersWithGrades.find(u => String(u.user_id) === String(recipientId)) ||
            coordinators.find(u => String(u.user_id) === String(recipientId));
          return recipientUser?.role?.toLowerCase() === 'coordinator';
        });
        
        // If there's exactly one coordinator recipient, check if they're the coordinator for Accomplishment Reports
        if (coordinatorRecipients.length === 1) {
          const coordinatorId = coordinatorRecipients[0];
          try {
            console.log("🔍 [SetReport] Checking coordinator assignments for:", coordinatorId);
            
            // Check if this coordinator is the assigned coordinator for Accomplishment Reports
            // The issue: /reports/given_to/ returns assignments where coordinator is a RECIPIENT,
            // not where they are coordinator_user_id. 
            
            // Strategy: If a principal is assigning an Accomplishment Report to a coordinator,
            // and that coordinator has the coordinator role, we should set them as coordinator_user_id.
            // This is the correct behavior - when a principal assigns to a coordinator, they become the coordinator_user_id.
            
            let isAccomplishmentCoordinator = false;
            const recipientUser = usersWithGrades.find(u => String(u.user_id) === String(coordinatorId)) ||
              coordinators.find(u => String(u.user_id) === String(coordinatorId));
            
            if (recipientUser?.role?.toLowerCase() === 'coordinator') {
              // Check if this coordinator is the actual coordinator for Accomplishment Reports
              // by checking their past Accomplishment Report assignments
              // The issue: /reports/given_to/ returns assignments where coordinator is a RECIPIENT,
              // not where they are coordinator_user_id. We need to check assignments where coordinator_user_id matches.
              
              try {
                // First, try to get assignments where they are recipients (might include coordinator_user_id info)
                const checkRes = await fetch(`${API_BASE}/reports/given_to/${coordinatorId}`, {
                  credentials: "include"
                });
                
                let allAssignments = [];
                if (checkRes.ok) {
                  const recipientAssignments = await checkRes.json();
                  console.log("🔍 [SetReport] Assignments where coordinator is recipient:", recipientAssignments);
                  allAssignments = recipientAssignments;
                }
                
                // The API responses might not include coordinator_user_id field
                // Also, /reports/given_to/ only returns assignments where coordinator is a RECIPIENT,
                // not where they are coordinator_user_id. We need to check assignments assigned by the principal.
                
                // First, check assignments assigned by the principal (these should include coordinator_user_id)
                let foundCoordinatorAssignment = false;
                
                if (user?.user_id) {
                  try {
                    const assignedByRes = await fetch(`${API_BASE}/reports/assigned_by/${user.user_id}`, {
                      credentials: "include"
                    });
                    if (assignedByRes.ok) {
                      const assignedByPrincipal = await assignedByRes.json();
                      console.log("🔍 [SetReport] Assignments assigned by principal:", assignedByPrincipal);
                      
                      // Get Accomplishment Report assignments and fetch their details to check coordinator_user_id
                      const accomplishmentAssignmentsFromPrincipal = assignedByPrincipal.filter(assignment => 
                        Number(assignment.category_id) === 0
                      );
                      
                      console.log("🔍 [SetReport] Accomplishment Reports assigned by principal:", accomplishmentAssignmentsFromPrincipal);
                      
                      if (accomplishmentAssignmentsFromPrincipal.length > 0) {
                        // Fetch assignment details for each to get coordinator_user_id
                        const assignmentChecks = await Promise.all(
                          accomplishmentAssignmentsFromPrincipal.map(async (assignment) => {
                            const assignmentId = assignment.report_assignment_id || assignment.id;
                            if (!assignmentId) return null;
                            
                            try {
                              const assignmentDetailRes = await fetch(`${API_BASE}/reports/assignment/${assignmentId}`, {
                                credentials: "include"
                              });
                              if (assignmentDetailRes.ok) {
                                const assignmentDetail = await assignmentDetailRes.json();
                                return {
                                  ...assignment,
                                  coordinator_user_id: assignmentDetail.coordinator_user_id,
                                  assignmentDetail: assignmentDetail
                                };
                              }
                            } catch (err) {
                              console.warn(`🔍 [SetReport] Failed to fetch assignment ${assignmentId} details:`, err);
                            }
                            return assignment;
                          })
                        );
                        
                        console.log("🔍 [SetReport] Accomplishment assignments with details (from assigned_by):", assignmentChecks);
                        
                        // Check if any have coordinator_user_id matching
                        const assignmentsWhereCoordinator = assignmentChecks.filter(assignment => {
                          if (!assignment) return false;
                          const assignmentCoordinatorId = assignment.coordinator_user_id != null 
                            ? Number(assignment.coordinator_user_id) 
                            : null;
                          const matches = assignmentCoordinatorId === Number(coordinatorId);
                          
                          console.log("🔍 [SetReport] Checking assignment (from assigned_by):", {
                            assignment_id: assignment.report_assignment_id || assignment.id,
                            coordinator_user_id: assignment.coordinator_user_id,
                            assignmentCoordinatorId,
                            coordinatorId: Number(coordinatorId),
                            matches
                          });
                          
                          return matches;
                        });
                        
                        console.log("🔍 [SetReport] Accomplishment assignments where coordinator_user_id matches (from assigned_by):", assignmentsWhereCoordinator);
                        
                        if (assignmentsWhereCoordinator.length > 0) {
                          foundCoordinatorAssignment = true;
                          isAccomplishmentCoordinator = true;
                          console.log("✅ [SetReport] Coordinator is the actual Accomplishment Report coordinator (from assigned_by):", {
                            matchingAssignments: assignmentsWhereCoordinator.length
                          });
                        }
                      }
                    }
                  } catch (assignedByErr) {
                    console.warn("🔍 [SetReport] Error fetching assignments assigned by principal:", assignedByErr);
                  }
                }
                
                // If not found in assigned_by, check assignments where coordinator is recipient
                if (!foundCoordinatorAssignment) {
                  const accomplishmentAssignments = allAssignments.filter(assignment => 
                    Number(assignment.category_id) === 0
                  );
                  
                  console.log("🔍 [SetReport] Accomplishment Report assignments (from given_to):", accomplishmentAssignments);
                  
                  if (accomplishmentAssignments.length > 0) {
                    // Fetch assignment details for each Accomplishment Report to get coordinator_user_id
                    const assignmentChecks = await Promise.all(
                      accomplishmentAssignments.map(async (assignment) => {
                        const assignmentId = assignment.report_assignment_id || assignment.id;
                        if (!assignmentId) return null;
                        
                        try {
                          const assignmentDetailRes = await fetch(`${API_BASE}/reports/assignment/${assignmentId}`, {
                            credentials: "include"
                          });
                          if (assignmentDetailRes.ok) {
                            const assignmentDetail = await assignmentDetailRes.json();
                            return {
                              ...assignment,
                              coordinator_user_id: assignmentDetail.coordinator_user_id,
                              assignmentDetail: assignmentDetail
                            };
                          }
                        } catch (err) {
                          console.warn(`🔍 [SetReport] Failed to fetch assignment ${assignmentId} details:`, err);
                        }
                        return assignment;
                      })
                    );
                    
                    console.log("🔍 [SetReport] Accomplishment assignments with details (from given_to):", assignmentChecks);
                    
                    // Check if any have coordinator_user_id matching
                    const assignmentsWhereCoordinator = assignmentChecks.filter(assignment => {
                      if (!assignment) return false;
                      const assignmentCoordinatorId = assignment.coordinator_user_id != null 
                        ? Number(assignment.coordinator_user_id) 
                        : null;
                      const matches = assignmentCoordinatorId === Number(coordinatorId);
                      
                      console.log("🔍 [SetReport] Checking assignment (from given_to):", {
                        assignment_id: assignment.report_assignment_id || assignment.id,
                        coordinator_user_id: assignment.coordinator_user_id,
                        assignmentCoordinatorId,
                        coordinatorId: Number(coordinatorId),
                        matches
                      });
                      
                      return matches;
                    });
                    
                    console.log("🔍 [SetReport] Accomplishment assignments where coordinator_user_id matches (from given_to):", assignmentsWhereCoordinator);
                    
                    if (assignmentsWhereCoordinator.length > 0) {
                      isAccomplishmentCoordinator = true;
                      console.log("✅ [SetReport] Coordinator is the actual Accomplishment Report coordinator (from given_to):", {
                        matchingAssignments: assignmentsWhereCoordinator.length,
                        totalAccomplishmentAssignments: accomplishmentAssignments.length
                      });
                    } else {
                      // They have Accomplishment Report assignments, but coordinator_user_id is NULL or different
                      isAccomplishmentCoordinator = false;
                      console.log("❌ [SetReport] Coordinator has Accomplishment Report assignments but coordinator_user_id doesn't match - will act as teacher:", {
                        totalAccomplishmentAssignments: accomplishmentAssignments.length,
                        assignmentsWhereCoordinator: assignmentsWhereCoordinator.length
                      });
                    }
                  } else {
                    // No Accomplishment Report assignments found - act as teacher
                    isAccomplishmentCoordinator = false;
                    console.log("❌ [SetReport] No Accomplishment Report assignments found - will act as teacher");
                  }
                }
              } catch (fetchErr) {
                // If fetch fails, don't set them as coordinator_user_id (safer)
                isAccomplishmentCoordinator = false;
                console.warn("❌ [SetReport] Error checking assignments - NOT setting as coordinator_user_id:", fetchErr);
              }
            } else {
              console.log("🔍 [SetReport] User is not a coordinator role");
            }
              
            if (isAccomplishmentCoordinator) {
              shouldSetAccomplishmentCoordinatorId = true;
              console.log("✅ [SetReport] Accomplishment coordinator check:", {
                coordinatorRecipient: coordinatorId,
                shouldSetAccomplishmentCoordinatorId: true,
                reason: "Coordinator is assigned coordinator for Accomplishment Reports"
              });
            } else {
              console.log("❌ [SetReport] Accomplishment coordinator check:", {
                coordinatorRecipient: coordinatorId,
                shouldSetAccomplishmentCoordinatorId: false,
                reason: "Coordinator is NOT the assigned coordinator for Accomplishment Reports - will act as teacher"
              });
            }
          } catch (err) {
            console.error("❌ [SetReport] Failed to check coordinator assignments:", err);
            // Default to NOT setting it if check fails (safer - let them act as teacher)
          }
        } else if (coordinatorRecipients.length > 1) {
          // Multiple coordinators - don't set coordinator_user_id (ambiguous)
          console.log("🔍 [SetReport] Accomplishment coordinator check:", {
            coordinatorRecipients: coordinatorRecipients,
            shouldSetAccomplishmentCoordinatorId: false,
            reason: "Multiple coordinator recipients - ambiguous"
          });
        }
      }

      // Handle editing existing report - UPDATE instead of CREATE
      // If editingReportId exists, we should UPDATE the existing assignment
      // EXCEPT when:
      // 1. forceCreateAssignments is true (explicitly forcing creation)
      // 2. Coordinator is distributing from principal's assignment (isFromPrincipalWithCoordinator)
      //    - This is "Set as report to teachers" action - should CREATE NEW child assignments
      //    - NOT update the parent assignment
      // 
      // Note: "EDIT" = Update existing assignment (dates, instructions, etc.)
      //       "Set as report to teachers" = Create new child assignments from principal's assignment
      const fromAssignedReport = location.state?.fromAssignedReport || location.state?.prefillData || forceCreateAssignments;
      
      // Check if this is a coordinator's own assignment (not from principal)
      // For coordinator's own assignments, we should always update (handled in updateExistingReport)
      // Note: isCoordinatorOwnAssignment is already declared earlier in this function (line 1554)
      
      // Check if coordinator is distributing from principal's assignment (before we check shouldUpdate)
      // This determines if we're doing "Set as report to teachers" (CREATE) vs "EDIT" (UPDATE)
      const isFromPrincipalWithCoordinator = isFromPrincipalAssignment && isCoordinator && 
        (originalReportData?.coordinator_user_id != null || originalReportData?.parent_report_assignment_id != null);
      
      // If editingReportId exists, update (unless explicitly forcing creation OR distributing from principal)
      // When coordinator distributes from principal, we CREATE NEW child assignments, not update parent
      // EXCEPT if isEditAction is true - then we should UPDATE even if it's from principal
      // "Edit" button = UPDATE the existing assignment
      // "Set as report to teachers" button = CREATE NEW child assignments
      const shouldUpdate = editingReportId && !forceCreateAssignments && (isEditAction || !isFromPrincipalWithCoordinator);
      
      console.log('🔄 [DEBUG] Update vs Create decision:', {
        editingReportId,
        forceCreateAssignments,
        isPrincipal,
        fromAssignedReport,
        isEditingPrincipalReport,
        isCoordinator,
        isCoordinatorOwnAssignment,
        hasCoordinatorRecipients,
        isFromPrincipalWithCoordinator,
        isEditAction,
        action: shouldUpdate ? 'EDIT (UPDATE)' : isFromPrincipalWithCoordinator ? 'Set as report to teachers (CREATE)' : 'CREATE',
        shouldUpdate
      });
      
      if (shouldUpdate) {
        console.log('🔄 [DEBUG] Calling updateExistingReport()');
        await updateExistingReport();
        return;
      }
      
      console.log('🔄 [DEBUG] Will create new assignment instead of updating');
      
      // If coordinator is distributing from principal, we'll create new assignments in handleConfirmSubmit
      // with parent_report_assignment_id set to editingReportId

      // reportType already calculated above

      // FIX: map attempts to INT or NULL (NULL = unlimited)
      const numberValue =
        attempts === "" || attempts === "unlimited" ? null : Number(attempts);

      // For coordinator's own assignment:
      // - Coordinator's assignment: assignees = [coordinator_id] (no parent)
      // - Teacher assignments: assignees = [teacher_id] each, with parent_report_assignment_id = coordinator's assignment
      // For other cases: use recipients as is
      const coordinatorUserId = user?.user_id ? Number(user.user_id) : null;
      const coordinatorUserIdString = coordinatorUserId ? String(coordinatorUserId) : null;
      const teacherRecipients = recipients.filter(id => {
        return String(id) !== coordinatorUserIdString;
      });
      
      // Determine final recipients based on scenario
      let finalRecipients;
      if (isCoordinatorOwnAssignment && (reportType === "accomplishment" || reportType === "laempl") && coordinatorUserId) {
        // For coordinator's own assignment, first create coordinator's assignment (coordinator only)
        finalRecipients = [coordinatorUserId];
      } else {
        // For other cases, use the original recipients
        finalRecipients = recipients;
      }

      const givenBy =
        workflowType === "coordinated" ? Number(selectedCoordinator) : user.user_id;

      // Get the year_id from the selected school year
      const selectedYearData = availableSchoolYears.find(year => year.school_year === selectedSchoolYear);
      const yearId = selectedYearData ? selectedYearData.year_id : (activeYearQuarter.year || 1);
      const quarterId = selectedQuarter ? Number(selectedQuarter) : (activeYearQuarter.quarter || 1);

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

      // Special handling for reports from principal (with coordinator_user_id or parent_report_assignment_id)
      // When coordinator distributes to teachers/coordinators, create separate assignments for each recipient
      // with parent_report_assignment_id set, regardless of category
      // Note: This is already declared above in the shouldUpdate check, so we don't redeclare it here
      
      console.log('🔄 [DEBUG] Checking if should create child assignments (handleConfirmSubmit):', {
        isFromPrincipalAssignment,
        isCoordinator,
        hasCoordinatorUserId: originalReportData?.coordinator_user_id != null,
        hasParentAssignment: originalReportData?.parent_report_assignment_id != null,
        isFromPrincipalWithCoordinator,
        editingReportId,
        hasCoordinatorRecipients
      });
      
      // For coordinator's own assignment: parentAssignmentId should be null (it's the parent itself)
      // For coordinator assigning to teachers from their own assignment: parentAssignmentId should be the coordinator's assignment
      // If coordinator is creating their own assignment (not from principal), don't set parent_report_assignment_id
      // If coordinator is assigning to teachers from their own assignment, set parent_report_assignment_id to the coordinator's assignment
      let parentAssignmentId = parentAssignmentIdFromState ?? (editingReportId ? Number(editingReportId) : null);
      
      // If coordinator is creating their own assignment (not from principal), parentAssignmentId should be null
      if (isCoordinatorOwnAssignment && !editingReportId) {
        parentAssignmentId = null; // Coordinator's own assignment is the parent, so no parent for itself
      }
      
      // If coordinator is distributing from a principal's assignment, ensure parentAssignmentId is set
      // This applies regardless of whether recipients are teachers or coordinators (acting as teachers)
      if (isFromPrincipalWithCoordinator && editingReportId) {
        parentAssignmentId = Number(editingReportId); // Link to principal's assignment (the parent)
        console.log('🔄 [DEBUG] Coordinator distributing report from principal to recipients (handleConfirmSubmit)', {
          originalCategory: originalReportData?.category_id,
          newCategory: selectedCategory,
          reportType,
          editingReportId,
          parentAssignmentId,
          recipientsCount: recipients.length,
          recipients,
          hasCoordinatorRecipients
        });
      }
      
      // isCoordinatorAssigning: true when coordinator is assigning to teachers (not creating their own assignment)
      // This happens when:
      // 1. Coordinator is assigning to teachers (not coordinators)
      // 2. Either from a principal's assignment (parentAssignmentId exists) OR from coordinator's own assignment (editingReportId exists)
      // OR when coordinator is distributing from a principal's assignment (isFromPrincipalWithCoordinator)
      const isCoordinatorAssigning = Boolean(
        isCoordinator &&
        !isPrincipal &&
        !hasCoordinatorRecipients &&
        (parentAssignmentId || (isCoordinatorOwnAssignment && editingReportId) || isFromPrincipalWithCoordinator)
      );

      // Only include coordinator_user_id when principal assigns to coordinator
      // Do NOT include it when coordinator assigns to teachers (including coordinators acting as teachers)
      // to avoid conflicts with the parent assignment's coordinator_user_id
      const base = {
        category_id: Number(selectedCategory),
        sub_category_id: reportType === "accomplishment" ? null : Number(selectedSubCategory),
        given_by: Number(givenBy),
        assignees: finalRecipients.map((x) => Number(x)),
        quarter: quarterId,
        year: yearId,
        from_date: startDate || null,
        to_date: dueDate,
        instruction,
        is_given: isGiven,
        is_archived: 0,
        allow_late: allowLate ? 1 : 0,
      // Only set parent_report_assignment_id when coordinator is assigning to teachers (not when creating their own)
      // For principal assigning to coordinator: parent_report_assignment_id should be null (it's the parent assignment)
      // For coordinator assigning to teachers: parent_report_assignment_id should be set to the parent assignment ID
      parent_report_assignment_id: (isCoordinatorAssigning && !isPrincipal) ? parentAssignmentId ?? null : null,
      };
      
      // Only add coordinator_user_id if principal is assigning to ONLY a coordinator (not teachers + coordinator)
      // AND that coordinator is actually the coordinator for LAEMPL & MPS (category_id = 1, sub_category_id = 3)
      // Never add it when coordinator is assigning to avoid conflicts
      // If principal assigns to Teacher(s) + Coordinator, coordinator should act as teacher (no coordinator_user_id)
      // CRITICAL: Never set coordinator_user_id when coordinator is assigning (even if somehow isPrincipal is true)
      if (isPrincipal && !isCoordinator && selectedSubCategory === "3" && selectedCoordinatorId) {
        // Check if there are any teachers in the recipients (if yes, coordinator acts as teacher)
        const hasTeacherRecipients = recipients.some(recipientId => {
          const recipientUser = usersWithGrades.find(u => String(u.user_id) === String(recipientId)) ||
            coordinators.find(u => String(u.user_id) === String(recipientId));
          return recipientUser?.role?.toLowerCase() === 'teacher';
        });
        
        // Only set coordinator_user_id if there are NO teachers (coordinator only)
        if (!hasTeacherRecipients) {
          // Check if this coordinator is the assigned coordinator for LAEMPL & MPS
          try {
            const checkRes = await fetch(`${API_BASE}/reports/given_to/${selectedCoordinatorId}`, {
              credentials: "include"
            });
            if (checkRes.ok) {
              const assignments = await res.json();
              // Check if this coordinator is the assigned coordinator for LAEMPL & MPS
              const isLaemplMpsCoordinator = assignments.some(assignment => 
                Number(assignment.category_id) === 1 &&
                Number(assignment.sub_category_id) === 3 &&
                assignment.coordinator_user_id != null &&
                Number(assignment.coordinator_user_id) === Number(selectedCoordinatorId)
              );
              
              if (isLaemplMpsCoordinator) {
                base.coordinator_user_id = Number(selectedCoordinatorId);
                console.log("✅ [SetReport] Setting coordinator_user_id for LAEMPL & MPS:", {
                  coordinator_user_id: base.coordinator_user_id,
                  reason: "Coordinator is assigned coordinator for LAEMPL & MPS (coordinator only, no teachers)"
                });
              } else {
                console.log("🔍 [SetReport] NOT setting coordinator_user_id for LAEMPL & MPS:", {
                  coordinatorId: selectedCoordinatorId,
                  reason: "Coordinator is NOT the assigned coordinator for LAEMPL & MPS - will act as teacher"
                });
              }
            } else {
              console.log("🔍 [SetReport] NOT setting coordinator_user_id for LAEMPL & MPS:", {
                coordinatorId: selectedCoordinatorId,
                reason: "Failed to fetch coordinator assignments - defaulting to teacher role"
              });
            }
          } catch (err) {
            console.warn("🔍 [SetReport] Failed to check coordinator assignments for LAEMPL & MPS:", err);
            // Default to NOT setting it if check fails (safer - let them act as teacher)
          }
        } else {
          console.log("🔍 [SetReport] NOT setting coordinator_user_id for LAEMPL & MPS:", {
            coordinatorId: selectedCoordinatorId,
            reason: "Principal assigned to Teacher(s) + Coordinator - coordinator will act as teacher"
          });
        }
      }
      
      // For Accomplishment Report: Set coordinator_user_id if principal assigns to exactly 1 coordinator
      console.log("🔍 [SetReport] Before setting coordinator_user_id for Accomplishment Report:", {
        isPrincipal,
        reportType,
        shouldSetAccomplishmentCoordinatorId,
        finalRecipients
      });
      
      // CRITICAL: Never set coordinator_user_id when coordinator is assigning (even if somehow isPrincipal is true)
      if (isPrincipal && !isCoordinator && reportType === "accomplishment" && shouldSetAccomplishmentCoordinatorId) {
        // Check if there are any teachers in the recipients (if yes, coordinator acts as teacher)
        const hasTeacherRecipients = finalRecipients.some(recipientId => {
          const recipientUser = usersWithGrades.find(u => String(u.user_id) === String(recipientId)) ||
            coordinators.find(u => String(u.user_id) === String(recipientId));
          return recipientUser?.role?.toLowerCase() === 'teacher';
        });
        
        // Only set coordinator_user_id if there are NO teachers (coordinator only)
        if (!hasTeacherRecipients) {
          // Find the coordinator recipient
          const coordinatorRecipient = finalRecipients.find(recipientId => {
            const recipientUser = usersWithGrades.find(u => String(u.user_id) === String(recipientId)) ||
              coordinators.find(u => String(u.user_id) === String(recipientId));
            return recipientUser?.role?.toLowerCase() === 'coordinator';
          });
          
          if (coordinatorRecipient) {
            base.coordinator_user_id = Number(coordinatorRecipient);
            console.log("✅ [SetReport] Setting coordinator_user_id for Accomplishment Report:", {
              coordinator_user_id: base.coordinator_user_id,
              coordinatorRecipient,
              baseObject: base,
              reason: "Coordinator only (no teachers) - coordinator acts as coordinator"
            });
          } else {
            console.log("❌ [SetReport] Coordinator recipient not found in finalRecipients:", {
              finalRecipients,
              coordinatorRecipient
            });
          }
        } else {
          console.log("❌ [SetReport] NOT setting coordinator_user_id for Accomplishment Report:", {
            reason: "Principal assigned to Teacher(s) + Coordinator - coordinator will act as teacher"
          });
        }
      } else {
        console.log("❌ [SetReport] NOT setting coordinator_user_id for Accomplishment Report:", {
          isPrincipal,
          reportType,
          shouldSetAccomplishmentCoordinatorId,
          reason: !isPrincipal ? "Not principal" : 
                  reportType !== "accomplishment" ? "Not accomplishment report" :
                  !shouldSetAccomplishmentCoordinatorId ? "shouldSetAccomplishmentCoordinatorId is false" : "Unknown"
        });
      }

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

      // Special handling: If coordinator is distributing from a principal's assignment,
      // create a SINGLE assignment with ALL recipients in assignees array
      // The API will automatically create one submission per recipient
      // This applies regardless of whether recipients are teachers or coordinators (acting as teachers)
      if (isFromPrincipalWithCoordinator && editingReportId) {
        console.log('🔄 [DEBUG] Creating single assignment with all recipients (handleConfirmSubmit)', {
          originalCategory: originalReportData?.category_id,
          newCategory: selectedCategory,
          reportType,
          editingReportId,
          parentAssignmentId,
          recipientsCount: recipients.length,
          recipients
        });
        
        // Create a single assignment with all recipients
        const isLAEMPLMPS = reportType === "laempl" && selectedSubCategory === "3" && selectedGradeLevel && selectedSubjects.length > 0;
        
        let endpoint = "";
        let body = {};
        
        if (isLAEMPLMPS) {
          // LAEMPL & MPS with subjects: creates one assignment per subject, each with all recipients
          endpoint = `${API_BASE}/reports/laempl-mps`;
          const subjectIds = selectedSubjects.map(id => Number(id));
          body = {
            category_id: Number(selectedCategory),
            sub_category_id: Number(selectedSubCategory),
            given_by: Number(user?.user_id),
            assignees: recipients.map(id => Number(id)), // All recipients in one array
            quarter: quarterId,
            year: yearId,
            from_date: startDate || null,
            to_date: dueDate,
            instruction: instruction || "LAEMPL Report assignment",
            is_given: 1,
            is_archived: 0,
            allow_late: allowLate ? 1 : 0,
            title: title || "LAEMPL Report",
            parent_report_assignment_id: Number(editingReportId), // Link to principal's assignment
            number_of_submission: numberValue,
            grade_level_id: Number(selectedGradeLevel),
            subject_ids: subjectIds
          };
        } else {
          // For other report types: create single assignment with all recipients
          if (reportType === "accomplishment") {
            endpoint = `${API_BASE}/reports/accomplishment/give`;
          } else if (reportType === "laempl") {
            endpoint = `${API_BASE}/reports/laempl`;
          } else {
            endpoint = `${API_BASE}/reports/give`;
          }
          
          body = {
            category_id: Number(selectedCategory),
            sub_category_id: reportType === "accomplishment" ? null : Number(selectedSubCategory),
            given_by: Number(user?.user_id),
            assignees: recipients.map(id => Number(id)), // All recipients in one array
            quarter: quarterId,
            year: yearId,
            from_date: startDate || null,
            to_date: dueDate,
            instruction: instruction || `${reportType === "accomplishment" ? "Accomplishment Report" : reportType === "laempl" ? "LAEMPL Report" : reportType === "mps" ? "MPS Report" : "Report"} assignment`,
            is_given: 1,
            is_archived: 0,
            allow_late: allowLate ? 1 : 0,
            title: title || (reportType === "accomplishment" ? "Accomplishment Report" : 
                            reportType === "laempl" ? "LAEMPL Report" : 
                            reportType === "mps" ? "MPS Report" : "Report"),
            parent_report_assignment_id: Number(editingReportId), // Link to principal's assignment
            number_of_submission: numberValue
          };
          
          // Add category-specific fields
          if (reportType === "laempl") {
            body.grade = 1;
          } else if (reportType !== "accomplishment") {
            body.field_definitions = [];
          }
        }
        
        console.log('🔄 [DEBUG] Creating single assignment with parent link:', {
          endpoint,
          parent_report_assignment_id: body.parent_report_assignment_id,
          category_id: body.category_id,
          assigneesCount: body.assignees.length,
          assignees: body.assignees
        });
        
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body)
        });
        
        if (!response.ok) {
          const errText = await response.text();
          toast.error("Failed to create assignment: " + errText);
          setSubmitting(false);
          return;
        }
        
        const data = await response.json();
        toast.success(`Successfully created assignment with ${recipients.length} recipient(s)!`);
        setIsFormSubmitted(true);
        
        // Mark coordinator's assignment as given
        try {
          const markGivenResponse = await fetch(`${API_BASE}/reports/assignment/${editingReportId}/mark-given`, {
            method: "POST",
            credentials: "include"
          });
          if (markGivenResponse.ok) {
            console.log("Marked coordinator assignment as given");
          }
        } catch (error) {
          console.error("Failed to mark coordinator assignment as given:", error);
        }
        
        // Redirect to Assigned Reports
        const redirectUrl = `/AssignedReport?year=${yearId}&quarter=${quarterId}`;
        navigate(redirectUrl);
        setSubmitting(false);
        return;
      }
      
      if (reportType === "accomplishment") {
        // Handle Accomplishment Report
        // For coordinator's own assignment: first create coordinator's assignment, then create teacher assignments
        if (isCoordinatorOwnAssignment && coordinatorUserId) {
          // Step 1: Create coordinator's assignment (coordinator only, no parent)
          const coordinatorBody = {
            ...base,
            assignees: [coordinatorUserId], // Coordinator only
            title: fallbackTitle,
            parent_report_assignment_id: null, // Coordinator's assignment is the parent
          };
          
          const coordinatorRes = await fetch(`${API_BASE}/reports/accomplishment/give`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(coordinatorBody),
          });
          
          if (!coordinatorRes.ok) {
            const errText = await coordinatorRes.text();
            toast.error("Failed to create coordinator assignment: " + errText);
            setSubmitting(false);
            return;
          }
          
          const coordinatorData = await coordinatorRes.json();
          const coordinatorAssignmentId = coordinatorData.report_assignment_id;
          console.log('Created coordinator assignment:', coordinatorAssignmentId);
          
          // Step 2: Create a SINGLE teacher assignment with ALL teachers (linked to coordinator's assignment)
          if (teacherRecipients.length > 0) {
            const teacherBody = {
              ...base,
              assignees: teacherRecipients.map(id => Number(id)), // All teachers in one assignment
              title: fallbackTitle,
              parent_report_assignment_id: coordinatorAssignmentId, // Link to coordinator's assignment
            };
            
            const teacherRes = await fetch(`${API_BASE}/reports/accomplishment/give`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(teacherBody),
            });
            
            if (!teacherRes.ok) {
              const errText = await teacherRes.text();
              toast.error(`Created coordinator assignment, but failed to create teacher assignment: ${errText}`);
            } else {
              toast.success(`Successfully created coordinator assignment and teacher assignment with ${teacherRecipients.length} recipient(s)!`);
            }
          } else {
            // Only coordinator, no teachers
            toast.success('Successfully created coordinator assignment!');
          }
          setIsFormSubmitted(true);
          
          // Redirect after creating all assignments
          const redirectUrl = `/AssignedReport?year=${yearId}&quarter=${quarterId}`;
          navigate(redirectUrl);
          setSubmitting(false);
          return;
        }
        
        // Check if Principal is assigning to Teacher(s) or Coordinator + Teacher(s) (not just Coordinator only)
        // In this case, we need to create TWO assignments:
        // 1. Principal's assignment (with Principal as assignee)
        // 2. Recipient assignment (with Teacher(s) or Coordinator + Teacher(s) as assignees, linked to Principal's assignment)
        const isPrincipalAssigningToTeachersOrMixed = isPrincipal && !isCoordinator && user?.user_id && finalRecipients.length > 0;
        let hasTeacherRecipients = false;
        let hasOnlyCoordinator = false;
        
        if (isPrincipalAssigningToTeachersOrMixed) {
          // Check if there are any teachers in the recipients
          hasTeacherRecipients = finalRecipients.some(recipientId => {
            const recipientUser = usersWithGrades.find(u => String(u.user_id) === String(recipientId)) ||
              coordinators.find(u => String(u.user_id) === String(recipientId));
            return recipientUser?.role?.toLowerCase() === 'teacher';
          });
          
          // Check if there's only a coordinator (no teachers)
          const coordinatorRecipients = finalRecipients.filter(recipientId => {
            const recipientUser = usersWithGrades.find(u => String(u.user_id) === String(recipientId)) ||
              coordinators.find(u => String(u.user_id) === String(recipientId));
            return recipientUser?.role?.toLowerCase() === 'coordinator';
          });
          
          hasOnlyCoordinator = coordinatorRecipients.length === finalRecipients.length && coordinatorRecipients.length > 0;
        }
        
        // If Principal is assigning to Teacher(s) or Coordinator + Teacher(s), create two assignments
        if (isPrincipalAssigningToTeachersOrMixed && hasTeacherRecipients && !hasOnlyCoordinator) {
          console.log("✅ [SetReport] Principal assigning to Teacher(s) or Coordinator + Teacher(s) - creating two assignments");
          
          // Step 1: Create Principal's assignment (with Principal as assignee)
          const principalBody = {
            ...base,
            assignees: [Number(user.user_id)], // Principal as assignee
            title: fallbackTitle,
            parent_report_assignment_id: null, // Principal's assignment is the parent
            coordinator_user_id: null, // No coordinator_user_id for Principal's own assignment
          };
          
          const principalRes = await fetch(`${API_BASE}/reports/accomplishment/give`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(principalBody),
          });
          
          if (!principalRes.ok) {
            const errText = await principalRes.text();
            toast.error("Failed to create principal assignment: " + errText);
            setSubmitting(false);
            return;
          }
          
          const principalData = await principalRes.json();
          const principalAssignmentId = principalData.report_assignment_id;
          console.log('✅ [SetReport] Created principal assignment:', principalAssignmentId);
          
          // Step 2: Create recipient assignment (with Teacher(s) or Coordinator + Teacher(s) as assignees, linked to Principal's assignment)
          const { coordinator_user_id: baseCoordinatorUserId, ...baseWithoutCoordinatorId } = base;
          
          const recipientBody = {
            ...baseWithoutCoordinatorId,
            assignees: finalRecipients.map((x) => Number(x)), // All recipients (teachers and/or coordinators)
            title: fallbackTitle,
            parent_report_assignment_id: principalAssignmentId, // Link to Principal's assignment
            coordinator_user_id: null, // No coordinator_user_id when Principal assigns to Teacher(s) or Coordinator + Teacher(s)
          };
          
          const recipientRes = await fetch(`${API_BASE}/reports/accomplishment/give`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(recipientBody),
          });
          
          if (!recipientRes.ok) {
            const errText = await recipientRes.text();
            toast.error(`Created principal assignment, but failed to create recipient assignment: ${errText}`);
            setSubmitting(false);
            return;
          }
          
          toast.success(`Successfully created principal assignment and recipient assignment with ${finalRecipients.length} recipient(s)!`);
          setIsFormSubmitted(true);
          
          // Redirect after creating all assignments
          const redirectUrl = `/AssignedReport?year=${yearId}&quarter=${quarterId}`;
          navigate(redirectUrl);
          setSubmitting(false);
          return;
        }
        
        // Check if Accomplishment Coordinator is assigning to Teacher(s) or Teacher(s) + Coordinator (not their own assignment, not from principal)
        // In this case, we need to create TWO assignments:
        // 1. Coordinator's assignment (with Coordinator as assignee)
        // 2. Recipient assignment (with Teacher(s) or Teacher(s) + Coordinator as assignees, linked to Coordinator's assignment)
        const isCoordinatorAssigningToTeachersOrMixed = isCoordinator && !isPrincipal && !isCoordinatorOwnAssignment && !isFromPrincipalAssignment && 
          reportType === "accomplishment" && user?.user_id && finalRecipients.length > 0;
        let hasTeacherRecipientsCoordinator = false;
        let hasOnlyCoordinatorCoordinator = false;
        
        if (isCoordinatorAssigningToTeachersOrMixed) {
          // Check if there are any teachers in the recipients
          hasTeacherRecipientsCoordinator = finalRecipients.some(recipientId => {
            const recipientUser = usersWithGrades.find(u => String(u.user_id) === String(recipientId)) ||
              coordinators.find(u => String(u.user_id) === String(recipientId));
            return recipientUser?.role?.toLowerCase() === 'teacher';
          });
          
          // Check if there's only a coordinator (no teachers)
          const coordinatorRecipientsCoordinator = finalRecipients.filter(recipientId => {
            const recipientUser = usersWithGrades.find(u => String(u.user_id) === String(recipientId)) ||
              coordinators.find(u => String(u.user_id) === String(recipientId));
            return recipientUser?.role?.toLowerCase() === 'coordinator';
          });
          
          hasOnlyCoordinatorCoordinator = coordinatorRecipientsCoordinator.length === finalRecipients.length && coordinatorRecipientsCoordinator.length > 0;
        }
        
        // If Accomplishment Coordinator is assigning to Teacher(s) or Teacher(s) + Coordinator, create two assignments
        if (isCoordinatorAssigningToTeachersOrMixed && hasTeacherRecipientsCoordinator && !hasOnlyCoordinatorCoordinator) {
          console.log("✅ [SetReport] Accomplishment Coordinator assigning to Teacher(s) or Teacher(s) + Coordinator - creating two assignments");
          
          // Step 1: Create Coordinator's assignment (with Coordinator as assignee)
          const coordinatorBodyForAssigning = {
            ...base,
            assignees: [Number(user.user_id)], // Coordinator as assignee
            title: fallbackTitle,
            parent_report_assignment_id: null, // Coordinator's assignment is the parent
            coordinator_user_id: null, // No coordinator_user_id for Coordinator's own assignment
          };
          
          const coordinatorResForAssigning = await fetch(`${API_BASE}/reports/accomplishment/give`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(coordinatorBodyForAssigning),
          });
          
          if (!coordinatorResForAssigning.ok) {
            const errText = await coordinatorResForAssigning.text();
            toast.error("Failed to create coordinator assignment: " + errText);
            setSubmitting(false);
            return;
          }
          
          const coordinatorDataForAssigning = await coordinatorResForAssigning.json();
          const coordinatorAssignmentIdForAssigning = coordinatorDataForAssigning.report_assignment_id;
          console.log('✅ [SetReport] Created coordinator assignment for assigning to others:', coordinatorAssignmentIdForAssigning);
          
          // Step 2: Create recipient assignment (with Teacher(s) or Teacher(s) + Coordinator as assignees, linked to Coordinator's assignment)
          const { coordinator_user_id: baseCoordinatorUserId, ...baseWithoutCoordinatorId } = base;
          
          const recipientBodyCoordinator = {
            ...baseWithoutCoordinatorId,
            assignees: finalRecipients.map((x) => Number(x)), // All recipients (teachers and/or coordinators)
            title: fallbackTitle,
            parent_report_assignment_id: coordinatorAssignmentIdForAssigning, // Link to Coordinator's assignment
            coordinator_user_id: null, // No coordinator_user_id when Coordinator assigns to Teacher(s) or Teacher(s) + Coordinator
          };
          
          const recipientResCoordinator = await fetch(`${API_BASE}/reports/accomplishment/give`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(recipientBodyCoordinator),
          });
          
          if (!recipientResCoordinator.ok) {
            const errText = await recipientResCoordinator.text();
            toast.error(`Created coordinator assignment, but failed to create recipient assignment: ${errText}`);
            setSubmitting(false);
            return;
          }
          
          toast.success(`Successfully created coordinator assignment and recipient assignment with ${finalRecipients.length} recipient(s)!`);
          setIsFormSubmitted(true);
          
          // Redirect after creating all assignments
          const redirectUrl = `/AssignedReport?year=${yearId}&quarter=${quarterId}`;
          navigate(redirectUrl);
          setSubmitting(false);
          return;
        }
        
        // Normal flow: create single assignment with all assignees
        endpoint = `${API_BASE}/reports/accomplishment/give`;
        
        // When coordinator is assigning to teachers/coordinators, coordinators should act as teachers
        // Do NOT include coordinator_user_id - it should only be set when principal assigns to coordinator
        const { coordinator_user_id: baseCoordinatorUserId, ...baseWithoutCoordinatorId } = base;
        
        body = {
          ...baseWithoutCoordinatorId,
          title: fallbackTitle,
        };
        
        // Only include coordinator_user_id if principal is assigning (not when coordinator is assigning to others)
        // - Principal → Coordinator (only): coordinator_user_id is included (coordinator acts as coordinator)
        // - Principal → Teacher(s) + Coordinator: coordinator_user_id is NOT included (coordinator acts as teacher)
        // - Coordinator → Coordinator: coordinator_user_id is NOT included (recipient coordinator acts as teacher)
        // - Coordinator → Teacher(s) + Coordinator: coordinator_user_id is NOT included (recipient coordinator acts as teacher)
        // Explicitly ensure coordinator_user_id is NEVER included when coordinator is assigning
        if (isCoordinator) {
          // Coordinator is assigning - explicitly remove coordinator_user_id if it exists
          delete body.coordinator_user_id;
        } else if (isPrincipal && baseCoordinatorUserId) {
          // Only include if principal is assigning (and not a coordinator)
          body.coordinator_user_id = baseCoordinatorUserId;
          console.log("✅ [SetReport] Including coordinator_user_id in body:", {
            coordinator_user_id: body.coordinator_user_id,
            base_coordinator_user_id: baseCoordinatorUserId
          });
        }
        
        // For principal assigning to coordinator: ensure parent_report_assignment_id is null (it's the parent)
        if (isPrincipal && baseCoordinatorUserId) {
          body.parent_report_assignment_id = null;
          console.log("✅ [SetReport] Principal creating parent assignment for coordinator:", {
            coordinator_user_id: baseCoordinatorUserId,
            parent_report_assignment_id: null,
            is_given: base.is_given,
            body: body
          });
        }
        
        console.log("🔍 [SetReport] Final body for Accomplishment Report:", body);
      } else if (reportType === "laempl") {
        // Check if this is LAEMPL & MPS with subject selection
        const isLAEMPLMPS = selectedSubCategory === "3"; // LAEMPL & MPS sub-category ID
        if (isLAEMPLMPS && selectedGradeLevel && selectedSubjects.length > 0) {
          // For both coordinators and teachers: create separate submissions per subject
          // The laempl-mps endpoint automatically creates one assignment per subject
          const subjectIds = selectedSubjects.map((id) => Number(id));
          
          // When coordinator is assigning to teachers, use recipients directly instead of finalRecipients
          // finalRecipients might be set to [coordinator_id] for coordinator's own assignment, which is not what we want here
          // Check if coordinator has selected any recipients (teachers/coordinators) to assign to
          const hasSelectedRecipients = recipients.length > 0;
          const isCoordinatorAssigningToOthers = isCoordinator && hasSelectedRecipients;
          
          let assigneesList;
          if (isCoordinatorAssigningToOthers) {
            // Coordinator assigning to teachers/coordinators: use recipients (the selected teachers/coordinators)
            // This applies whether it's from principal assignment or coordinator's own assignment
            assigneesList = recipients.filter(id => id && String(id).trim() !== '').map(id => String(id));
          } else {
            // Use the finalRecipients list that was already calculated (includes coordinator if principal, or coordinator's own assignment)
            assigneesList = finalRecipients.filter(id => id != null && String(id).trim() !== '').map(id => String(id));
          }
          
          // If principal is assigning to coordinator, include coordinator in assignees (already handled in finalRecipients)
          // This check is now redundant but kept for clarity
          if (isPrincipal && selectedSubCategory === "3" && selectedCoordinatorId && !assigneesList.includes(String(selectedCoordinatorId))) {
            assigneesList.push(String(selectedCoordinatorId));
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
                    assigneesList = originalAssignees.map(id => String(id));
                  }
                }
              }
            } catch (err) {
              console.warn("[SetReport] Failed to fetch original assignees:", err);
            }
          }
          
          // IMPORTANT: Filter out the assigner (current user) from assignees only when it matches
          const currentUserId = user?.user_id ? Number(user.user_id) : null;
          if (currentUserId) {
            assigneesList = assigneesList.filter((assigneeId) => {
              const assigneeIdNum = Number(assigneeId);
              return !isNaN(assigneeIdNum) && assigneeIdNum !== currentUserId;
            });
          }
          
          // Filter out empty strings and invalid values before validation
          assigneesList = assigneesList.filter(id => id != null && String(id).trim() !== '' && !isNaN(Number(id)));
          
          // Validate assignees are not empty
          if (assigneesList.length === 0) {
            toast.error('Please select at least one teacher or coordinator to assign this report to.');
            setSubmitting(false);
            return;
          }
          
          // Ensure all assignees are valid numbers
          assigneesList = assigneesList.map(id => Number(id));
          
          if (assigneesList.length === 0) {
            toast.error('Invalid assignees selected. Please select valid teachers or coordinators.');
            setSubmitting(false);
            return;
          }
          
          // Check if Principal is assigning to Teacher(s) or Coordinator + Teacher(s) (not just Coordinator only)
          // In this case, we need to create TWO sets of assignments:
          // 1. Principal's assignments (one per subject, with Principal as assignee)
          // 2. Recipient assignments (one per subject, with Teacher(s) or Coordinator + Teacher(s) as assignees, linked to Principal's assignments)
          const isPrincipalAssigningToTeachersOrMixedLAEMPL = isPrincipal && !isCoordinator && user?.user_id && assigneesList.length > 0;
          let hasTeacherRecipientsLAEMPL = false;
          let hasOnlyCoordinatorLAEMPL = false;
          
          if (isPrincipalAssigningToTeachersOrMixedLAEMPL) {
            // Check if there are any teachers in the recipients
            hasTeacherRecipientsLAEMPL = assigneesList.some(recipientId => {
              const recipientUser = usersWithGrades.find(u => String(u.user_id) === String(recipientId)) ||
                coordinators.find(u => String(u.user_id) === String(recipientId));
              return recipientUser?.role?.toLowerCase() === 'teacher';
            });
            
            // Check if there's only a coordinator (no teachers)
            const coordinatorRecipientsLAEMPL = assigneesList.filter(recipientId => {
              const recipientUser = usersWithGrades.find(u => String(u.user_id) === String(recipientId)) ||
                coordinators.find(u => String(u.user_id) === String(recipientId));
              return recipientUser?.role?.toLowerCase() === 'coordinator';
            });
            
            hasOnlyCoordinatorLAEMPL = coordinatorRecipientsLAEMPL.length === assigneesList.length && coordinatorRecipientsLAEMPL.length > 0;
          }
          
          // If Principal is assigning to Teacher(s) or Coordinator + Teacher(s), create two sets of assignments
          if (isPrincipalAssigningToTeachersOrMixedLAEMPL && hasTeacherRecipientsLAEMPL && !hasOnlyCoordinatorLAEMPL) {
            console.log("✅ [SetReport] Principal assigning to Teacher(s) or Coordinator + Teacher(s) for LAEMPL & MPS - creating two sets of assignments");
            
            // Step 1: Create Principal's assignments (one per subject, with Principal as assignee)
            const principalBodyLAEMPL = {
              ...base,
              assignees: [Number(user.user_id)], // Principal as assignee
              title: fallbackTitle,
              parent_report_assignment_id: null, // Principal's assignments are the parents
              coordinator_user_id: null, // No coordinator_user_id for Principal's own assignments
              grade_level_id: Number(selectedGradeLevel),
              subject_ids: subjectIds, // This will create one assignment per subject
              number_of_submission: numberValue, // INT or NULL
            };
            
            const principalResLAEMPL = await fetch(`${API_BASE}/reports/laempl-mps`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(principalBodyLAEMPL),
            });
            
            if (!principalResLAEMPL.ok) {
              const errText = await principalResLAEMPL.text();
              toast.error("Failed to create principal assignments: " + errText);
              setSubmitting(false);
              return;
            }
            
            const principalDataLAEMPL = await principalResLAEMPL.json();
            const principalAssignmentsLAEMPL = principalDataLAEMPL.assignments || [];
            console.log('✅ [SetReport] Created principal assignments:', principalAssignmentsLAEMPL.map(a => a.report_assignment_id));
            
            // Step 2: Create recipient assignments (one per subject, with Teacher(s) or Coordinator + Teacher(s) as assignees, linked to Principal's assignments)
            // Note: The API creates one assignment per subject, so we need to link each recipient assignment to the corresponding principal assignment
            const { coordinator_user_id: baseCoordinatorUserIdLAEMPL, ...baseWithoutCoordinatorId } = base;
            
            const recipientBodyLAEMPL = {
              ...baseWithoutCoordinatorId,
              assignees: assigneesList, // All recipients (teachers and/or coordinators)
              title: fallbackTitle,
              parent_report_assignment_id: null, // Will be linked after creation
              coordinator_user_id: null, // No coordinator_user_id when Principal assigns to Teacher(s) or Coordinator + Teacher(s)
              grade_level_id: Number(selectedGradeLevel),
              subject_ids: subjectIds, // This will create one assignment per subject
              number_of_submission: numberValue, // INT or NULL
            };
            
            const recipientResLAEMPL = await fetch(`${API_BASE}/reports/laempl-mps`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(recipientBodyLAEMPL),
            });
            
            if (!recipientResLAEMPL.ok) {
              const errText = await recipientResLAEMPL.text();
              toast.error(`Created principal assignments, but failed to create recipient assignments: ${errText}`);
              setSubmitting(false);
              return;
            }
            
            const recipientDataLAEMPL = await recipientResLAEMPL.json();
            const recipientAssignmentsLAEMPL = recipientDataLAEMPL.assignments || [];
            console.log('✅ [SetReport] Created recipient assignments:', recipientAssignmentsLAEMPL.map(a => a.report_assignment_id));
            
            // Step 3: Link each recipient assignment to the corresponding principal assignment
            // The assignments should be in the same order (by subject), so we can link them by index
            if (principalAssignmentsLAEMPL.length === recipientAssignmentsLAEMPL.length) {
              try {
                const linkPromises = recipientAssignmentsLAEMPL.map((recipientAssignment, index) => {
                  const principalAssignment = principalAssignmentsLAEMPL[index];
                  if (principalAssignment && recipientAssignment) {
                    return fetch(`${API_BASE}/reports/accomplishment/link-parent`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({
                        teacher_assignment_id: recipientAssignment.report_assignment_id,
                        coordinator_assignment_id: principalAssignment.report_assignment_id
                      })
                    });
                  }
                  return Promise.resolve(null);
                });
                
                const linkResults = await Promise.allSettled(linkPromises);
                const successCount = linkResults.filter(r => r.status === 'fulfilled' && r.value && r.value.ok).length;
                console.log(`✅ [SetReport] Linked ${successCount}/${recipientAssignmentsLAEMPL.length} recipient assignment(s) to principal assignment(s)`);
                
                if (successCount < recipientAssignmentsLAEMPL.length) {
                  console.warn("Some parent-link operations failed for LAEMPL & MPS");
                }
              } catch (e) {
                console.warn("Parent-link API threw error for LAEMPL & MPS:", e);
              }
            } else {
              console.warn("⚠️ [SetReport] Mismatch in assignment counts - principal:", principalAssignmentsLAEMPL.length, "recipient:", recipientAssignmentsLAEMPL.length);
            }
            
            toast.success(`Successfully created principal assignments and recipient assignments with ${assigneesList.length} recipient(s) for ${subjectIds.length} subject(s)!`);
            setIsFormSubmitted(true);
            
            // Redirect after creating all assignments
            const redirectUrl = `/AssignedReport?year=${yearId}&quarter=${quarterId}`;
            navigate(redirectUrl);
            setSubmitting(false);
            return;
          }
          
          // Check if Coordinator is assigning LAEMPL & MPS to Teacher(s) or Teacher(s) + Coordinator (not their own assignment, not from principal)
          // In this case, we need to create TWO sets of assignments:
          // 1. Coordinator's assignments (one per subject, with Coordinator as assignee)
          // 2. Recipient assignments (one per subject, with Teacher(s) or Teacher(s) + Coordinator as assignees, linked to Coordinator's assignments)
          // IMPORTANT: isCoordinatorOwnAssignment is true when coordinator creates assignment for themselves only.
          // But when coordinator assigns to others (has recipients), we need to create two assignments even if isCoordinatorOwnAssignment is true.
          // So we check: coordinator is assigning AND has recipients (not just creating for themselves)
          const coordinatorHasRecipients = assigneesList.length > 0 && assigneesList.some(id => {
            const recipientId = Number(id);
            return recipientId !== Number(user?.user_id); // Has recipients other than themselves
          });
          const isCoordinatorAssigningToTeachersOrMixedLAEMPL = isCoordinator && !isPrincipal && !isFromPrincipalAssignment && 
            reportType === "laempl" && selectedSubCategory === "3" && user?.user_id && coordinatorHasRecipients;
          
          console.log("🔍 [SetReport] Checking if coordinator should create own assignment for LAEMPL & MPS:", {
            isCoordinator,
            isPrincipal,
            isCoordinatorOwnAssignment,
            isFromPrincipalAssignment,
            reportType,
            selectedSubCategory,
            user_id: user?.user_id,
            assigneesListLength: assigneesList.length,
            assigneesList,
            coordinatorHasRecipients,
            isCoordinatorAssigningToTeachersOrMixedLAEMPL
          });
          
          let hasTeacherRecipientsCoordinatorLAEMPL = false;
          let hasOnlyCoordinatorCoordinatorLAEMPL = false;
          
          if (isCoordinatorAssigningToTeachersOrMixedLAEMPL) {
            // Check if there are any teachers in the recipients
            hasTeacherRecipientsCoordinatorLAEMPL = assigneesList.some(recipientId => {
              const recipientUser = usersWithGrades.find(u => String(u.user_id) === String(recipientId)) ||
                coordinators.find(u => String(u.user_id) === String(recipientId));
              return recipientUser?.role?.toLowerCase() === 'teacher';
            });
            
            // Check if there's only a coordinator (no teachers)
            const coordinatorRecipientsCoordinatorLAEMPL = assigneesList.filter(recipientId => {
              const recipientUser = usersWithGrades.find(u => String(u.user_id) === String(recipientId)) ||
                coordinators.find(u => String(u.user_id) === String(recipientId));
              return recipientUser?.role?.toLowerCase() === 'coordinator';
            });
            
            hasOnlyCoordinatorCoordinatorLAEMPL = coordinatorRecipientsCoordinatorLAEMPL.length === assigneesList.length && coordinatorRecipientsCoordinatorLAEMPL.length > 0;
            
            console.log("🔍 [SetReport] Coordinator LAEMPL & MPS assignment check:", {
              hasTeacherRecipientsCoordinatorLAEMPL,
              hasOnlyCoordinatorCoordinatorLAEMPL,
              assigneesList
            });
          }
          
          // If Coordinator is assigning LAEMPL & MPS to Teacher(s), Teacher(s) + Coordinator, or Coordinator only, create two sets of assignments
          // This includes: Coordinator > Teacher(s), Coordinator > Teacher(s) + Coordinator, and Coordinator > Coordinator
          if (isCoordinatorAssigningToTeachersOrMixedLAEMPL && (hasTeacherRecipientsCoordinatorLAEMPL || hasOnlyCoordinatorCoordinatorLAEMPL)) {
            const assignmentType = hasOnlyCoordinatorCoordinatorLAEMPL 
              ? "Coordinator > Coordinator" 
              : hasTeacherRecipientsCoordinatorLAEMPL && !hasOnlyCoordinatorCoordinatorLAEMPL
              ? "Coordinator > Teacher(s) or Teacher(s) + Coordinator"
              : "Coordinator > Others";
            console.log(`✅ [SetReport] Coordinator assigning LAEMPL & MPS (${assignmentType}) - creating two sets of assignments`);
            
            // Step 1: Create Coordinator's assignments (one per subject, with Coordinator as assignee)
            // Clean up base to remove any fields that shouldn't be in coordinator's assignment
            const { assignees: baseAssignees, parent_report_assignment_id: baseParentId, coordinator_user_id: baseCoordUserId, ...baseClean } = base;
            
            const coordinatorBodyLAEMPL = {
              ...baseClean,
              assignees: [Number(user.user_id)], // Coordinator as assignee
              title: fallbackTitle,
              parent_report_assignment_id: null, // Coordinator's assignments are the parents
              coordinator_user_id: Number(user.user_id), // Set coordinator_user_id to the coordinator's own user_id
              grade_level_id: Number(selectedGradeLevel),
              subject_ids: subjectIds, // This will create one assignment per subject
              number_of_submission: numberValue, // INT or NULL
            };
            
            console.log("🔍 [SetReport] Creating coordinator's LAEMPL & MPS assignments with body:", {
              assignees: coordinatorBodyLAEMPL.assignees,
              parent_report_assignment_id: coordinatorBodyLAEMPL.parent_report_assignment_id,
              coordinator_user_id: coordinatorBodyLAEMPL.coordinator_user_id,
              grade_level_id: coordinatorBodyLAEMPL.grade_level_id,
              subject_ids: coordinatorBodyLAEMPL.subject_ids,
              category_id: coordinatorBodyLAEMPL.category_id,
              sub_category_id: coordinatorBodyLAEMPL.sub_category_id,
              note: "coordinator_user_id is set to coordinator's own user_id for parent assignment"
            });
            
            const coordinatorResLAEMPL = await fetch(`${API_BASE}/reports/laempl-mps`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(coordinatorBodyLAEMPL),
            });
            
            if (!coordinatorResLAEMPL.ok) {
              const errText = await coordinatorResLAEMPL.text();
              console.error("❌ [SetReport] Failed to create coordinator assignments:", errText);
              toast.error("Failed to create coordinator assignments: " + errText);
              setSubmitting(false);
              return;
            }
            
            const coordinatorDataLAEMPL = await coordinatorResLAEMPL.json();
            const coordinatorAssignmentsLAEMPL = coordinatorDataLAEMPL.assignments || [];
            console.log('✅ [SetReport] Created coordinator assignments for LAEMPL & MPS:', {
              count: coordinatorAssignmentsLAEMPL.length,
              assignments: coordinatorAssignmentsLAEMPL.map(a => ({
                report_assignment_id: a.report_assignment_id,
                subject_id: a.subject_id,
                subject_name: a.subject_name,
                title: a.title
              })),
              fullResponse: coordinatorDataLAEMPL
            });
            
            if (coordinatorAssignmentsLAEMPL.length === 0) {
              console.error("❌ [SetReport] No coordinator assignments were created! Response:", coordinatorDataLAEMPL);
              toast.error("Failed to create coordinator assignments - no assignments returned");
              setSubmitting(false);
              return;
            }
            
            // Step 2: Create recipient assignments (one per subject, with Teacher(s) or Teacher(s) + Coordinator as assignees, linked to Coordinator's assignments)
            const { coordinator_user_id: baseCoordinatorUserIdLAEMPL, ...baseWithoutCoordinatorId } = base;
            
            const recipientBodyCoordinatorLAEMPL = {
              ...baseWithoutCoordinatorId,
              assignees: assigneesList, // All recipients (teachers and/or coordinators)
              title: fallbackTitle,
              parent_report_assignment_id: null, // Will be linked after creation
              coordinator_user_id: null, // No coordinator_user_id when Coordinator assigns to Teacher(s) or Teacher(s) + Coordinator
              grade_level_id: Number(selectedGradeLevel),
              subject_ids: subjectIds, // This will create one assignment per subject
              number_of_submission: numberValue, // INT or NULL
            };
            
            const recipientResCoordinatorLAEMPL = await fetch(`${API_BASE}/reports/laempl-mps`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(recipientBodyCoordinatorLAEMPL),
            });
            
            if (!recipientResCoordinatorLAEMPL.ok) {
              const errText = await recipientResCoordinatorLAEMPL.text();
              toast.error(`Created coordinator assignments, but failed to create recipient assignments: ${errText}`);
              setSubmitting(false);
              return;
            }
            
            const recipientDataCoordinatorLAEMPL = await recipientResCoordinatorLAEMPL.json();
            const recipientAssignmentsCoordinatorLAEMPL = recipientDataCoordinatorLAEMPL.assignments || [];
            console.log('✅ [SetReport] Created recipient assignments for LAEMPL & MPS:', recipientAssignmentsCoordinatorLAEMPL.map(a => a.report_assignment_id));
            
            // Step 3: Link each recipient assignment to the corresponding coordinator assignment
            // The assignments should be in the same order (by subject), so we can link them by index
            if (coordinatorAssignmentsLAEMPL.length === recipientAssignmentsCoordinatorLAEMPL.length) {
              try {
                const linkPromises = recipientAssignmentsCoordinatorLAEMPL.map((recipientAssignment, index) => {
                  const coordinatorAssignment = coordinatorAssignmentsLAEMPL[index];
                  if (coordinatorAssignment && recipientAssignment) {
                    return fetch(`${API_BASE}/reports/accomplishment/link-parent`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({
                        teacher_assignment_id: recipientAssignment.report_assignment_id,
                        coordinator_assignment_id: coordinatorAssignment.report_assignment_id
                      })
                    });
                  }
                  return Promise.resolve(null);
                });
                
                const linkResults = await Promise.allSettled(linkPromises);
                const successCount = linkResults.filter(r => r.status === 'fulfilled' && r.value && r.value.ok).length;
                console.log(`✅ [SetReport] Linked ${successCount}/${recipientAssignmentsCoordinatorLAEMPL.length} recipient assignment(s) to coordinator assignment(s) for LAEMPL & MPS`);
                
                if (successCount < recipientAssignmentsCoordinatorLAEMPL.length) {
                  console.warn("Some parent-link operations failed for LAEMPL & MPS");
                }
              } catch (e) {
                console.warn("Parent-link API threw error for LAEMPL & MPS:", e);
              }
            } else {
              console.warn("⚠️ [SetReport] Mismatch in assignment counts - coordinator:", coordinatorAssignmentsLAEMPL.length, "recipient:", recipientAssignmentsCoordinatorLAEMPL.length);
            }
            
            toast.success(`Successfully created coordinator assignments and recipient assignments with ${assigneesList.length} recipient(s) for ${subjectIds.length} subject(s)!`);
            setIsFormSubmitted(true);
            
            // Redirect after creating all assignments
            const redirectUrl = `/AssignedReport?year=${yearId}&quarter=${quarterId}`;
            navigate(redirectUrl);
            setSubmitting(false);
            return;
          }
          
          endpoint = `${API_BASE}/reports/laempl-mps`;
          
          // When coordinator is assigning to teachers/coordinators, coordinators should act as teachers
          // Do NOT include coordinator_user_id - it should only be set when principal assigns to coordinator
          // Explicitly exclude coordinator_user_id from base to ensure it's never included when coordinator assigns
          const { coordinator_user_id: baseCoordinatorUserIdLAEMPL, ...baseWithoutCoordinatorId } = base;
          
          body = {
            ...baseWithoutCoordinatorId,
            assignees: assigneesList, // Set assignees (coordinator or teachers)
            title: fallbackTitle,
            grade_level_id: Number(selectedGradeLevel),
            subject_ids: subjectIds, // This will create one assignment per subject
            number_of_submission: numberValue, // INT or NULL
            parent_report_assignment_id: editingReportId || null // Link child assignments to parent if editing
          };
          
          // CRITICAL: Never include coordinator_user_id when coordinator is assigning
          // - Principal → Coordinator (only): coordinator_user_id is included (coordinator acts as coordinator)
          // - Principal → Teacher(s) + Coordinator: coordinator_user_id is NOT included (coordinator acts as teacher)
          // - Coordinator → Coordinator: coordinator_user_id is NOT included (recipient coordinator acts as teacher)
          // - Coordinator → Teacher(s) + Coordinator: coordinator_user_id is NOT included (recipient coordinator acts as teacher)
          // Explicitly ensure coordinator_user_id is NEVER included when coordinator is assigning
          if (isCoordinator) {
            // Coordinator is assigning - explicitly remove coordinator_user_id if it exists (should never be set, but double-check)
            if (body.coordinator_user_id !== undefined) {
              delete body.coordinator_user_id;
              console.warn("⚠️ [SetReport] Removed coordinator_user_id from body - coordinator is assigning, recipient should act as teacher");
            }
          } else if (isPrincipal && !isCoordinator && baseCoordinatorUserIdLAEMPL) {
            // Only include if principal is assigning (and definitely not a coordinator)
            body.coordinator_user_id = baseCoordinatorUserIdLAEMPL;
          }
        } else {
          // Simple LAEMPL (not LAEMPL & MPS)
          // Check if Principal is assigning to Teacher(s) or Coordinator + Teacher(s) (not just Coordinator only)
          const isPrincipalAssigningToTeachersOrMixedSimpleLAEMPL = isPrincipal && !isCoordinator && user?.user_id && finalRecipients.length > 0;
          let hasTeacherRecipientsSimpleLAEMPL = false;
          let hasOnlyCoordinatorSimpleLAEMPL = false;
          
          if (isPrincipalAssigningToTeachersOrMixedSimpleLAEMPL) {
            // Check if there are any teachers in the recipients
            hasTeacherRecipientsSimpleLAEMPL = finalRecipients.some(recipientId => {
              const recipientUser = usersWithGrades.find(u => String(u.user_id) === String(recipientId)) ||
                coordinators.find(u => String(u.user_id) === String(recipientId));
              return recipientUser?.role?.toLowerCase() === 'teacher';
            });
            
            // Check if there's only a coordinator (no teachers)
            const coordinatorRecipientsSimpleLAEMPL = finalRecipients.filter(recipientId => {
              const recipientUser = usersWithGrades.find(u => String(u.user_id) === String(recipientId)) ||
                coordinators.find(u => String(u.user_id) === String(recipientId));
              return recipientUser?.role?.toLowerCase() === 'coordinator';
            });
            
            hasOnlyCoordinatorSimpleLAEMPL = coordinatorRecipientsSimpleLAEMPL.length === finalRecipients.length && coordinatorRecipientsSimpleLAEMPL.length > 0;
          }
          
          // If Principal is assigning to Teacher(s) or Coordinator + Teacher(s), create two assignments
          if (isPrincipalAssigningToTeachersOrMixedSimpleLAEMPL && hasTeacherRecipientsSimpleLAEMPL && !hasOnlyCoordinatorSimpleLAEMPL) {
            console.log("✅ [SetReport] Principal assigning to Teacher(s) or Coordinator + Teacher(s) for simple LAEMPL - creating two assignments");
            
            // Step 1: Create Principal's assignment (with Principal as assignee)
            const principalBodySimpleLAEMPL = {
              ...base,
              assignees: [Number(user.user_id)], // Principal as assignee
              title: fallbackTitle,
              parent_report_assignment_id: null, // Principal's assignment is the parent
              coordinator_user_id: null, // No coordinator_user_id for Principal's own assignment
              grade: 1,
              number_of_submission: numberValue, // INT or NULL
            };
            
            const principalResSimpleLAEMPL = await fetch(`${API_BASE}/reports/laempl`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(principalBodySimpleLAEMPL),
            });
            
            if (!principalResSimpleLAEMPL.ok) {
              const errText = await principalResSimpleLAEMPL.text();
              toast.error("Failed to create principal assignment: " + errText);
              setSubmitting(false);
              return;
            }
            
            const principalDataSimpleLAEMPL = await principalResSimpleLAEMPL.json();
            const principalAssignmentIdSimpleLAEMPL = principalDataSimpleLAEMPL.report_assignment_id;
            console.log('✅ [SetReport] Created principal assignment for simple LAEMPL:', principalAssignmentIdSimpleLAEMPL);
            
            // Step 2: Create recipient assignment (with Teacher(s) or Coordinator + Teacher(s) as assignees, linked to Principal's assignment)
            const { coordinator_user_id: baseCoordinatorUserIdLAEMPLSimple, ...baseWithoutCoordinatorIdLAEMPLSimple } = base;
            
            const recipientBodySimpleLAEMPL = {
              ...baseWithoutCoordinatorIdLAEMPLSimple,
              assignees: finalRecipients.map((x) => Number(x)), // All recipients (teachers and/or coordinators)
              title: fallbackTitle,
              parent_report_assignment_id: principalAssignmentIdSimpleLAEMPL, // Link to Principal's assignment
              coordinator_user_id: null, // No coordinator_user_id when Principal assigns to Teacher(s) or Coordinator + Teacher(s)
              grade: 1,
              number_of_submission: numberValue, // INT or NULL
            };
            
            const recipientResSimpleLAEMPL = await fetch(`${API_BASE}/reports/laempl`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(recipientBodySimpleLAEMPL),
            });
            
            if (!recipientResSimpleLAEMPL.ok) {
              const errText = await recipientResSimpleLAEMPL.text();
              toast.error(`Created principal assignment, but failed to create recipient assignment: ${errText}`);
              setSubmitting(false);
              return;
            }
            
            toast.success(`Successfully created principal assignment and recipient assignment with ${finalRecipients.length} recipient(s) for simple LAEMPL!`);
            setIsFormSubmitted(true);
            
            // Redirect after creating all assignments
            const redirectUrl = `/AssignedReport?year=${yearId}&quarter=${quarterId}`;
            navigate(redirectUrl);
            setSubmitting(false);
            return;
          }
          
          endpoint = `${API_BASE}/reports/laempl`;
          
          // When coordinator is assigning, coordinators should act as teachers
          // Do NOT include coordinator_user_id - it should only be set when principal assigns to coordinator
          const { coordinator_user_id: baseCoordinatorUserIdLAEMPLSimple, ...baseWithoutCoordinatorIdLAEMPLSimple } = base;
          
          body = {
            ...baseWithoutCoordinatorIdLAEMPLSimple,
            title: fallbackTitle,
            grade: 1,
            number_of_submission: numberValue, // INT or NULL
          };
          
          // Explicitly ensure coordinator_user_id is NEVER included when coordinator is assigning
          if (isCoordinator) {
            delete body.coordinator_user_id;
          } else if (isPrincipal && baseCoordinatorUserIdLAEMPLSimple) {
            body.coordinator_user_id = baseCoordinatorUserIdLAEMPLSimple;
          }
        }
      } else {
        // generic + MPS both go here (MPS rows filled by teacher UI later)
        // Check if Principal is assigning to Teacher(s) or Coordinator + Teacher(s) (not just Coordinator only)
        const isPrincipalAssigningToTeachersOrMixedGeneric = isPrincipal && !isCoordinator && user?.user_id && finalRecipients.length > 0;
        let hasTeacherRecipientsGeneric = false;
        let hasOnlyCoordinatorGeneric = false;
        
        if (isPrincipalAssigningToTeachersOrMixedGeneric) {
          // Check if there are any teachers in the recipients
          hasTeacherRecipientsGeneric = finalRecipients.some(recipientId => {
            const recipientUser = usersWithGrades.find(u => String(u.user_id) === String(recipientId)) ||
              coordinators.find(u => String(u.user_id) === String(recipientId));
            return recipientUser?.role?.toLowerCase() === 'teacher';
          });
          
          // Check if there's only a coordinator (no teachers)
          const coordinatorRecipientsGeneric = finalRecipients.filter(recipientId => {
            const recipientUser = usersWithGrades.find(u => String(u.user_id) === String(recipientId)) ||
              coordinators.find(u => String(u.user_id) === String(recipientId));
            return recipientUser?.role?.toLowerCase() === 'coordinator';
          });
          
          hasOnlyCoordinatorGeneric = coordinatorRecipientsGeneric.length === finalRecipients.length && coordinatorRecipientsGeneric.length > 0;
        }
        
        // If Principal is assigning to Teacher(s) or Coordinator + Teacher(s), create two assignments
        if (isPrincipalAssigningToTeachersOrMixedGeneric && hasTeacherRecipientsGeneric && !hasOnlyCoordinatorGeneric) {
          console.log("✅ [SetReport] Principal assigning to Teacher(s) or Coordinator + Teacher(s) for generic/MPS - creating two assignments");
          
          // Step 1: Create Principal's assignment (with Principal as assignee)
          const principalBodyGeneric = {
            ...base,
            assignees: [Number(user.user_id)], // Principal as assignee
            title: fallbackTitle,
            parent_report_assignment_id: null, // Principal's assignment is the parent
            coordinator_user_id: null, // No coordinator_user_id for Principal's own assignment
            field_definitions: [],
            number_of_submission: numberValue, // INT or NULL
          };
          
          const principalResGeneric = await fetch(`${API_BASE}/reports/give`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(principalBodyGeneric),
          });
          
          if (!principalResGeneric.ok) {
            const errText = await principalResGeneric.text();
            toast.error("Failed to create principal assignment: " + errText);
            setSubmitting(false);
            return;
          }
          
          const principalDataGeneric = await principalResGeneric.json();
          const principalAssignmentIdGeneric = principalDataGeneric.report_assignment_id;
          console.log('✅ [SetReport] Created principal assignment for generic/MPS:', principalAssignmentIdGeneric);
          
          // Step 2: Create recipient assignment (with Teacher(s) or Coordinator + Teacher(s) as assignees, linked to Principal's assignment)
          const { coordinator_user_id: baseCoordinatorUserIdGeneric, ...baseWithoutCoordinatorIdGeneric } = base;
          
          const recipientBodyGeneric = {
            ...baseWithoutCoordinatorIdGeneric,
            assignees: finalRecipients.map((x) => Number(x)), // All recipients (teachers and/or coordinators)
            title: fallbackTitle,
            parent_report_assignment_id: principalAssignmentIdGeneric, // Link to Principal's assignment
            coordinator_user_id: null, // No coordinator_user_id when Principal assigns to Teacher(s) or Coordinator + Teacher(s)
            field_definitions: [],
            number_of_submission: numberValue, // INT or NULL
          };
          
          const recipientResGeneric = await fetch(`${API_BASE}/reports/give`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(recipientBodyGeneric),
          });
          
          if (!recipientResGeneric.ok) {
            const errText = await recipientResGeneric.text();
            toast.error(`Created principal assignment, but failed to create recipient assignment: ${errText}`);
            setSubmitting(false);
            return;
          }
          
          toast.success(`Successfully created principal assignment and recipient assignment with ${finalRecipients.length} recipient(s) for generic/MPS!`);
          setIsFormSubmitted(true);
          
          // Redirect after creating all assignments
          const redirectUrl = `/AssignedReport?year=${yearId}&quarter=${quarterId}`;
          navigate(redirectUrl);
          setSubmitting(false);
          return;
        }
        
        // When coordinator is assigning to teachers/coordinators, coordinators should act as teachers
        // Do NOT include coordinator_user_id - it should only be set when principal assigns to coordinator
        const { coordinator_user_id: baseCoordinatorUserIdGeneric, ...baseWithoutCoordinatorIdGeneric } = base;
        
        endpoint = `${API_BASE}/reports/give`;
        body = {
          ...baseWithoutCoordinatorIdGeneric,
          title: fallbackTitle,
          field_definitions: [],
          number_of_submission: numberValue, // INT or NULL
        };
        
        // Only include coordinator_user_id if principal is assigning (not when coordinator is assigning to others)
        // - Principal → Coordinator (only): coordinator_user_id is included (coordinator acts as coordinator)
        // - Principal → Teacher(s) + Coordinator: coordinator_user_id is NOT included (coordinator acts as teacher)
        // - Coordinator → Coordinator: coordinator_user_id is NOT included (recipient coordinator acts as teacher)
        // - Coordinator → Teacher(s) + Coordinator: coordinator_user_id is NOT included (recipient coordinator acts as teacher)
        // Explicitly ensure coordinator_user_id is NEVER included when coordinator is assigning
        if (isCoordinator) {
          // Coordinator is assigning - explicitly remove coordinator_user_id if it exists
          delete body.coordinator_user_id;
        } else if (isPrincipal && baseCoordinatorUserIdGeneric) {
          // Only include if principal is assigning (and not a coordinator)
          body.coordinator_user_id = baseCoordinatorUserIdGeneric;
        }
      }

      // FINAL SAFEGUARD: Ensure coordinator_user_id is NEVER included when coordinator is assigning
      // This is a last check before sending to the API
      if (isCoordinator && body.coordinator_user_id !== undefined) {
        console.warn("⚠️ [SetReport] FINAL SAFEGUARD: Removing coordinator_user_id from body before API call - coordinator is assigning");
        delete body.coordinator_user_id;
      }
      
      // Log the final body for debugging
      console.log("🔍 [SetReport] Final body being sent to API:", {
        endpoint,
        isCoordinator,
        isPrincipal,
        hasCoordinatorUserId: body.coordinator_user_id !== undefined,
        coordinator_user_id: body.coordinator_user_id,
        assignees: body.assignees,
        bodyKeys: Object.keys(body)
      });
      
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
      // Link teacher assignments to coordinator's assignment when:
      // 1. Coordinator is assigning to teachers from their own assignment (editingReportId exists and isCoordinatorOwnAssignment)
      // 2. OR coordinator is assigning from a principal's assignment (editingReportId exists)
      if (isCoordinator && editingReportId && isCoordinatorAssigning) {
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
        
        // Link all assignments to the parent (coordinator's assignment)
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
                  coordinator_assignment_id: editingReportId // Coordinator's own assignment is the parent
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
              assignees: finalRecipients.map((x) => Number(x)) // Use finalRecipients that may include coordinator
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
      setIsFormSubmitted(true);

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

  // Cleanup on unmount
  useEffect(() => {
    console.log('🔵 [SetReport] Component mounted');
    return () => {
      console.log('🔴 [SetReport] Component unmounting');
      // Reset state when component unmounts
      setTeacherMenuOpen(false);
      setSubjectMenuOpen(false);
    };
  }, []);

  // Log route changes
  useEffect(() => {
    console.log('🔄 [SetReport] Location changed:', location.pathname);
  }, [location.pathname]);

  // Track form changes to detect unsaved data
  useEffect(() => {
    // Don't track changes if form was just submitted successfully
    if (isFormSubmitted) {
      setHasUnsavedChanges(false);
      return;
    }

    // Don't track changes until form data has been loaded (if editing)
    // This prevents false positives when loading existing report data
    if (editingReportId && !originalReportData) {
      setHasUnsavedChanges(false);
      return;
    }

    // Check if any form field has been modified from initial state
    // For new reports, any filled field indicates unsaved changes
    // For existing reports, compare with original data
    let hasChanges = false;
    
    if (originalReportData) {
      // Compare with original data when editing
      hasChanges = 
        title !== (originalReportData.title || "") ||
        selectedCategory !== String(originalReportData.category_id || "") ||
        selectedSubCategory !== String(originalReportData.sub_category_id || "") ||
        startDate !== (originalReportData.from_date ? new Date(originalReportData.from_date).toISOString().split('T')[0] : "") ||
        dueDate !== (originalReportData.to_date ? new Date(originalReportData.to_date).toISOString().split('T')[0] : "") ||
        instruction !== (originalReportData.instruction || "") ||
        allowLate !== (originalReportData.allow_late === 1) ||
        attempts !== (originalReportData.number_of_submission === null ? "unlimited" : String(originalReportData.number_of_submission || ""));
      // Note: selectedTeachers, selectedSchoolYear, selectedQuarter are loaded separately
      // so we track them separately - if they change after loading, it's a modification
    } else {
      // For new reports, any filled field indicates unsaved changes
      hasChanges = 
        title !== "" ||
        selectedCategory !== "" ||
        selectedSubCategory !== "" ||
        selectedSchoolYear !== "" ||
        selectedQuarter !== "" ||
        startDate !== "" ||
        dueDate !== "" ||
        instruction !== "" ||
        selectedTeachers.length > 0 ||
        selectedTeacher !== "" ||
        selectedGradeLevel !== "" ||
        selectedSubjects.length > 0 ||
        selectedCoordinator !== "" ||
        attempts !== "" ||
        allowLate !== false;
    }

    setHasUnsavedChanges(hasChanges);
  }, [
    title,
    selectedCategory,
    selectedSubCategory,
    selectedSchoolYear,
    selectedQuarter,
    startDate,
    dueDate,
    instruction,
    selectedTeachers,
    selectedTeacher,
    selectedGradeLevel,
    selectedSubjects,
    selectedCoordinator,
    attempts,
    allowLate,
    isFormSubmitted,
    editingReportId,
    originalReportData
  ]);

  // Add beforeunload warning for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges && !isFormSubmitted) {
        // Modern browsers ignore custom messages, but we still need to set returnValue
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges, isFormSubmitted]);

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
              <div className="form-row form-row-title">
                <label>Title:</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isCoordinator && (isFromPrincipalAssignment || isPrincipalReportParam)}
                />
              </div>

              <div className="form-row form-row-school-quarter">
                <label>School Year:</label>
                <select
                  value={selectedSchoolYear}
                  onChange={(e) => setSelectedSchoolYear(e.target.value)}
                  required
                  disabled={isCoordinator && (isFromPrincipalAssignment || isPrincipalReportParam)}
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
                  disabled={isCoordinator && (isFromPrincipalAssignment || isPrincipalReportParam)}
                >
                  <option value="">Select Quarter</option>
                  {quarters.map((quarter) => (
                    <option key={quarter.value} value={quarter.value}>
                      {quarter.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row form-row-category">
                <label>Category:</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedSubCategory("");
                  }}
                  disabled={isCoordinator && (isFromPrincipalAssignment || isPrincipalReportParam)}
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

                {/* Sub-Category appears directly after Category when Category is selected and not Accomplishment Report */}
                {selectedCategory && String(selectedCategory) !== "0" && (
                  <>
                    <label>Sub-Category:</label>
                    <select
                      value={selectedSubCategory}
                      onChange={(e) => setSelectedSubCategory(e.target.value)}
                      disabled={isCoordinator && isFromPrincipalAssignment}
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
                  </>
                )}
              </div>

              <div className={`form-row form-row-recipients ${selectedSubCategory === "3" ? "with-grade" : ""}`}>
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
                        {selectableUsers.length === 0 ? (
                          <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
                            No users available. {console.log('⚠️ [DEBUG] selectableUsers is empty:', { users, coordinators, usersWithGrades, isPrincipal, selectedGradeLevel, selectedSubCategory })}
                            <br />
                            <small>Check browser console for details.</small>
                          </div>
                        ) : (
                          selectableUsers.map((u) => {
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
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Grade Level appears side-by-side with Teachers & Coordinators when Sub-Category is LAEMPL & MPS */}
                {selectedSubCategory === "3" && (
                  <>
                    <label style={{ marginLeft: '12px' }}>Grade Level:</label>
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
                      disabled={(isCoordinator && isFromPrincipalAssignment) || shouldLockGradeLevel}
                    >
                      <option value="">Select Grade Level</option>
                      {gradeLevels.map((grade) => (
                        <option key={grade.grade_level_id} value={grade.grade_level_id}>
                          Grade {grade.grade_level}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              {/* Subject Selection for LAEMPL & MPS - appears in its own full row when Teachers & Coordinators has selected users */}
              {selectedSubCategory === "3" && selectedGradeLevel && selectedTeachers.length > 0 && (
                <div className="form-row form-row-subjects">
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
                      style={{ width: "100%", maxWidth: "none" }}
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
                </div>
              )}

              <div className="form-row form-row-dates">
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

              <div className="form-row form-row-allow-late allow-late-row">
                <div className="inline-field">
                  <label>Allow Late:</label>
                  <input
                    type="checkbox"
                    checked={allowLate}
                    onChange={(e) => setAllowLate(e.target.checked)}
                  />
                </div>

                <div className="inline-field attempts-field">
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
              </div>

              <div className="form-row form-row-instructions textarea-row">
                <label>Instructions:</label>
                <textarea
                  placeholder="Enter instructions for the report"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                ></textarea>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="set-schedule-btn"
                  disabled={submitting}
                >
                  {(() => {
                    // If editing a principal's report and it's an Edit action, show "Edit"
                    if (isEditingPrincipalReport && isEditAction && editingReportId) {
                      if (submitting) {
                        return "Updating...";
                      }
                      return "Edit";
                    }
                    
                    // Always show "Set Schedule" for consistency
                    if (submitting) {
                      return "Setting...";
                    }
                    return "Set Schedule";
                  })()}
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
