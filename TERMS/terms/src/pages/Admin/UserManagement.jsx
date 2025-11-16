import React, { useState, useEffect } from "react";
import Sidebar from "../../components/shared/SidebarAdmin";
import "./UserManagement.css";
import { useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header";
import Breadcrumb from "../../components/Breadcrumb";
import Edit from "../../assets/edit.svg";
import Delete from "../../assets/delete.svg";
import Modal from "react-modal";
import AddSchool from "./AddSchool";
import QuarterEnumService from "../../services/quarterEnumService";
import QuarterSelector from "../../components/QuarterSelector";
import YearQuarterSelector from "../../components/YearQuarterSelector";
import toast from "react-hot-toast";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:5000").replace(/\/$/, "");

function UserManagement() {
  const navigate = useNavigate();
  const [openPopupAdd, setOpenPopupAdd] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [openPopupAssign, setOpenPopupAssign] = useState(false);
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddSchool, setShowAddSchool] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: ''
  });
  const [roles, setRoles] = useState([]);
  const [assignmentDetails, setAssignmentDetails] = useState({
    section: '',
    gradeLevel: '',
    category: '',
    subCategory: '',
    laemplGradeLevelId: ''
  });
  const [showYearQuarterModal, setShowYearQuarterModal] = useState(false);
  const [yearQuarter, setYearQuarter] = useState({
    startYear: ''
  });
  const [activeYearQuarter, setActiveYearQuarter] = useState(null);
  const [allYearQuarters, setAllYearQuarters] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [sections, setSections] = useState([]);
  const [gradeLevels, setGradeLevels] = useState([]);
  const [laemplAssignments, setLaemplAssignments] = useState([]);

  useEffect(() => {
    // ensure the element id matches your index.html (#root is default in Vite)
    Modal.setAppElement("#root");
    fetchSchools();
    fetchRoles();
    fetchActiveYearQuarter();
    fetchAllYearQuarters();
    fetchCategories();
    fetchGradeLevels();
    fetchLaemplAssignments();
    initializeSchema();
  }, []);

  const initializeSchema = async () => {
    try {
      // First try the regular schema initialization
      await fetch(`${API_BASE}/admin/init-schema`, {
        method: 'POST',
        credentials: "include"
      });
    } catch (err) {
      console.error("Error initializing schema:", err);
      
      // If that fails, try the manual database fix
      try {
        await fetch(`${API_BASE}/admin/fix-database`, {
          method: 'POST',
          credentials: "include"
        });
        console.log("Database schema fixed manually");
      } catch (fixErr) {
        console.error("Error fixing database:", fixErr);
      }
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/roles`, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setRoles(data);
    } catch (err) {
      console.error("Error fetching roles:", err);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.role) {
      alert("Please fill in all fields");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const addedUser = await response.json();
      setUsers([...users, addedUser]);
      setShowAddUserModal(false);
      setNewUser({ name: '', email: '', role: '' });
      alert("User added successfully!");
    } catch (err) {
      console.error("Error adding user:", err);
      alert("Failed to add user");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewUser(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const fetchActiveYearQuarter = async () => {
    try {
      const data = await QuarterEnumService.getActiveYearQuarter();
      setActiveYearQuarter(data);
    } catch (err) {
      console.error("Error fetching active year quarter:", err);
      // Fallback to direct API call
      try {
        const response = await fetch(`${API_BASE}/admin/active-year-quarter`, { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          setActiveYearQuarter(data);
        }
      } catch (fallbackErr) {
        console.error("Fallback API call also failed:", fallbackErr);
      }
    }
  };

  const fetchAllYearQuarters = async () => {
    try {
      // Fetch school years for dropdown (unique years only)
      const schoolYearsRes = await fetch(`${API_BASE}/admin/school-years`, { credentials: "include" });
      if (!schoolYearsRes.ok) {
        throw new Error(`HTTP error! status: ${schoolYearsRes.status}`);
      }
      const schoolYearsData = await schoolYearsRes.json();
      
      // Set school years for dropdown
      setAllYearQuarters(schoolYearsData);
    } catch (err) {
      console.error("Error fetching school years:", err);
    }
  };

  const handleYearQuarterChange = (e) => {
    const { name, value } = e.target;
    setYearQuarter(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSetActiveYearQuarter = async () => {
    if (!selectedYear || !selectedQuarter) {
      alert('Please select both year and quarter');
      return;
    }

    try {
      // Use quarter enum service to set active year quarter
      const result = await QuarterEnumService.setActiveYearQuarter(selectedYear, selectedQuarter);
      
      alert('Active year and quarter updated successfully');
      fetchActiveYearQuarter(); // Refresh the active year quarter
      setSelectedYear('');
      setSelectedQuarter('');
    } catch (error) {
      console.error('Error setting active year quarter:', error);
      alert('Error updating active year and quarter');
    }
  };

  const handleAddYearQuarter = async (e) => {
    e.preventDefault();
    if (!yearQuarter.startYear) {
      alert("Please select a year");
      return;
    }

    // Automatically calculate end year (start year + 1)
    const endYear = parseInt(yearQuarter.startYear) + 1;

    try {
      // Create the year string in format "2024-2025"
      const yearString = `${yearQuarter.startYear}-${endYear}`;
      
      const response = await fetch(`${API_BASE}/admin/school-year`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startYear: yearQuarter.startYear,
          endYear: endYear.toString()
        }),
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const addedSchoolYear = await response.json();
      setShowYearQuarterModal(false);
      setYearQuarter({ startYear: '' });
      fetchActiveYearQuarter(); // Refresh the active year quarter
      fetchAllYearQuarters(); // Refresh the list of year quarters
      alert("School Year added successfully! All 4 quarters have been created automatically.");
    } catch (err) {
      console.error("Error adding school year:", err);
      alert("Failed to add school year");
    }
  };


  const handleDelete = async () => {
    if (!userToDelete) return;
    
    try {
      const response = await fetch(`${API_BASE}/admin/users/${userToDelete.user_id}`, {
        method: 'DELETE',
        credentials: "include"
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Remove the user from the local state
      setUsers(users.filter(user => user.user_id !== userToDelete.user_id));

      toast.success(result.message || "User deleted successfully!");
      setConfirmOpen(false);
      setUserToDelete(null);
    } catch (err) {
      console.error("Error deleting user:", err);
      toast.error(err.message || "Failed to delete user");
    }
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setSelectedSchool(user.school_name || '');
    setAssignmentDetails({
      section: '',
      gradeLevel: '',
      category: '',
      subCategory: '',
      laemplGradeLevelId: ''
    });
    setShowAssignmentModal(true);
    
    // If user has a school, fetch sections for that school
    if (user.school_name) {
      const school = schools.find(s => s.school_name === user.school_name);
      if (school) {
        fetchSections(school.school_id);
      }
    }
  };

  const fetchSchools = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/schools`, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setSchools(data);
    } catch (err) {
      console.error("Error fetching schools:", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE}/categories`, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setCategories(data);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  const fetchSubCategories = async (categoryId) => {
    try {
      const response = await fetch(`${API_BASE}/subcategories/${categoryId}`, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setSubCategories(data);
    } catch (err) {
      console.error("Error fetching sub-categories:", err);
    }
  };

  const fetchSections = async (schoolId) => {
    try {
      const response = await fetch(`${API_BASE}/admin/sections/${schoolId}`, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setSections(data);
    } catch (err) {
      console.error("Error fetching sections:", err);
    }
  };

  const fetchGradeLevels = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/grade-levels`, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setGradeLevels(data);
    } catch (err) {
      console.error("Error fetching grade levels:", err);
    }
  };


  const fetchLaemplAssignments = async () => {
    try {
      const response = await fetch(`${API_BASE}/reports/laempl-mps/assignments`, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setLaemplAssignments(data || []);
    } catch (err) {
      console.error("Error fetching LAEMPL & MPS assignments:", err);
    }
  };


  useEffect(() => {
    if (!showAssignmentModal || !selectedUser || selectedUser.role !== "coordinator") return;

    const match = laemplAssignments.find(
      (assignment) => Number(assignment.coordinator_user_id) === Number(selectedUser.user_id)
    );

    setAssignmentDetails((prev) => ({
      ...prev,
      laemplGradeLevelId: match?.grade_level_id ? String(match.grade_level_id) : ""
    }));
  }, [showAssignmentModal, selectedUser, laemplAssignments]);

  useEffect(() => {
    if (!selectedUser || selectedUser.role !== "coordinator") return;
    const isLaemplSelection =
      String(assignmentDetails.category) === '1' &&
      String(assignmentDetails.subCategory) === '3';
    if (!isLaemplSelection) return;
    if (!assignmentDetails.laemplGradeLevelId && assignmentDetails.gradeLevel) {
      setAssignmentDetails((prev) => ({
        ...prev,
        laemplGradeLevelId: prev.gradeLevel
      }));
    }
  }, [assignmentDetails.gradeLevel, assignmentDetails.category, assignmentDetails.subCategory, selectedUser]);

  const getGradeLabel = (gradeLevelId) => {
    const grade = gradeLevels.find((g) => String(g.grade_level_id) === String(gradeLevelId));
    return grade?.grade_level ?? gradeLevelId;
  };

  const findLaemplAssignmentForGrade = (gradeLevelId) => {
    const byGrade = laemplAssignments.find(
      (assignment) => Number(assignment.grade_level_id) === Number(gradeLevelId)
    );
    if (byGrade) return byGrade;
    return laemplAssignments.find((assignment) => assignment.grade_level_id == null);
  };

  const findLaemplAssignmentForCoordinator = (coordinatorUserId) =>
    laemplAssignments.find(
      (assignment) => Number(assignment.coordinator_user_id) === Number(coordinatorUserId)
    );

  const updateAccomplishmentCoordinatorAssignment = async (options) => {
    const {
      coordinatorUserId
    } = options || {};

    console.log('[UserManagement] updateAccomplishmentCoordinatorAssignment called:', {
      coordinatorUserId,
      activeYearQuarter
    });

    if (!coordinatorUserId || !activeYearQuarter) {
      console.warn("[UserManagement] Cannot create Accomplishment Report assignment: missing coordinatorUserId or activeYearQuarter");
      return null;
    }

    try {
      // Check if an Accomplishment Report assignment already exists for this coordinator
      console.log('[UserManagement] Checking for existing Accomplishment Report assignments...');
      const checkResponse = await fetch(`${API_BASE}/reports`, {
        credentials: "include"
      });

      if (!checkResponse.ok) {
        console.warn("[UserManagement] Failed to check existing assignments:", checkResponse.status, checkResponse.statusText);
        return null;
      }

      const allAssignments = await checkResponse.json();
      console.log('[UserManagement] All assignments fetched:', allAssignments.length);
      
      const existingAssignment = allAssignments.find(assignment => 
        Number(assignment.category_id) === 0 &&
        assignment.coordinator_user_id != null &&
        Number(assignment.coordinator_user_id) === Number(coordinatorUserId) &&
        Number(assignment.quarter) === Number(activeYearQuarter.quarter) &&
        Number(assignment.year) === Number(activeYearQuarter.year)
      );

      if (existingAssignment) {
        console.log('[UserManagement] Existing Accomplishment Report assignment found:', existingAssignment);
        // Assignment already exists
        return existingAssignment;
      }

      console.log('[UserManagement] No existing assignment found, creating new one...');

      // Create a new Accomplishment Report assignment with coordinator_user_id
      // NOTE: Do NOT include coordinator in assignees - they should only be the coordinator,
      // not a recipient. They'll see this when they use "Set as Report to Teachers" button.
      // The backend will skip creating submissions when assignees is empty and coordinator_user_id is set.
      // Set a default to_date (30 days from now)
      const defaultToDate = new Date();
      defaultToDate.setDate(defaultToDate.getDate() + 30); // 30 days from now
      const toDateString = defaultToDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      const payload = {
        category_id: 0,
        sub_category_id: null,
        given_by: coordinatorUserId, // The coordinator themselves
        assignees: [], // Empty - coordinator is not an assignee, only the coordinator_user_id
        quarter: Number(activeYearQuarter.quarter),
        year: Number(activeYearQuarter.year),
        title: "Accomplishment Report",
        instruction: "Accomplishment Report assignment",
        is_given: 0, // Not given yet, coordinator will distribute to teachers
        is_archived: 0,
        allow_late: 0,
        coordinator_user_id: Number(coordinatorUserId),
        parent_report_assignment_id: null,
        from_date: new Date().toISOString().split('T')[0], // Today's date
        to_date: toDateString, // Required field
        number_of_submission: null
      };

      console.log('[UserManagement] Creating Accomplishment Report assignment with payload:', payload);

      const response = await fetch(`${API_BASE}/reports/accomplishment/give`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log('[UserManagement] Response status:', response.status, response.statusText);

      const responseData = await response.json().catch(() => ({}));
      console.log('[UserManagement] Response data:', responseData);

      if (!response.ok) {
        const errorMsg = responseData.error || responseData.message || "Failed to create Accomplishment Report assignment.";
        console.error('[UserManagement] Failed to create assignment:', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('[UserManagement] Accomplishment Report assignment created successfully:', responseData.report_assignment || responseData);
      return responseData.report_assignment || responseData;
    } catch (err) {
      console.error("[UserManagement] Error creating Accomplishment Report assignment:", err);
      throw err;
    }
  };

  const updateLaemplCoordinatorAssignment = async (options) => {
    const {
      gradeLevelId,
      coordinatorUserId
    } = options || {};

    console.log("[UserManagement] updateLaemplCoordinatorAssignment called with:", { gradeLevelId, coordinatorUserId });
    console.log("[UserManagement] Current laemplAssignments:", laemplAssignments);

    const assignment = gradeLevelId != null
      ? findLaemplAssignmentForGrade(gradeLevelId)
      : findLaemplAssignmentForCoordinator(coordinatorUserId);

    console.log("[UserManagement] Found assignment:", assignment);

    // If assignment exists, update it using PATCH
    if (assignment) {
      const payload = {
        grade_level_id: gradeLevelId != null ? Number(gradeLevelId) : null,
        coordinator_user_id: coordinatorUserId != null ? Number(coordinatorUserId) : null,
        advisory_user_id: null,
      };

      const response = await fetch(`${API_BASE}/reports/laempl-mps/assignments/${assignment.report_assignment_id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(responseData.error || responseData.message || "Failed to update LAEMPL & MPS assignment.");
      }

      await fetchLaemplAssignments();
      
      // Return the updated assignment from the response
      return responseData.assignment || assignment;
    } else {
      // No assignment exists, create it using the create-or-update endpoint
      console.log("[UserManagement] No assignment found! Creating new assignment.");
      
      if (!gradeLevelId || !coordinatorUserId || !activeYearQuarter) {
        console.warn("[UserManagement] Cannot create assignment: missing gradeLevelId, coordinatorUserId, or activeYearQuarter");
        return null;
      }

      const payload = {
        grade_level_id: Number(gradeLevelId),
        coordinator_user_id: Number(coordinatorUserId),
        quarter: Number(activeYearQuarter.quarter),
        year: Number(activeYearQuarter.year)
      };

      console.log("[UserManagement] Creating assignment with payload:", payload);

      const response = await fetch(`${API_BASE}/reports/laempl-mps/assignments/create-or-update`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(responseData.error || responseData.message || "Failed to create LAEMPL & MPS assignment.");
      }

      await fetchLaemplAssignments();
      
      // Return the created assignment from the response
      return responseData.assignment || null;
    }
  };

  const handleSchoolChange = (schoolName) => {
    setSelectedSchool(schoolName);
    setAssignmentDetails(prev => ({
      ...prev,
      section: '',
      gradeLevel: '',
      laemplGradeLevelId: prev.laemplGradeLevelId
    }));
    
    // Find the school and fetch its sections
    const school = schools.find(s => s.school_name === schoolName);
    if (school) {
      fetchSections(school.school_id);
    } else {
      setSections([]);
    }
  };

  const handleAssignUser = async () => {
    if (!selectedUser || !selectedSchool) return;
    
    const isLaemplCoordinatorSelection =
      selectedUser?.role === 'coordinator' &&
      String(assignmentDetails.category) === '1' &&
      String(assignmentDetails.subCategory) === '3';

    const isAccomplishmentCoordinatorSelection =
      selectedUser?.role === 'coordinator' &&
      String(assignmentDetails.category) === '0';
    
    console.log('[UserManagement] Assignment check:', {
      isLaemplCoordinatorSelection,
      isAccomplishmentCoordinatorSelection,
      userRole: selectedUser?.role,
      category: assignmentDetails.category,
      subCategory: assignmentDetails.subCategory
    });

    if (isLaemplCoordinatorSelection) {
      if (!assignmentDetails.laemplGradeLevelId) {
        toast.error('Select a grade level before assigning LAEMPL & MPS.');
        return;
      }

      // Check if this grade level is already assigned to a different coordinator
      const existingAssignment = findLaemplAssignmentForGrade(Number(assignmentDetails.laemplGradeLevelId));
      if (existingAssignment && existingAssignment.coordinator_user_id) {
        const existingCoordinatorId = Number(existingAssignment.coordinator_user_id);
        const currentCoordinatorId = Number(selectedUser.user_id);
        
        if (existingCoordinatorId !== currentCoordinatorId) {
          const existingCoordinatorName = existingAssignment.coordinator_name || 'another coordinator';
          const gradeLevelName = gradeLevels.find(g => g.grade_level_id === Number(assignmentDetails.laemplGradeLevelId))?.grade_level || assignmentDetails.laemplGradeLevelId;
          toast.error(`Grade ${gradeLevelName} is already assigned to ${existingCoordinatorName}. Cannot reassign to a different coordinator.`);
          return;
        }
      }
    }

    try {
      let laemplAssignment = null;
      let accomplishmentAssignment = null;
      
      if (isLaemplCoordinatorSelection) {
        laemplAssignment = await updateLaemplCoordinatorAssignment({
          gradeLevelId: Number(assignmentDetails.laemplGradeLevelId),
          coordinatorUserId: selectedUser.user_id
        });
        
        // Log the Coordinator Grade Level from report_assignment where sub_category_id=3
        // Use the grade level we just set, or fetch from the updated assignment
        let gradeLevelId = null;
        let gradeLevelSource = 'report_assignment (sub_category_id=3)';
        
        // First, use the grade level we just set
        if (assignmentDetails.laemplGradeLevelId) {
          gradeLevelId = Number(assignmentDetails.laemplGradeLevelId);
        } else if (laemplAssignment?.grade_level_id) {
          // Fallback: use the assignment returned
          gradeLevelId = laemplAssignment.grade_level_id;
        } else {
          // Fallback: fetch fresh to get the updated assignment
          await fetchLaemplAssignments();
          const updatedAssignment = findLaemplAssignmentForCoordinator(selectedUser.user_id);
          if (updatedAssignment?.grade_level_id) {
            gradeLevelId = updatedAssignment.grade_level_id;
          }
        }
        
        const gradeLevelName = gradeLevelId 
          ? (gradeLevels.find(g => g.grade_level_id === gradeLevelId)?.grade_level || gradeLevelId)
          : null;
        const gradeLevelDisplay = gradeLevelName ? `Grade ${gradeLevelName}` : 'Not assigned';
        console.log(`[UserManagement] Coordinator "${selectedUser.name}" (ID: ${selectedUser.user_id}) assigned/reassigned. Coordinator Grade Level (${gradeLevelSource}): ${gradeLevelDisplay} (grade_level_id: ${gradeLevelId || 'null'})`);
      } else if (isAccomplishmentCoordinatorSelection) {
        // Create Accomplishment Report assignment with coordinator_user_id
        console.log('[UserManagement] Creating Accomplishment Report assignment for coordinator:', selectedUser.user_id);
        try {
          accomplishmentAssignment = await updateAccomplishmentCoordinatorAssignment({
            coordinatorUserId: selectedUser.user_id
          });
          console.log('[UserManagement] Accomplishment Report assignment created:', accomplishmentAssignment);
        } catch (err) {
          console.error('[UserManagement] Failed to create Accomplishment Report assignment:', err);
          toast.error('Failed to create Accomplishment Report assignment: ' + err.message);
          return; // Don't proceed with user assignment if assignment creation fails
        }
      }

      const response = await fetch(`${API_BASE}/admin/assign-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: selectedUser.user_id,
          school_name: selectedSchool,
          section: assignmentDetails.section,
          grade_level: assignmentDetails.gradeLevel,
          // For LAEMPL & MPS coordinators, use the coordinator grade level for conflict checking
          coordinator_grade_level: isLaemplCoordinatorSelection ? assignmentDetails.laemplGradeLevelId : undefined,
          category: assignmentDetails.category,
          sub_category: assignmentDetails.subCategory
        }),
        credentials: "include"
      });

      if (!response.ok) {
        // Rollback assignment creation if user assignment fails
        if (isLaemplCoordinatorSelection && laemplAssignment) {
          await updateLaemplCoordinatorAssignment({
            gradeLevelId: laemplAssignment.grade_level_id,
            coordinatorUserId: laemplAssignment.coordinator_user_id
          });
        }
        // Note: Accomplishment Report assignment rollback would need to be implemented if needed
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Update the user in the local state
      setUsers(users.map(user => 
        user.user_id === selectedUser.user_id 
          ? { ...user, school_name: selectedSchool }
          : user
      ));

      toast.success(result.message || "User assigned successfully!");
      setShowAssignmentModal(false);
      setSelectedUser(null);
      setSelectedSchool('');
      setAssignmentDetails({
        section: '',
        gradeLevel: '',
        category: '',
        subCategory: '',
        laemplGradeLevelId: ''
      });
    } catch (err) {
      console.error("Error assigning user:", err);
      toast.error(err.message || "Failed to assign user to school");
    }
  };

  const handleUnassignUser = async () => {
    if (!selectedUser) return;
    
    try {
      const response = await fetch(`${API_BASE}/admin/unassign-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: selectedUser.user_id
        }),
        credentials: "include"
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (selectedUser.role === 'coordinator') {
        const existingAssignment = findLaemplAssignmentForCoordinator(selectedUser.user_id);
        if (existingAssignment && existingAssignment.grade_level_id != null) {
          // Log before clearing
          const gradeLevelIdBefore = existingAssignment.grade_level_id;
          const gradeLevelNameBefore = gradeLevelIdBefore 
            ? (gradeLevels.find(g => g.grade_level_id === gradeLevelIdBefore)?.grade_level || gradeLevelIdBefore)
            : null;
          const gradeLevelDisplayBefore = gradeLevelNameBefore ? `Grade ${gradeLevelNameBefore}` : 'Not assigned';
          console.log(`[UserManagement] Coordinator "${selectedUser.name}" (ID: ${selectedUser.user_id}) unassigned. Previous Coordinator Grade Level (from report_assignment where sub_category_id=3): ${gradeLevelDisplayBefore} (grade_level_id: ${gradeLevelIdBefore || 'null'})`);
          
          const clearedAssignment = await updateLaemplCoordinatorAssignment({
            gradeLevelId: null,
            coordinatorUserId: selectedUser.user_id
          });
          
          // Log after clearing - check coordinator_grade as fallback
          let gradeLevelIdAfter = clearedAssignment?.grade_level_id;
          let gradeLevelSourceAfter = 'report_assignment (sub_category_id=3)';
          
          if (!gradeLevelIdAfter) {
            // Fallback to coordinator_grade table
            try {
              const cgRes = await fetch(`${API_BASE}/users/coordinator-grade/${selectedUser.user_id}`, { credentials: "include" });
              if (cgRes.ok) {
                const cgData = await cgRes.json();
                if (cgData?.grade_level_id) {
                  gradeLevelIdAfter = cgData.grade_level_id;
                  gradeLevelSourceAfter = 'coordinator_grade (fallback)';
                }
              } else if (cgRes.status === 404) {
                // Coordinator doesn't have a grade in coordinator_grade table - this is fine
                gradeLevelSourceAfter = 'coordinator_grade (not found)';
              }
            } catch (err) {
              console.error("[UserManagement] Failed to fetch coordinator grade:", err);
            }
          }
          
          const gradeLevelNameAfter = gradeLevelIdAfter 
            ? (gradeLevels.find(g => g.grade_level_id === gradeLevelIdAfter)?.grade_level || gradeLevelIdAfter)
            : null;
          const gradeLevelDisplayAfter = gradeLevelNameAfter ? `Grade ${gradeLevelNameAfter}` : 'Not assigned';
          console.log(`[UserManagement] Coordinator "${selectedUser.name}" (ID: ${selectedUser.user_id}) unassigned. Current Coordinator Grade Level (${gradeLevelSourceAfter}): ${gradeLevelDisplayAfter} (grade_level_id: ${gradeLevelIdAfter || 'null'})`);
        }
      }

      // Update the user in the local state
      setUsers(users.map(user => 
        user.user_id === selectedUser.user_id 
          ? { ...user, school_name: null }
          : user
      ));

      toast.success(result.message || "User unassigned successfully!");
      setShowAssignmentModal(false);
      setSelectedUser(null);
      setSelectedSchool('');
      setAssignmentDetails({
        section: '',
        gradeLevel: '',
        category: '',
        subCategory: '',
        laemplGradeLevelId: ''
      });
    } catch (err) {
      console.error("Error unassigning user:", err);
      toast.error(err.message || "Failed to unassign user from school");
    }
  };

  const handleSchoolAdded = (newSchool) => {
    console.log("New school added:", newSchool);
    // You can add logic here to refresh school data or update UI
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
        });
        if (!res.ok) return; // not logged in
        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }
    };

    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/users`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
          // After users are loaded, fetch Accomplishment Report coordinators
          // (we need users data to get coordinator names)
          // We'll call it in a separate useEffect that depends on users
        }
      } catch (err) {
        console.error("Failed to fetch users:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
    fetchUsers();
  }, []);


  const selectedLaemplGradeAssignment = assignmentDetails.laemplGradeLevelId
    ? laemplAssignments.find(
        (assignment) => Number(assignment.grade_level_id) === Number(assignmentDetails.laemplGradeLevelId)
      )
    : null;

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        <Sidebar activeLink="User Management" />
        <div className="dashboard-content">
          <Breadcrumb />
          <div className="dashboard-main">
            <h2>User Management</h2>
          </div>

            <div className="add-user-container">
              <button className="add-user-btn" type="button" onClick={() => setShowAddUserModal(true)}>
                <span className="add-user-text">Add User</span>
              </button>
              <button className="add-user-btn year-quarter-btn" type="button" onClick={() => setShowYearQuarterModal(true)}>
                <span className="add-user-text">Add School Year</span>
              </button>
            </div>

          <div className="content">
            {loading ? (
              <div>Loading...</div>
            ) : (
              <table className="report-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>School</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user, index) => (
                    <tr key={user.user_id}>
                      <td>{index + 1}</td>
                      <td className="file-cell">
                        <span className="file-name">{user.name}</span>
                      </td>
                      <td>
                        <span className="role-badge">{user.role}</span>
                      </td>
                      <td>
                        <span className="school-name">{user.school_name || 'Not Assigned'}</span>
                        {user.section_name && (
                          <div className="section-info">
                            <small>Section: {user.section_name}</small>
                            {user.grade_level && <small> | Grade: {user.grade_level}</small>}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${user.school_name ? 'assigned' : 'unassigned'}`}>
                          {user.school_name ? 'Assigned' : 'Unassigned'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="icon-btn edit-btn"
                            title="Assign/Unassign user"
                            onClick={() => handleEditUser(user)}
                          >
                            <img src={Edit} alt="Edit" />
                          </button>
                          <button
                            type="button"
                            className="icon-btn delete-btn"
                            onClick={() => {
                              setUserToDelete(user);
                              setConfirmOpen(true);
                            }}
                            title="Delete user"
                          >
                            <img src={Delete} alt="Delete" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* React-Modal confirmation */}
          <Modal
            isOpen={confirmOpen}
            onRequestClose={() => {
              setConfirmOpen(false);
              setUserToDelete(null);
            }}
            className="modal"
            overlayClassName="overlay"
            contentLabel="Confirm delete user"
          >
            <h2>Confirm Delete</h2>
            <p>Do you want to delete user "{userToDelete?.name}"? This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleDelete}>Yes</button>
              <button className="btn" onClick={() => {
                setConfirmOpen(false);
                setUserToDelete(null);
              }}>Cancel</button>
            </div>
          </Modal>

          {/* Edit user (your custom overlay) */}
          {openPopupAdd && (
            <div className="add-user-overlay add-school" onClick={() => setOpenPopupAdd(false)}>
              <div className="add-user-modal" onClick={(e) => e.stopPropagation()}>
                <div className="popup-header">
                  <h2>Add School</h2>
                  <button className="close-button" onClick={() => setOpenPopupAdd(false)} aria-label="Close">
                    ×
                  </button>
                </div>
                <hr />
                <form className="user-form">
                  <div className="form-row">
                        <label>School Name:</label>
                        <input type="text" placeholder="Full name" />
                    </div>
                    <button className="action-btn">
                        Add School
                    </button>
                </form>
              </div>
            </div>
          )}

          {/* Add user (your custom overlay) */}
          {openPopupAssign && (
            <div className="edit-user-overlay" onClick={() => setOpenPopupAssign(false)}>
              <div className="edit-user-modal" onClick={(e) => e.stopPropagation()}>
                <div className="popup-header">
                  <h2>Assign Teacher</h2>
                  <button className="close-button" onClick={() => setOpenPopupAssign(false)} aria-label="Close">
                    ×
                  </button>
                </div>
                <hr />
                <div className="content">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      <tr>
                        <td className="file-cell">
                          <span className="file-name">Airone Gamil</span>
                        </td>
                        <td>
                          <span className="status-txt">Unassigned</span>
                        </td>
                        <td>
                          <button className="btn-action">Assign</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Add School Modal */}
        <AddSchool
          isOpen={showAddSchool}
          onClose={() => setShowAddSchool(false)}
          onSchoolAdded={handleSchoolAdded}
        />

        {/* Add User Modal */}
        <Modal
          isOpen={showAddUserModal}
          onRequestClose={() => setShowAddUserModal(false)}
          className="add-user-modal"
          overlayClassName="add-user-overlay"
          contentLabel="Add User Modal"
        >
          <div className="modal-header">
            <h2>Add New User</h2>
            <button className="close-button" onClick={() => setShowAddUserModal(false)}>×</button>
          </div>
          
          <form onSubmit={handleAddUser} className="add-user-form">
            <div className="form-group">
              <label htmlFor="name">Full Name:</label>
              <input
                type="text"
                id="name"
                name="name"
                value={newUser.name}
                onChange={handleInputChange}
                placeholder="Enter full name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email:</label>
              <input
                type="email"
                id="email"
                name="email"
                value={newUser.email}
                onChange={handleInputChange}
                placeholder="Enter email address"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="role">Role:</label>
              <select
                id="role"
                name="role"
                value={newUser.role}
                onChange={handleInputChange}
                required
              >
                <option value="">Select a role...</option>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-cancel"
                onClick={() => setShowAddUserModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                Add User
              </button>
            </div>
          </form>
        </Modal>

        {/* Assignment Modal */}
        <Modal
          isOpen={showAssignmentModal}
          onRequestClose={() => setShowAssignmentModal(false)}
          className="assignment-modal"
          overlayClassName="assignment-overlay"
          contentLabel="User Assignment Modal"
        >
          <div className="modal-header">
            <h2>Assign User to School</h2>
            <button className="close-button" onClick={() => setShowAssignmentModal(false)}>×</button>
          </div>
          
          <div className="assignment-content">
            {selectedUser && (
              <div className="user-info">
                <h3>User: {selectedUser.name}</h3>
                <p>Role: {selectedUser.role}</p>
                <p>Current School: {selectedUser.school_name || 'Not Assigned'}</p>
              </div>
            )}

            <div className="school-selection">
              <label htmlFor="schoolSelect">Select School:</label>
              <select
                id="schoolSelect"
                value={selectedSchool}
                onChange={(e) => handleSchoolChange(e.target.value)}
                className="school-dropdown"
              >
                <option value="">Choose a school...</option>
                {schools.map((school) => (
                  <option key={school.school_id} value={school.school_name}>
                    {school.school_name}
                  </option>
                ))}
              </select>
            </div>

            {(selectedUser?.role === 'teacher' || selectedUser?.role === 'coordinator') && (
              <div className="assignment-details">
                <div className="form-group">
                  <label htmlFor="gradeLevel">Teacher Grade Level:</label>
                  <select
                    id="gradeLevel"
                    value={assignmentDetails.gradeLevel}
                    onChange={(e) => setAssignmentDetails(prev => ({...prev, gradeLevel: e.target.value, section: ''}))}
                    className="form-input"
                  >
                    <option value="">Select grade level...</option>
                    {gradeLevels.map(grade => (
                      <option key={grade.grade_level_id} value={grade.grade_level_id}>
                        Grade {grade.grade_level}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="sectionSelect">Section:</label>
                  <select
                    id="sectionSelect"
                    value={assignmentDetails.section}
                    onChange={(e) => setAssignmentDetails(prev => ({...prev, section: e.target.value}))}
                    className="form-input"
                    disabled={!selectedSchool || !assignmentDetails.gradeLevel}
                  >
                    <option value="">Select section...</option>
                    {sections
                      .filter(section => String(section.grade_level_id ?? section.grade_level) === String(assignmentDetails.gradeLevel))
                      .map(section => (
                        <option key={section.section_id} value={section.section}>
                          {section.section}
                        </option>
                      ))}
                  </select>
                </div>

                {selectedUser?.role === 'coordinator' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="categorySelect">Category:</label>
                      <select
                        id="categorySelect"
                        value={assignmentDetails.category}
                        onChange={(e) => {
                          setAssignmentDetails(prev => ({
                            ...prev,
                            category: e.target.value,
                            subCategory: '',
                            laemplGradeLevelId: ''
                          }));
                          if (e.target.value) {
                            fetchSubCategories(e.target.value);
                          } else {
                            setSubCategories([]);
                          }
                        }}
                        className="form-input"
                      >
                        <option value="">Select category...</option>
                        {categories.map(category => (
                          <option key={category.category_id} value={category.category_id}>
                            {category.category_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {String(assignmentDetails.category) === '1' && (
                      <div className="form-group">
                        <label htmlFor="subCategorySelect">Sub-Category:</label>
                        <select
                          id="subCategorySelect"
                          value={assignmentDetails.subCategory}
                          onChange={(e) => setAssignmentDetails(prev => ({
                            ...prev,
                            subCategory: e.target.value,
                            laemplGradeLevelId: ''
                          }))}
                          className="form-input"
                          disabled={!assignmentDetails.category}
                        >
                          <option value="">Select sub-category...</option>
                          {subCategories.map(subCategory => (
                            <option key={subCategory.sub_category_id} value={subCategory.sub_category_id}>
                              {subCategory.sub_category_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {String(assignmentDetails.category) === '1' && String(assignmentDetails.subCategory) === '3' && (
                      <>
                        <div className="form-group">
                          <label htmlFor="laemplGradeSelect">Coordinator Grade Level:</label>
                          <select
                            id="laemplGradeSelect"
                            value={assignmentDetails.laemplGradeLevelId}
                            onChange={(e) => setAssignmentDetails(prev => ({
                              ...prev,
                              laemplGradeLevelId: e.target.value
                            }))}
                            className="form-input"
                          >
                            <option value="">Select grade level...</option>
                            {gradeLevels.map((grade) => (
                              <option key={grade.grade_level_id} value={grade.grade_level_id}>
                                Grade {grade.grade_level}
                              </option>
                            ))}
                          </select>
                        </div>

                        {assignmentDetails.laemplGradeLevelId && selectedLaemplGradeAssignment && (
                          <div className="form-hint" style={{
                            color: selectedLaemplGradeAssignment.coordinator_user_id && 
                                   selectedLaemplGradeAssignment.coordinator_user_id !== selectedUser?.user_id
                                   ? '#dc3545' : '#6c757d'
                          }}>
                            {selectedLaemplGradeAssignment.coordinator_user_id
                              ? selectedLaemplGradeAssignment.coordinator_user_id === selectedUser?.user_id
                                ? `Currently assigned to ${selectedUser?.name || 'this coordinator'}.`
                                : `⚠️ Already assigned to ${selectedLaemplGradeAssignment.coordinator_name || 'another coordinator'}. Cannot reassign to a different coordinator.`
                              : 'This grade is not yet assigned to any coordinator.'}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-cancel"
                onClick={() => setShowAssignmentModal(false)}
              >
                Cancel
              </button>
              {selectedUser?.school_name && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleUnassignUser}
                >
                  Unassign from School
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAssignUser}
                disabled={!selectedSchool}
              >
                {selectedUser?.school_name ? 'Reassign to School' : 'Assign to School'}
              </button>
            </div>
          </div>
        </Modal>

        {/* Year & Quarter Management Modal */}
        <Modal
          isOpen={showYearQuarterModal}
          onRequestClose={() => setShowYearQuarterModal(false)}
          className="year-quarter-modal"
          overlayClassName="year-quarter-overlay"
          contentLabel="Year & Quarter Management Modal"
        >
          <div className="modal-header">
            <h2>Year & Quarter Management</h2>
            <button className="close-button" onClick={() => setShowYearQuarterModal(false)}>×</button>
          </div>
          
          <div className="year-quarter-content">
            {/* Add New School Year */}
            <div className="add-year-quarter-section">
              <h3>Add New School Year</h3>
              <form onSubmit={handleAddYearQuarter} className="year-quarter-form">
                <div className="form-group">
                  <label htmlFor="startYear">Year:</label>
                  <select
                    id="startYear"
                    name="startYear"
                    value={yearQuarter.startYear}
                    onChange={handleYearQuarterChange}
                    required
                    className="dropdown-select"
                  >
                    <option value="">Select year...</option>
                    {Array.from({ length: 15 }, (_, i) => 2020 + i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>


                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-cancel"
                    onClick={() => setShowYearQuarterModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    Add School Year
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
}

export default UserManagement;
