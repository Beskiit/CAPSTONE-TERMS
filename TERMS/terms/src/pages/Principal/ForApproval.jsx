import React from "react";
import Sidebar from "../../components/shared/SidebarPrincipal";
import "./ForApproval.css";
import "../Coordinator/AssignedReport.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header";
import Breadcrumb from "../../components/Breadcrumb";
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
    const [selectedSchoolYear, setSelectedSchoolYear] = useState('');
    const [selectedQuarter, setSelectedQuarter] = useState('');
    const [schoolYears, setSchoolYears] = useState([]);
    const [assignmentYearsAndQuarters, setAssignmentYearsAndQuarters] = useState([]);
    const [quarters, setQuarters] = useState([]);

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

  // Fetch all school years and quarters from admin API
  useEffect(() => {
    const fetchAllSchoolYearsAndQuarters = async () => {
      try {
        console.log('🔍 [DEBUG] Fetching all school years and quarters for ForApproval');
        
        // Fetch school years
        const schoolYearsRes = await fetch(`${API_BASE}/admin/school-years`, {
          credentials: "include"
        });
        
        if (schoolYearsRes.ok) {
          const schoolYearsData = await schoolYearsRes.json();
          console.log('🔍 [DEBUG] School years data:', schoolYearsData);
          
          // Fetch quarters for each school year
          const quartersRes = await fetch(`${API_BASE}/admin/quarters-comprehensive`, {
            credentials: "include"
          });
          
          if (quartersRes.ok) {
            const quartersData = await quartersRes.json();
            console.log('🔍 [DEBUG] Quarters data:', quartersData);
            
            // Combine school years with their quarters
            const combinedData = schoolYearsData.map(year => {
              const yearQuarters = quartersData.filter(q => q.year === year.year_id);
              return {
                ...year,
                quarters: yearQuarters.map(q => ({
                  quarter: q.quarter,
                  quarter_name: q.quarter_name,
                  quarter_short_name: q.quarter_short_name
                }))
              };
            });
            
            console.log('🔍 [DEBUG] Combined data:', combinedData);
            setAssignmentYearsAndQuarters(combinedData);
            setSchoolYears(schoolYearsData); // Keep separate for filtering
            
            // Set default to the first year if available
            if (combinedData.length > 0 && !selectedSchoolYear) {
              setSelectedSchoolYear(combinedData[0].school_year);
            }
          } else {
            console.error("Failed to fetch quarters");
            setAssignmentYearsAndQuarters(schoolYearsData);
            setSchoolYears(schoolYearsData);
          }
        } else {
          console.error("Failed to fetch school years");
          setAssignmentYearsAndQuarters([]);
          setSchoolYears([]);
        }
      } catch (err) {
        console.error("Failed to fetch school years and quarters:", err);
        setAssignmentYearsAndQuarters([]);
        setSchoolYears([]);
      }
    };
    fetchAllSchoolYearsAndQuarters();
  }, []);

  // Update quarters when school year changes
  useEffect(() => {
    if (selectedSchoolYear && assignmentYearsAndQuarters.length > 0) {
      const selectedYear = assignmentYearsAndQuarters.find(year => year.school_year === selectedSchoolYear);
      console.log('🔍 [DEBUG] Selected year for quarters:', selectedYear);
      if (selectedYear && selectedYear.quarters) {
        const quarterOptions = selectedYear.quarters.map(q => ({
          value: q.quarter,
          label: q.quarter_name
        }));
        console.log('🔍 [DEBUG] Quarter options:', quarterOptions);
        setQuarters(quarterOptions);
        
        // Reset quarter selection if current selection is not available in new year
        if (selectedQuarter && !selectedYear.quarters.some(q => q.quarter.toString() === selectedQuarter)) {
          setSelectedQuarter('');
        }
      } else {
        console.log('🔍 [DEBUG] No quarters found for selected year');
        setQuarters([]);
        setSelectedQuarter('');
      }
    } else {
      setQuarters([]);
      setSelectedQuarter('');
    }
  }, [selectedSchoolYear, assignmentYearsAndQuarters]);

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
      
      // Find the selected year object from the admin API data
      const selectedYearObj = schoolYears.find(year => year.school_year === selectedSchoolYear);
      
      let yearMatches = true;
      let quarterMatches = true;
      
      // Filter by school year if selected
      if (selectedSchoolYear && selectedYearObj) {
        yearMatches = assignmentYear === selectedYearObj.year_id;
      }
      
      // Filter by quarter if selected
      if (selectedQuarter) {
        quarterMatches = assignmentQuarter === parseInt(selectedQuarter);
      }
      
      return yearMatches && quarterMatches;
    });

    setFilteredSubmissions(filtered);
  }, [submissions, selectedSchoolYear, selectedQuarter]);
    return(
        <>
            <Header userText={user ? user.name : "Guest"} />
            <div className="dashboard-container">
                <Sidebar activeLink="For Approval" />
                <div className="dashboard-content">
                    <Breadcrumb />
                    <div className="dashboard-main">
                        
                        {/* School Year and Quarter Dropdowns */}
                        <div className="filter-dropdowns">
                            <div className="dropdown-group">
                                <label htmlFor="school-year-select">School Year:</label>
                                <select 
                                    id="school-year-select"
                                    value={selectedSchoolYear || ''} 
                                    onChange={(e) => setSelectedSchoolYear(e.target.value)}
                                    className="dropdown-select"
                                >
                                    <option value="">Select School Year</option>
                                    {assignmentYearsAndQuarters.map(year => (
                                        <option key={year.year_id} value={year.school_year}>
                                            {year.school_year}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="dropdown-group">
                                <label htmlFor="quarter-select">Quarter:</label>
                                <select
                                    id="quarter-select"
                                    value={selectedQuarter || ''}
                                    onChange={(e) => setSelectedQuarter(e.target.value)}
                                    className="dropdown-select"
                                >
                                    <option value="">All Quarters</option>
                                    {quarters.map(quarter => (
                                        <option key={quarter.value} value={quarter.value}>
                                            {quarter.label}
                                        </option>
                                    ))}
                                </select>
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
                                        <tr key={submission.submission_id} onClick={() => navigate(`/ForApprovalData?id=${submission.submission_id}`, { state: { breadcrumbTitle: (submission.title || submission.assignment_title) } })}>
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