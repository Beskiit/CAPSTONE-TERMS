import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QuarterEnumService from '../services/quarterEnumService';
import './YearQuarterFileManager.css';

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function YearQuarterFileManager({ user, reportType = 'assigned' }) {
  const navigate = useNavigate();
  const [yearQuarters, setYearQuarters] = useState([]);
  const [reports, setReports] = useState({});
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedQuarter, setSelectedQuarter] = useState(null);
  const [filteredReports, setFilteredReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);

  // Fetch school years and create year/quarter combinations using quarter enum
  useEffect(() => {
    const fetchYearQuarters = async () => {
      try {
        // Fetch school years
        const schoolYearsRes = await fetch(`${API_BASE}/admin/school-years`, {
          credentials: "include"
        });
        if (!schoolYearsRes.ok) throw new Error('Failed to fetch school years');
        const schoolYearsData = await schoolYearsRes.json();
        
        // Fetch quarter enum data
        const quarterEnum = await QuarterEnumService.getQuarterEnum();
        
        // Create year/quarter combinations using quarter enum
        const yearQuarterCombinations = [];
        schoolYearsData.forEach(year => {
          quarterEnum.forEach(quarter => {
            yearQuarterCombinations.push({
              yr_and_qtr_id: `${year.year_id}_${quarter.quarter_number}`,
              year: year.year_id,
              quarter: quarter.quarter_number,
              quarter_name: quarter.quarter_name,
              quarter_short_name: quarter.quarter_short_name,
              school_year: year.school_year,
              start_year: year.start_year,
              end_year: year.end_year
            });
          });
        });
        
        setYearQuarters(yearQuarterCombinations);
      } catch (error) {
        console.error('Error fetching year quarters:', error);
        // Fallback to static quarters if API fails
        const schoolYearsRes = await fetch(`${API_BASE}/admin/school-years`, {
          credentials: "include"
        });
        if (schoolYearsRes.ok) {
          const schoolYearsData = await schoolYearsRes.json();
          const yearQuarterCombinations = [];
          schoolYearsData.forEach(year => {
            for (let quarter = 1; quarter <= 4; quarter++) {
              yearQuarterCombinations.push({
                yr_and_qtr_id: `${year.year_id}_${quarter}`,
                year: year.year_id,
                quarter: quarter,
                quarter_name: QuarterEnumService.getQuarterDisplayName(quarter),
                quarter_short_name: QuarterEnumService.getQuarterDisplayName(quarter, true),
                school_year: year.school_year,
                start_year: year.start_year,
                end_year: year.end_year
              });
            }
          });
          setYearQuarters(yearQuarterCombinations);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchYearQuarters();
  }, []);

  // Fetch reports for a specific year/quarter
  const fetchReportsForYearQuarter = async (year, quarter) => {
    setLoadingReports(true);
    try {
      let endpoint;
      if (reportType === 'assigned') {
        endpoint = `${API_BASE}/reports/assigned_by/${user.user_id}?year=${year}&quarter=${quarter}`;
      } else {
        endpoint = `${API_BASE}/submissions/user/${user.user_id}?year=${year}&quarter=${quarter}`;
      }

      const response = await fetch(endpoint, {
        credentials: "include"
      });

      if (!response.ok) throw new Error('Failed to fetch reports');
      const data = await response.json();
      
      const key = `${year}-${quarter}`;
      setReports(prev => ({
        ...prev,
        [key]: data
      }));
      
      setFilteredReports(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
      setFilteredReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

  // Handle year/quarter cell click
  const handleCellClick = (year, quarter) => {
    setSelectedYear(year);
    setSelectedQuarter(quarter);
    
    const key = `${year}-${quarter}`;
    if (reports[key]) {
      // Use cached data
      setFilteredReports(reports[key]);
    } else {
      // Fetch new data
      fetchReportsForYearQuarter(year, quarter);
    }
  };

  // Create year/quarter grid
  const createGrid = () => {
    if (yearQuarters.length === 0) return [];

    // Group by year
    const yearGroups = {};
    yearQuarters.forEach(yq => {
      if (!yearGroups[yq.year]) {
        yearGroups[yq.year] = [];
      }
      yearGroups[yq.year].push(yq);
    });

    // Sort years descending
    const sortedYears = Object.keys(yearGroups).sort((a, b) => b - a);

    return sortedYears.map(year => ({
      year: parseInt(year),
      quarters: yearGroups[year].sort((a, b) => a.quarter - b.quarter)
    }));
  };

  const grid = createGrid();

  if (loading) {
    return <div className="loading-container">Loading year/quarter data...</div>;
  }

  return (
    <div className="year-quarter-file-manager">
      <div className="file-manager-header">
        <h3>File Management by Year & Quarter</h3>
        <p>Click on any year/quarter cell to view reports for that period</p>
      </div>

      <div className="year-quarter-grid">
        {grid.map(yearGroup => (
          <div key={yearGroup.year} className="year-group">
            <div className="year-header">
              <h4>Year {yearGroup.year}</h4>
            </div>
            <div className="quarters-row">
              {yearGroup.quarters.map(quarter => (
                <div
                  key={`${yearGroup.year}-${quarter.quarter}`}
                  className={`quarter-cell ${selectedYear === yearGroup.year && selectedQuarter === quarter.quarter ? 'selected' : ''}`}
                  onClick={() => handleCellClick(yearGroup.year, quarter.quarter)}
                >
                  <div className="quarter-label">Q{quarter.quarter}</div>
                  <div className="quarter-status">
                    {quarter.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedYear && selectedQuarter && (
        <div className="reports-section">
          <div className="reports-header">
            <div>
              <h4>
                {reportType === 'assigned' ? 'Assigned' : 'Submitted'} Reports for {selectedYear} Q{selectedQuarter}
              </h4>
              <p className="click-instruction">Click on any report to view details</p>
            </div>
            <button 
              className="close-reports-btn"
              onClick={() => {
                setSelectedYear(null);
                setSelectedQuarter(null);
                setFilteredReports([]);
              }}
            >
              ×
            </button>
          </div>

          {loadingReports ? (
            <div className="loading-reports">Loading reports...</div>
          ) : filteredReports.length === 0 ? (
            <div className="no-reports">
              No {reportType} reports found for {selectedYear} Q{selectedQuarter}
            </div>
          ) : (
            <div className="reports-list">
              {filteredReports.map((report, index) => {
                // Determine the navigation path based on report type
                const handleReportClick = () => {
                  if (reportType === 'submitted' && report.submission_id) {
                    // For submitted reports, navigate to submission details
                    navigate(`/submission/${report.submission_id}`);
                  } else if (reportType === 'assigned' && report.report_assignment_id) {
                    // For assigned reports, navigate to assignment data
                    navigate(`/AssignedReportData/${report.report_assignment_id}`);
                  }
                };

                return (
                  <div 
                    key={report.id || report.submission_id || report.report_assignment_id || index} 
                    className="report-item clickable"
                    onClick={handleReportClick}
                  >
                    <div className="report-title">
                      {report.assignment_title || report.title || 'Untitled Report'}
                    </div>
                    <div className="report-meta">
                      <span className="report-category">
                        {report.category_name || 'Category'}
                      </span>
                      <span className="report-date">
                        {report.date_submitted ? new Date(report.date_submitted).toLocaleDateString() : 
                         report.created_at ? new Date(report.created_at).toLocaleDateString() : 'No date'}
                      </span>
                      {report.status && (
                        <span className={`report-status status-${report.status}`}>
                          {report.status === 0 ? 'Draft' : 
                           report.status === 1 ? 'Pending' : 
                           report.status === 2 ? 'Submitted' : 
                           report.status === 3 ? 'Approved' : 
                           report.status === 4 ? 'Rejected' : 
                           report.status_text || report.status}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default YearQuarterFileManager;
