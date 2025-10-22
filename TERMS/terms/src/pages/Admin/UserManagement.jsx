import React, { useState, useEffect } from "react";
import Sidebar from "../../components/shared/SidebarAdmin";
import "./UserManagement.css";
import { useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header";
import Edit from "../../assets/edit.svg";
import Delete from "../../assets/delete.svg";
import Modal from "react-modal";
import AddSchool from "./AddSchool";
import QuarterEnumService from "../../services/quarterEnumService";
import QuarterSelector from "../../components/QuarterSelector";
import YearQuarterSelector from "../../components/YearQuarterSelector";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:5000").replace(/\/$/, "");

function UserManagement() {
  const navigate = useNavigate();
  const [openPopupAdd, setOpenPopupAdd] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
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
    gradeLevel: ''
  });
  const [showYearQuarterModal, setShowYearQuarterModal] = useState(false);
  const [yearQuarter, setYearQuarter] = useState({
    startYear: '',
    endYear: ''
  });
  const [activeYearQuarter, setActiveYearQuarter] = useState(null);
  const [allYearQuarters, setAllYearQuarters] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedQuarter, setSelectedQuarter] = useState('');

  useEffect(() => {
    // ensure the element id matches your index.html (#root is default in Vite)
    Modal.setAppElement("#root");
    fetchSchools();
    fetchRoles();
    fetchActiveYearQuarter();
    fetchAllYearQuarters();
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
    if (!yearQuarter.startYear || !yearQuarter.endYear) {
      alert("Please fill in all fields");
      return;
    }

    // Validate that end year is greater than start year
    if (parseInt(yearQuarter.endYear) <= parseInt(yearQuarter.startYear)) {
      alert("End year must be greater than start year");
      return;
    }

    try {
      // Create the year string in format "2024-2025"
      const yearString = `${yearQuarter.startYear}-${yearQuarter.endYear}`;
      
      const response = await fetch(`${API_BASE}/admin/school-year`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startYear: yearQuarter.startYear,
          endYear: yearQuarter.endYear
        }),
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const addedSchoolYear = await response.json();
      setShowYearQuarterModal(false);
      setYearQuarter({ startYear: '', endYear: '' });
      fetchActiveYearQuarter(); // Refresh the active year quarter
      fetchAllYearQuarters(); // Refresh the list of year quarters
      alert("School Year added successfully! All 4 quarters have been created automatically.");
    } catch (err) {
      console.error("Error adding school year:", err);
      alert("Failed to add school year");
    }
  };


  const handleDelete = () => {
    // TODO: call your API to delete the user here
    console.log("User deleted!");
    setConfirmOpen(false);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setSelectedSchool(user.school_name || '');
    setAssignmentDetails({ section: '', gradeLevel: '' });
    setShowAssignmentModal(true);
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

  const handleAssignUser = async () => {
    if (!selectedUser || !selectedSchool) return;
    
    try {
      const response = await fetch(`${API_BASE}/admin/assign-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: selectedUser.user_id,
          school_name: selectedSchool,
          section: assignmentDetails.section,
          grade_level: assignmentDetails.gradeLevel
        }),
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Update the user in the local state
      setUsers(users.map(user => 
        user.user_id === selectedUser.user_id 
          ? { ...user, school_name: selectedSchool }
          : user
      ));

      setShowAssignmentModal(false);
      setSelectedUser(null);
      setSelectedSchool('');
    } catch (err) {
      console.error("Error assigning user:", err);
      alert("Failed to assign user to school");
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Update the user in the local state
      setUsers(users.map(user => 
        user.user_id === selectedUser.user_id 
          ? { ...user, school_name: null }
          : user
      ));

      setShowAssignmentModal(false);
      setSelectedUser(null);
      setSelectedSchool('');
    } catch (err) {
      console.error("Error unassigning user:", err);
      alert("Failed to unassign user from school");
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

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        <Sidebar activeLink="User Management" />
        <div className="dashboard-content">
          <div className="dashboard-main">
            <h2>User Management</h2>
          </div>

            <div className="add-user-container">
              <button className="add-user-btn" type="button" onClick={() => setShowAddUserModal(true)}>
                <span className="add-user-text">Add User</span>
              </button>
              <button className="add-user-btn year-quarter-btn" type="button" onClick={() => setShowYearQuarterModal(true)}>
                <span className="add-user-text">Year & Quarter</span>
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
                            onClick={() => setConfirmOpen(true)}
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
            onRequestClose={() => setConfirmOpen(false)}
            className="modal"
            overlayClassName="overlay"
            contentLabel="Confirm delete user"
          >
            <h2>Confirm Delete</h2>
            <p>Do you want to delete this user?</p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleDelete}>Yes</button>
              <button className="btn" onClick={() => setConfirmOpen(false)}>Cancel</button>
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
                onChange={(e) => setSelectedSchool(e.target.value)}
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
                  <label htmlFor="sectionSelect">Section:</label>
                  <select
                    id="sectionSelect"
                    value={assignmentDetails.section}
                    onChange={(e) => setAssignmentDetails(prev => ({...prev, section: e.target.value}))}
                    className="form-input"
                  >
                    <option value="">Select section...</option>
                    <option value="Masipag">Masipag</option>
                    <option value="Matulungin">Matulungin</option>
                    <option value="Masunurin">Masunurin</option>
                    <option value="Magalang">Magalang</option>
                    <option value="Matapat">Matapat</option>
                    <option value="Matiyaga">Matiyaga</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="gradeLevel">Grade Level:</label>
                  <select
                    id="gradeLevel"
                    value={assignmentDetails.gradeLevel}
                    onChange={(e) => setAssignmentDetails(prev => ({...prev, gradeLevel: e.target.value}))}
                    className="form-input"
                  >
                    <option value="">Select grade level...</option>
                    <option value="1">Grade 1</option>
                    <option value="2">Grade 2</option>
                    <option value="3">Grade 3</option>
                    <option value="4">Grade 4</option>
                    <option value="5">Grade 5</option>
                    <option value="6">Grade 6</option>
                  </select>
                </div>
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
            {/* Current Active Year & Quarter */}
            {activeYearQuarter && (
              <div className="active-year-quarter">
                <h3>Current Active:</h3>
                <div className="active-info">
                  <span className="active-year">
                    {activeYearQuarter.school_year || 'Unknown School Year'}
                  </span>
                  <span className="active-quarter">
                    {activeYearQuarter.quarter_name || 
                     activeYearQuarter.quarter_short_name || 
                     `Q${activeYearQuarter.quarter}`}
                  </span>
                </div>
              </div>
            )}

            {/* Select Active Year & Quarter */}
            {allYearQuarters.length > 0 && (
              <div className="select-active-section">
                <h3>Select Active Year & Quarter</h3>
                <div className="year-quarter-assignment">
                  <div className="assignment-controls">
                    <div className="form-group">
                      <label htmlFor="assignYear">Year:</label>
                      <select
                        id="assignYear"
                        value={selectedYear || ''}
                        onChange={(e) => {
                          setSelectedYear(e.target.value);
                          setSelectedQuarter(''); // Reset quarter when year changes
                        }}
                        className="dropdown-select"
                      >
                        <option value="">Select year...</option>
                        {allYearQuarters.map((year) => (
                          <option key={year.year_id} value={year.school_year}>
                            {year.school_year}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="assignQuarter">Quarter:</label>
                      <QuarterSelector
                        id="assignQuarter"
                        selectedQuarter={selectedQuarter ? parseInt(selectedQuarter) : null}
                        onQuarterChange={(quarter) => setSelectedQuarter(quarter.toString())}
                        disabled={!selectedYear}
                        placeholder="Select quarter..."
                      />
                    </div>
                    
                    <div className="form-group">
                      <button
                        type="button"
                        onClick={handleSetActiveYearQuarter}
                        disabled={!selectedYear || !selectedQuarter}
                        className="mark-button"
                      >
                        Mark as Active
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}


            {/* Add New School Year */}
            <div className="add-year-quarter-section">
              <h3>Add New School Year</h3>
              <form onSubmit={handleAddYearQuarter} className="year-quarter-form">
                <div className="form-group">
                  <label htmlFor="startYear">Start Year:</label>
                  <select
                    id="startYear"
                    name="startYear"
                    value={yearQuarter.startYear}
                    onChange={handleYearQuarterChange}
                    required
                    className="dropdown-select"
                  >
                    <option value="">Select start year...</option>
                    {Array.from({ length: 15 }, (_, i) => 2020 + i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="endYear">End Year:</label>
                  <select
                    id="endYear"
                    name="endYear"
                    value={yearQuarter.endYear}
                    onChange={handleYearQuarterChange}
                    required
                    className="dropdown-select"
                  >
                    <option value="">Select end year...</option>
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
