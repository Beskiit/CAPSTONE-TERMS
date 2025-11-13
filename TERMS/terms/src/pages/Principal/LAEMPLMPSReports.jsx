import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import SidebarPrincipal from "../../components/shared/SidebarPrincipal.jsx";
import Header from "../../components/shared/Header.jsx";
import Breadcrumb from "../../components/Breadcrumb.jsx";
import "../Coordinator/AssignedReport.css";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function LAEMPLMPSReports() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
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
          credentials: "include",
        });
        if (res.status === 401) {
          navigate("/");
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

  // Fetch all school years and quarters
  useEffect(() => {
    const fetchAllSchoolYearsAndQuarters = async () => {
      try {
        const schoolYearsRes = await fetch(`${API_BASE}/admin/school-years`, {
          credentials: "include"
        });
        
        if (schoolYearsRes.ok) {
          const schoolYearsData = await schoolYearsRes.json();
          
          const quartersRes = await fetch(`${API_BASE}/admin/quarters-comprehensive`, {
            credentials: "include"
          });
          
          if (quartersRes.ok) {
            const quartersData = await quartersRes.json();
            
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
            
            setAssignmentYearsAndQuarters(combinedData);
            setSchoolYears(schoolYearsData);
            
            if (combinedData.length > 0 && !selectedSchoolYear) {
              setSelectedSchoolYear(combinedData[0].school_year);
            }
          } else {
            setAssignmentYearsAndQuarters(schoolYearsData);
            setSchoolYears(schoolYearsData);
          }
        } else {
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
      if (selectedYear && selectedYear.quarters) {
        const quarterOptions = selectedYear.quarters.map(q => ({
          value: q.quarter,
          label: q.quarter_name
        }));
        setQuarters(quarterOptions);
        
        if (selectedQuarter && !selectedYear.quarters.some(q => q.quarter.toString() === selectedQuarter)) {
          setSelectedQuarter('');
        }
      } else {
        setQuarters([]);
        setSelectedQuarter('');
      }
    } else {
      setQuarters([]);
      setSelectedQuarter('');
    }
  }, [selectedSchoolYear, assignmentYearsAndQuarters]);

  // Memoize the selected year ID to prevent unnecessary re-fetches
  const selectedYearId = useMemo(() => {
    if (!selectedSchoolYear || !assignmentYearsAndQuarters.length) return null;
    const selectedYearObj = assignmentYearsAndQuarters.find(year => year.school_year === selectedSchoolYear);
    return selectedYearObj?.year_id || null;
  }, [selectedSchoolYear, assignmentYearsAndQuarters]);

  // Fetch coordinator LAEMPL & MPS submissions
  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!selectedYearId || !selectedQuarter || !user) {
        setSubmissions([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const res = await fetch(
          `${API_BASE}/reports/laempl-mps/coordinator-submissions?year=${selectedYearId}&quarter=${selectedQuarter}`,
          { credentials: "include" }
        );
        
        if (!res.ok) {
          throw new Error('Failed to fetch coordinator submissions');
        }
        
        const data = await res.json();
        setSubmissions(data);
      } catch (err) {
        console.error("Failed to fetch coordinator submissions:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [user, selectedYearId, selectedQuarter]);

  // Group submissions by coordinator AND grade level
  // Each coordinator-grade combination should show as a single row
  const groupedByCoordinatorAndGrade = useMemo(() => {
    const grouped = {};
    submissions.forEach(submission => {
      // Use coordinator_user_id from the assignment, or submitted_by as fallback
      const coordinatorId = submission.coordinator_user_id || submission.submitted_by;
      const coordinatorName = submission.coordinator_name || 'Unknown Coordinator';
      const gradeLevel = submission.grade_level || 'Unknown';
      
      // Create a unique key combining coordinator ID and grade level
      const groupKey = `${coordinatorId}_${gradeLevel}`;
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          coordinator_id: coordinatorId,
          coordinator_name: coordinatorName,
          grade_level: gradeLevel,
          submissions: [],
          category_name: submission.category_name,
          sub_category_name: submission.sub_category_name,
          school_year: submission.school_year,
          quarter: submission.quarter
        };
      }
      // Only add submissions that match this coordinator AND grade level
      if (submission.grade_level === gradeLevel) {
        grouped[groupKey].submissions.push(submission);
      }
    });
    return grouped;
  }, [submissions]);

  const handleCoordinatorClick = (coordinatorGroup) => {
    // Navigate to a new view showing submissions from this coordinator for this specific grade level
    navigate(`/ViewCoordinatorSubmissions`, {
      state: {
        coordinatorId: coordinatorGroup.coordinator_id,
        coordinatorName: coordinatorGroup.coordinator_name,
        gradeLevel: coordinatorGroup.grade_level,
        submissions: coordinatorGroup.submissions,
        schoolYear: selectedSchoolYear,
        quarter: selectedQuarter
      }
    });
  };

  // Group by grade level for display
  const groupedByGrade = useMemo(() => {
    const grouped = {};
    Object.values(groupedByCoordinatorAndGrade).forEach(coordinatorGroup => {
      const grade = coordinatorGroup.grade_level || 'Unknown';
      if (!grouped[grade]) {
        grouped[grade] = [];
      }
      grouped[grade].push(coordinatorGroup);
    });
    return grouped;
  }, [groupedByCoordinatorAndGrade]);

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        <SidebarPrincipal activeLink="LAEMPL & MPS" />
        <div className="dashboard-content">
          <Breadcrumb />
          <div className="dashboard-main">
            <h2>LAEMPL & MPS Reports</h2>
            
            {/* School Year and Quarter Dropdowns */}
            <div className="filter-dropdowns" style={{ marginBottom: '20px' }}>
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
                  <option value="">Select Quarter</option>
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
            {loading && <div className="loading">Loading coordinator submissions...</div>}
            {error && <div className="error">Error: {error}</div>}
            
            {!loading && !error && selectedSchoolYear && selectedQuarter && (
              <>
                {submissions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>No coordinator LAEMPL & MPS submissions found for the selected year and quarter.</p>
                  </div>
                ) : (
                  <div>
                    {Object.keys(groupedByGrade).sort((a, b) => {
                      const gradeA = parseInt(a) || 0;
                      const gradeB = parseInt(b) || 0;
                      return gradeA - gradeB;
                    }).map(grade => (
                      <div key={grade} style={{ marginBottom: '30px' }}>
                        <table className="report-table">
                          <thead>
                            <tr>
                              <th>Category</th>
                              <th>Sub-Category</th>
                              <th>School Year</th>
                              <th>Quarter</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupedByGrade[grade].map((coordinatorGroup) => {
                              // Get quarter name from quarters array
                              const quarterObj = quarters.find(q => q.value.toString() === coordinatorGroup.quarter?.toString());
                              const quarterName = quarterObj?.label || `Quarter ${coordinatorGroup.quarter || 'N/A'}`;
                              
                              return (
                                <tr 
                                  key={coordinatorGroup.coordinator_id} 
                                  onClick={() => handleCoordinatorClick(coordinatorGroup)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <td className="file-cell">
                                    <span className="file-name">{coordinatorGroup.category_name || 'N/A'}</span>
                                  </td>
                                  <td>{coordinatorGroup.sub_category_name || 'N/A'}</td>
                                  <td>{coordinatorGroup.school_year || 'N/A'}</td>
                                  <td>{quarterName}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            
            {!loading && !error && (!selectedSchoolYear || !selectedQuarter) && (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p>Please select a school year and quarter to view coordinator LAEMPL & MPS submissions.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default LAEMPLMPSReports;

