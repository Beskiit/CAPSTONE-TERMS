import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const [user, setUser] = useState(null);
  const role = (user?.role || "").toLowerCase();
  const isCoordinator = role === "coordinator";
  const isPrincipal = role === "principal";
  
  // Report editing state
  const [editingReportId, setEditingReportId] = useState(null);
  const [isEditingPrincipalReport, setIsEditingPrincipalReport] = useState(false);
  const [originalReportData, setOriginalReportData] = useState(null);

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
      // Filter users by grade level for LAEMPL & MPS
      const filteredUsers = usersWithGrades.filter(user => 
        user.grade_level == selectedGradeLevel
      );
      return filteredUsers;
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
      
      const res = await fetch(`${API_BASE}/reports/assignment/${reportId}`, {
        credentials: "include"
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch report data');
      }
      
      const reportData = await res.json();
      console.log('🔄 [DEBUG] Loaded report data:', reportData);

      // Guard: coordinators cannot edit when already given
      if (isCoordinator && (reportData?.is_given === 1 || reportData?.is_given === '1')) {
        toast.error('This report has already been given to teachers.');
        navigate(-1);
        return;
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
      
      toast.success('Report data loaded. You can now modify the schedule before assigning to teachers.');
      
    } catch (error) {
      console.error('Error loading report data:', error);
      toast.error('Failed to load report data');
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
      // Only require subject selection if no coordinator is selected
      if (!hasCoordinatorSelected && selectedSubjects.length === 0) {
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
        if (isLAEMPLMPS && selectedGradeLevel) {
          if (hasCoordinatorSelected) {
            // For coordinators: create single submission with all subjects
            endpoint = `${API_BASE}/reports/laempl-mps-coordinator`;
            body = {
              ...base,
              title: fallbackTitle,
              grade_level_id: Number(selectedGradeLevel),
              number_of_submission: numberValue, // INT or NULL
            };
          } else if (selectedSubjects.length > 0) {
            // For teachers: create separate submissions per subject
            endpoint = `${API_BASE}/reports/laempl-mps`;
            body = {
              ...base,
              title: fallbackTitle,
              grade_level_id: Number(selectedGradeLevel),
              subject_ids: selectedSubjects.map((id) => Number(id)),
              number_of_submission: numberValue, // INT or NULL
            };
          } else {
            toast.error("Please select subjects for teachers or ensure coordinators are selected.");
            return;
          }
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
      if (isCoordinator && editingReportId && data && data.report_assignment_id) {
        // editingReportId = parent/coordinator assignment
        // data.report_assignment_id = child/teacher assignment just created
        try {
          const linkResponse = await fetch(`${API_BASE}/reports/accomplishment/link-parent`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              teacher_assignment_id: data.report_assignment_id,
              coordinator_assignment_id: editingReportId
            })
          });
          if (linkResponse.ok) {
            console.log("Parent assignment linked to teacher assignment automatically!");
          } else {
            const errText = await linkResponse.text();
            console.warn("Parent-link API failed:", errText);
          }
        } catch (e) {
          console.warn("Parent-link API threw error:", e);
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
    setSelectedTeachers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : prev.concat(userId)
    );
  };
  const selectAllTeachers = () => setSelectedTeachers(selectableUsers.map((u) => u.user_id));
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
                            .filter(u => selectedTeachers.includes(u.user_id))
                            .map(u => u.name)
                            .join(", ")
                        : "Select Teachers & Coordinators"
                    }
                  >
                    <span className="teacher-trigger-label">
                      {selectedTeachers.length
                        ? selectedTeachers.length === 1
                          ? selectableUsers
                              .filter(u => selectedTeachers.includes(u.user_id))
                              .map(u => u.name)[0]
                          : selectedTeachers.length <= 3
                          ? selectableUsers
                              .filter(u => selectedTeachers.includes(u.user_id))
                              .map(u => u.name)
                              .join(", ")
                          : `${selectedTeachers.length} teachers selected`
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
                          const checked = selectedTeachers.includes(u.user_id);
                          return (
                            <div
                              key={u.user_id}
                              onClick={() => toggleTeacher(u.user_id)}
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
                        setSelectedGradeLevel(e.target.value);
                        setSelectedSubjects([]); // Clear subjects when grade changes
                        setSelectedTeachers([]); // Clear teachers when grade changes (for LAEMPL & MPS)
                      }}
                    >
                      <option value="">Select Grade Level</option>
                      {gradeLevels.map((grade) => (
                        <option key={grade.grade_level_id} value={grade.grade_level_id}>
                          Grade {grade.grade_level}
                        </option>
                      ))}
                    </select>

                    {selectedGradeLevel && !hasCoordinatorSelected && (
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
