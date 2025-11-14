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

  const gradeGroups = useMemo(() => {
    const groupsMap = new Map();
    const gradeOrder = ["1", "2", "3", "4", "5", "6"];

    submissions.forEach((submission) => {
      const gradeLevel = submission.grade_level != null ? String(submission.grade_level) : "Unknown";
      const coordinatorId = submission.coordinator_user_id || submission.submitted_by;
      const coordinatorName = submission.coordinator_name || "Unknown Coordinator";

      if (!groupsMap.has(gradeLevel)) {
        groupsMap.set(gradeLevel, {
          grade_level: gradeLevel,
          category_name: submission.category_name,
          sub_category_name: submission.sub_category_name,
          school_year: submission.school_year,
          quarter: submission.quarter,
          submissions: [],
          coordinatorsMap: new Map(),
        });
      }

      const group = groupsMap.get(gradeLevel);
      group.submissions.push(submission);

      if (!group.coordinatorsMap.has(coordinatorId)) {
        group.coordinatorsMap.set(coordinatorId, {
          coordinator_id: coordinatorId,
          coordinator_name: coordinatorName,
          submissions: [],
        });
      }
      group.coordinatorsMap.get(coordinatorId).submissions.push(submission);
    });

    // Ensure grades 1-6 appear even if empty
    const orderedGroups = gradeOrder.map((grade) => {
      if (!groupsMap.has(grade)) {
        groupsMap.set(grade, {
          grade_level: grade,
          category_name: submissions[0]?.category_name || "Quarterly Achievement Test",
          sub_category_name: submissions[0]?.sub_category_name || "LAEMPL & MPS",
          school_year: submissions[0]?.school_year || selectedSchoolYear,
          quarter: submissions[0]?.quarter || selectedQuarter,
          submissions: [],
          coordinatorsMap: new Map(),
        });
      }
      const group = groupsMap.get(grade);
      group.coordinators = Array.from(group.coordinatorsMap.values());
      delete group.coordinatorsMap;
      return group;
    });

    // Include any additional grades (e.g., "Unknown")
    groupsMap.forEach((group, grade) => {
      if (!gradeOrder.includes(grade)) {
        group.coordinators = Array.from(group.coordinatorsMap.values());
        delete group.coordinatorsMap;
        orderedGroups.push(group);
      }
    });

    return orderedGroups;
  }, [submissions, selectedSchoolYear, selectedQuarter]);

  const aggregatedRow = useMemo(() => {
    if (gradeGroups.length === 0) return null;
    // Find first grade that has actual submission data, fallback to first entry
    const referenceGroup =
      gradeGroups.find((group) => group.submissions.length > 0) || gradeGroups[0];

    return {
      category_name: referenceGroup.category_name,
      sub_category_name: referenceGroup.sub_category_name,
      school_year: referenceGroup.school_year,
      quarter: referenceGroup.quarter,
      grade_groups: gradeGroups,
      submissions: gradeGroups.flatMap((group) => group.submissions),
    };
  }, [gradeGroups]);

  const handleAggregatedClick = () => {
    if (!aggregatedRow) return;
    navigate(`/ViewCoordinatorSubmissions`, {
      state: {
        schoolYear: selectedSchoolYear,
        quarter: selectedQuarter,
        submissions: aggregatedRow.submissions,
        gradeGroups: aggregatedRow.grade_groups,
        viewMode: "allGrades",
      },
    });
  };

  const renderCoordinatorSummary = (group) => {
    if (!group) return null;

    if (group.coordinators && group.coordinators.length > 0) {
      return group.coordinators.map((coordinator) => (
        <div key={`${group.grade_level}-${coordinator.coordinator_id}`} style={{ marginBottom: "4px" }}>
          <strong>Grade {group.grade_level}:</strong>{" "}
          {coordinator.coordinator_name || `Coordinator ${coordinator.coordinator_id}`}
          <span style={{ color: "#6b7280" }}>
            {" "}
            ({coordinator.submissions.length || 0} submission
            {coordinator.submissions.length === 1 ? "" : "s"})
          </span>
        </div>
      ));
    }

    return (
      <div key={`grade-empty-${group.grade_level}`} style={{ marginBottom: "4px", color: "#9ca3af" }}>
        <strong>Grade {group.grade_level}:</strong> No coordinator submissions yet
      </div>
    );
  };

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
                {!aggregatedRow || submissions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>No coordinator LAEMPL & MPS submissions found for the selected year and quarter.</p>
                  </div>
                ) : (
                  <div style={{ marginBottom: "30px" }}>
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
                        <tr onClick={handleAggregatedClick} style={{ cursor: "pointer" }}>
                          <td className="file-cell">
                            <span className="file-name">{aggregatedRow.category_name || "N/A"}</span>
                          </td>
                          <td>{aggregatedRow.sub_category_name || "N/A"}</td>
                          <td>{aggregatedRow.school_year || selectedSchoolYear || "N/A"}</td>
                          <td>
                            {quarters.find(
                              (q) => q.value.toString() === aggregatedRow.quarter?.toString()
                            )?.label ||
                              `Quarter ${aggregatedRow.quarter || selectedQuarter || "N/A"}`}
                          </td>
                        </tr>
                      </tbody>
                    </table>
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

