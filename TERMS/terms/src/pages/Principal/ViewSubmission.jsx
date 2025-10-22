import React, {useState, useEffect} from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/shared/SidebarPrincipal.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import Header from "../../components/shared/Header.jsx";
import "../Coordinator/AssignedReport.css";
import QuarterEnumService from "../../services/quarterEnumService";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function ViewSubmission() {
    const navigate = useNavigate();

  // ✅ define user state BEFORE you use it
  const [user, setUser] = useState(null);
  const [approvedSubmissions, setApprovedSubmissions] = useState([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dropdown states
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('');
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [schoolYears, setSchoolYears] = useState([]);
  const [quarters, setQuarters] = useState([]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
        });
        if (res.status === 401) {
          navigate("/"); // not logged in
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }
    };
    fetchUser();
  }, [navigate]);

  // Fetch school years and quarters
  useEffect(() => {
    const fetchSchoolYearsAndQuarters = async () => {
      try {
        // Fetch school years
        const schoolYearsRes = await fetch(`${API_BASE}/admin/school-years`, {
          credentials: "include",
        });
        if (schoolYearsRes.ok) {
          const schoolYearsData = await schoolYearsRes.json();
          setSchoolYears(schoolYearsData);
        }

          // Fetch quarters
          // Use quarter enum service for clean quarter data
          const formattedQuarters = await QuarterEnumService.getFormattedQuarters();
          // console.log('📊 Formatted quarters:', formattedQuarters);
          setQuarters(formattedQuarters);
      } catch (err) {
        console.error("Failed to fetch school years and quarters:", err);
      }
    };

    fetchSchoolYearsAndQuarters();
  }, []);

  // Fetch approved submissions
  useEffect(() => {
    const fetchApprovedSubmissions = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/submissions/approved-by-principal`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error('Failed to fetch approved submissions');
        }
        const data = await res.json();
        // console.log('📊 Approved submissions API response:', data);
        setApprovedSubmissions(data);
      } catch (err) {
        console.error("Failed to fetch approved submissions:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchApprovedSubmissions();
    }
  }, [user]);

  // Filter submissions based on selected year and quarter
  useEffect(() => {
    if (!approvedSubmissions.length) {
      setFilteredSubmissions([]);
      return;
    }

    let filtered = approvedSubmissions;

    if (selectedSchoolYear && selectedQuarter) {
      filtered = approvedSubmissions.filter(submission => {
        const reportYear = submission.school_year;
        const reportQuarter = submission.quarter_name;
        
        // Find the selected school year object
        const selectedYearObj = schoolYears.find(year => year.year_id.toString() === selectedSchoolYear);
        const selectedQuarterObj = quarters.find(quarter => quarter.value.toString() === selectedQuarter);
        
        return reportYear === selectedYearObj?.school_year && 
               reportQuarter === selectedQuarterObj?.label;
      });
    }

    setFilteredSubmissions(filtered);
  }, [approvedSubmissions, selectedSchoolYear, selectedQuarter, schoolYears, quarters]);

  const role = (user?.role || "").toLowerCase();
  const isPrincipal = role === "principal";

  const handleSubmissionClick = (submissionId) => {
    navigate(`/ViewSubmissionData?id=${submissionId}`);
  };

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        {isPrincipal ? (
          <Sidebar activeLink="View Report" />
        ) : (
          <SidebarCoordinator activeLink="View Report" />
        )}
        <div className="dashboard-content">
          <div className="dashboard-main">
            <h2>Approved Reports</h2>
            
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
                  <option value="">All School Years</option>
                  {schoolYears.map(year => (
                    <option key={year.year_id} value={year.year_id}>
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
            {loading && <div className="loading">Loading approved submissions...</div>}
            {error && <div className="error">Error: {error}</div>}
            {!loading && !error && (
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Report Title</th>
                    <th>Submitted By</th>
                    <th>Date Approved</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>
                        No approved submissions found for the selected year and quarter.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((submission) => (
                      <tr key={submission.submission_id} onClick={() => handleSubmissionClick(submission.submission_id)}>
                        <td className="file-cell">
                          <span className="file-name">{submission.title || submission.assignment_title}</span>
                        </td>
                        <td>{submission.submitted_by_name || 'Unknown'}</td>
                        <td>{submission.date_submitted}</td>
                        <td>
                          <span className="status-badge status-approved">Approved</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default ViewSubmission;