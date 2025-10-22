import React from "react";
import Sidebar from "../../components/shared/SidebarPrincipal";
import "./ForApproval.css";
import "../Coordinator/AssignedReport.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header";
import QuarterEnumService from "../../services/quarterEnumService";
import QuarterSelector from "../../components/QuarterSelector";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function ForApproval() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [filteredSubmissions, setFilteredSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    
    // Dropdown states
    const [selectedSchoolYear, setSelectedSchoolYear] = useState(2025);
    const [selectedQuarter, setSelectedQuarter] = useState(1);
    const [schoolYears, setSchoolYears] = useState([{ value: 2025, label: '2025-2026' }]);
    const [quarters, setQuarters] = useState([
        { value: 1, label: '1st Quarter' },
        { value: 2, label: '2nd Quarter' },
        { value: 3, label: '3rd Quarter' },
        { value: 4, label: '4th Quarter' }
    ]);

    useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include", // important so session cookie is sent
        });
        if (!res.ok) return; // not logged in
        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }
    };
    fetchUser();
  }, []);

  // Fetch school years
  useEffect(() => {
    const fetchSchoolYears = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/school-years`, {
          credentials: "include"
        });
        if (res.ok) {
          const data = await res.json();
          // Format years properly
          const formattedYears = data.map(year => ({
            value: year.year_id,
            label: year.school_year
          }));
          setSchoolYears(formattedYears);
          
          // Set default to the first year if available
          if (formattedYears.length > 0 && !selectedSchoolYear) {
            setSelectedSchoolYear(formattedYears[0].value);
          }
        } else {
          // If API fails, set default school year
          setSchoolYears([{ value: 1, label: '2025-2026' }]);
          if (!selectedSchoolYear) {
            setSelectedSchoolYear(1);
          }
        }
      } catch (err) {
        console.error("Failed to fetch school years:", err);
        // Set a default school year if API fails
        setSchoolYears([{ value: 1, label: '2025-2026' }]);
        if (!selectedSchoolYear) {
          setSelectedSchoolYear(1);
        }
      }
    };
    fetchSchoolYears();
  }, []);

  // Set quarters using quarter enum service when year changes
  useEffect(() => {
    if (selectedSchoolYear) {
      const fetchQuarters = async () => {
        try {
          const formattedQuarters = await QuarterEnumService.getFormattedQuarters();
          setQuarters(formattedQuarters);
          
          // Set default to the first quarter if not already selected
          if (!selectedQuarter) {
            setSelectedQuarter(1);
          }
        } catch (error) {
          console.error('Error fetching quarters:', error);
          // Fallback to static quarters
          const staticQuarters = [
            { value: 1, label: 'Quarter 1', quarter: 1 },
            { value: 2, label: 'Quarter 2', quarter: 2 },
            { value: 3, label: 'Quarter 3', quarter: 3 },
            { value: 4, label: 'Quarter 4', quarter: 4 }
          ];
          setQuarters(staticQuarters);
          
          if (!selectedQuarter) {
            setSelectedQuarter(1);
          }
        }
      };
      
      fetchQuarters();
    }
  }, [selectedSchoolYear]);

  // Fetch submissions for principal approval
  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/submissions/for-principal-approval`, {
          credentials: "include"
        });
        
        if (!res.ok) {
          throw new Error('Failed to fetch submissions');
        }
        
        const data = await res.json();
        setSubmissions(data);
      } catch (err) {
        console.error("Error fetching submissions:", err);
        setError("Failed to load submissions");
      } finally {
        setLoading(false);
      }
    };

    if (user?.role?.toLowerCase() === 'principal') {
      fetchSubmissions();
    }
  }, [user]);

  // Filter submissions based on selected year and quarter
  useEffect(() => {
    if (!submissions.length) {
      setFilteredSubmissions([]);
      return;
    }

    const filtered = submissions.filter(submission => {
      // Get the assignment info from the submission
      const assignmentYear = submission.assignment_year || submission.year;
      const assignmentQuarter = submission.assignment_quarter || submission.quarter;
      
      // Handle both year_id format (1) and actual year format (2025)
      const selectedYear = parseInt(selectedSchoolYear);
      const selectedQtr = parseInt(selectedQuarter);
      
      // If assignment year is 1, it means it's using year_id format
      // If assignment year is 2025, it means it's using actual year format
      const yearMatches = (assignmentYear === selectedYear) || 
                        (assignmentYear === 1 && selectedYear === 2025);
      
      return yearMatches && assignmentQuarter === selectedQtr;
    });

    setFilteredSubmissions(filtered);
  }, [submissions, selectedSchoolYear, selectedQuarter]);
    return(
        <>
            <Header userText={user ? user.name : "Guest"} />
            <div className="dashboard-container">
                <Sidebar activeLink="For Approval" />
                <div className="dashboard-content">
                    <div className="dashboard-main">
                        <h2>For Approval</h2>
                        
                        {/* School Year and Quarter Dropdowns */}
                        <div className="filter-dropdowns">
                            <div className="dropdown-group">
                                <label htmlFor="school-year-select">School Year:</label>
                                <select 
                                    id="school-year-select"
                                    value={selectedSchoolYear || ''} 
                                    onChange={(e) => setSelectedSchoolYear(parseInt(e.target.value) || 2025)}
                                    className="dropdown-select"
                                >
                                    <option value="">Select School Year</option>
                                    {schoolYears.map(year => (
                                        <option key={year.value} value={year.value}>
                                            {year.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="dropdown-group">
                                <label htmlFor="quarter-select">Quarter:</label>
                                <QuarterSelector
                                    id="quarter-select"
                                    selectedQuarter={selectedQuarter}
                                    onQuarterChange={setSelectedQuarter}
                                    placeholder="Select Quarter"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="content">
                        {loading ? (
                            <div className="loading-container">
                                <div className="loading-spinner"></div>
                                <p>Loading submissions...</p>
                            </div>
                        ) : error ? (
                            <div className="error-message">
                                <p>{error}</p>
                                <button onClick={() => window.location.reload()}>Retry</button>
                            </div>
                        ) : filteredSubmissions.length === 0 ? (
                            <div className="no-submissions">
                                <p>No submissions pending approval for the selected year and quarter.</p>
                            </div>
                        ) : (
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>Report Title</th>
                                        <th>Submitted By</th>
                                        <th>Due Date</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSubmissions.map((submission) => (
                                        <tr key={submission.submission_id} onClick={() => navigate(`/ForApprovalData?id=${submission.submission_id}`)}>
                                            <td className="file-cell">
                                                <span className="file-name">{submission.title || submission.assignment_title || 'Report'}</span>
                                            </td>
                                            <td>{submission.submitted_by_name || 'Unknown'}</td>
                                            <td>{submission.due_date || 'No due date'}</td>
                                            <td>
                                                <span className="status-badge status-completed">
                                                    Completed
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div> 
        </>
    )
}

export default ForApproval;