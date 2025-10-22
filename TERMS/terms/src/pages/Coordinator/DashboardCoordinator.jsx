import "./DashboardCoordinator.css";
import React from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import Header from '../../components/shared/Header.jsx';
import Sidebar from '../../components/shared/SidebarCoordinator.jsx';
import QuarterEnumService from '../../services/quarterEnumService';
import Submitted from '../../assets/submitted.svg';
import Pending from '../../assets/pending.svg';
import Approved from '../../assets/approved.svg';
import Rejected from '../../assets/rejected.svg';
import DeadlineComponent from "../Teacher/DeadlineComponent.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com";

function DashboardCoordinator() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // NEW: counts + deadlines
  const [counts, setCounts] = useState({
    submitted: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [deadlines, setDeadlines] = useState([]);
  const [submittedReports, setSubmittedReports] = useState([]);
  const [approvedReports, setApprovedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('');
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [schoolYears, setSchoolYears] = useState([]);
  const [quarters, setQuarters] = useState([]);
  const [filteredSubmittedReports, setFilteredSubmittedReports] = useState([]);
  const [filteredApprovedReports, setFilteredApprovedReports] = useState([]);

  // Load user (you already had this)
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

  // Fetch school years and set static quarters
  useEffect(() => {
    const fetchSchoolYears = async () => {
      try {
        // Fetch school years
        const schoolYearsRes = await fetch(`${API_BASE}/admin/school-years`, {
          credentials: "include",
        });
        if (schoolYearsRes.ok) {
          const schoolYearsData = await schoolYearsRes.json();
          setSchoolYears(schoolYearsData);
        }

        // Set quarters using quarter enum service
        const formattedQuarters = await QuarterEnumService.getFormattedQuarters();
        setQuarters(formattedQuarters);
      } catch (err) {
        console.error("Failed to fetch school years:", err);
      }
    };

    fetchSchoolYears();
  }, []);

  // After user loads, fetch counts
  useEffect(() => {
    if (!user?.user_id) return;

    const fetchCounts = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/reports/status/count/user/${user.user_id}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          const txt = await res.text();
          console.warn("Counts fetch failed:", res.status, txt);
          return;
        }
        const data = await res.json();
        setCounts({
          submitted: Number(data.submitted ?? 0),
          pending: Number(data.pending ?? 0),
          approved: Number(data.approved ?? data.completed ?? 0),
          rejected: Number(data.rejected ?? 0),
        });
      } catch (e) {
        console.error("Failed to load counts:", e);
      }
    };

    fetchCounts();
  }, [user]);

  // After user loads, fetch upcoming deadlines
  useEffect(() => {
    if (!user?.user_id) return;

    const fetchDeadlines = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/reports/status/user/${user.user_id}/upcoming`,
          { credentials: "include" }
        );
        if (!res.ok) {
          const txt = await res.text();
          console.warn("Deadlines fetch failed:", res.status, txt);
          return;
        }
        const data = await res.json();
        setDeadlines(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load deadlines:", e);
      }
    };

    fetchDeadlines();
  }, [user]);

  // Fetch submitted and approved reports data
  useEffect(() => {
    const fetchReportsData = async () => {
      try {
        setLoading(true);
        
        // Fetch reports submitted by this coordinator
        if (user?.user_id) {
          const reportsRes = await fetch(`${API_BASE}/reports/submitted_by/${user.user_id}`, {
            credentials: "include",
          });
          if (reportsRes.ok) {
            const reportsData = await reportsRes.json();
            // Set all reports (for counting purposes)
            setSubmittedReports(reportsData);
            // Filter for approved reports (status 3) for display
            const approvedOnly = reportsData.filter(report => report.status === 3);
            setApprovedReports(approvedOnly);
          }
        }
      } catch (err) {
        console.error("Failed to fetch reports data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchReportsData();
    }
  }, [user]);

  // Filter reports based on selected school year and quarter
  useEffect(() => {
    const filterReports = () => {
      let filteredSubmitted = submittedReports;
      let filteredApproved = approvedReports;

      if (selectedSchoolYear && selectedQuarter) {
        filteredSubmitted = submittedReports.filter(report => {
          const reportYear = report.school_year;
          const reportQuarter = report.quarter_name;
          
          // Find the selected school year object
          const selectedYearObj = schoolYears.find(year => year.year_id.toString() === selectedSchoolYear);
          const selectedQuarterObj = quarters.find(quarter => quarter.value.toString() === selectedQuarter);
          
          return reportYear === selectedYearObj?.school_year && 
                 reportQuarter === selectedQuarterObj?.label;
        });

        filteredApproved = approvedReports.filter(report => {
          const reportYear = report.school_year;
          const reportQuarter = report.quarter_name;
          
          // Find the selected school year object
          const selectedYearObj = schoolYears.find(year => year.year_id.toString() === selectedSchoolYear);
          const selectedQuarterObj = quarters.find(quarter => quarter.value.toString() === selectedQuarter);
          
          return reportYear === selectedYearObj?.school_year && 
                 reportQuarter === selectedQuarterObj?.label;
        });
      }

      setFilteredSubmittedReports(filteredSubmitted);
      setFilteredApprovedReports(filteredApproved);
    };

    filterReports();
  }, [submittedReports, approvedReports, selectedSchoolYear, selectedQuarter, schoolYears, quarters]);

  // Update counts based on filtered reports
  useEffect(() => {
    const updateFilteredCounts = () => {
      // Total submitted = status 2 (submitted) + status 3 (approved)
      const totalSubmitted = filteredSubmittedReports.filter(report => 
        report.status === 2 || report.status === 3
      ).length;
      
      // Pending = status 1 (pending)
      const pending = filteredSubmittedReports.filter(report => 
        report.status === 1
      ).length;
      
      // Approved = status 3 (approved)
      const approved = filteredSubmittedReports.filter(report => 
        report.status === 3
      ).length;
      
      // Rejected = status 4 (rejected)
      const rejected = filteredSubmittedReports.filter(report => 
        report.status === 4
      ).length;

      const filteredCounts = {
        submitted: totalSubmitted,
        approved: approved,
        pending: pending,
        rejected: rejected,
      };
      setCounts(filteredCounts);
    };

    updateFilteredCounts();
  }, [filteredSubmittedReports]);

  // Navigation handlers
  const handleSubmittedReportClick = (report) => {
    // Navigate to AssignedReportData for submitted reports
    if (report.submission_id) {
      navigate(`/AssignedReportData/${report.submission_id}`);
    }
  };

  const handleApprovedReportClick = (report) => {
    // Navigate to ViewSubmissionData for approved reports
    if (report.submission_id) {
      navigate(`/ViewSubmissionData?id=${report.submission_id}`);
    }
  };

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        <Sidebar activeLink="Dashboard" />
        <div className="dashboard-content">
          <div className="dashboard-main">
            <h2>Dashboard</h2>

            <div className="dashboard-cards">
              <div className="dashboard-card">
                <div className="title-container">
                  <img src={Submitted} alt="Submitted Photo" />
                  <h3>Total Submitted</h3>
                </div>
                <p>{counts.submitted}</p>
              </div>

              <div className="dashboard-card">
                <div className="title-container">
                  <img src={Pending} alt="Pending Photo" />
                  <h3>Pending</h3>
                </div>
                <p>{counts.pending}</p>
              </div>

              <div className="dashboard-card">
                <div className="title-container">
                  <img src={Approved} alt="Approved Photo" />
                  <h3>Approved</h3>
                </div>
                <p>{counts.approved}</p>
              </div>

              <div className="dashboard-card">
                <div className="title-container">
                  <img src={Rejected} alt="Rejected Photo" />
                  <h3>Rejected</h3>
                </div>
                <p>{counts.rejected}</p>
              </div>
            </div>

            <div className="submitted-reports">
              <h2>Submitted Reports</h2>
              
              {/* Filter dropdowns */}
              <div className="filter-controls">
                <div className="filter-group">
                  <label htmlFor="school-year-filter">School Year:</label>
                  <select 
                    id="school-year-filter"
                    value={selectedSchoolYear} 
                    onChange={(e) => setSelectedSchoolYear(e.target.value)}
                    className="filter-dropdown"
                  >
                    <option value="">All School Years</option>
                    {schoolYears.map((year) => (
                      <option key={year.year_id} value={year.year_id}>
                        {year.school_year}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="filter-group">
                  <label htmlFor="quarter-filter">Quarter:</label>
                  <select 
                    id="quarter-filter"
                    value={selectedQuarter} 
                    onChange={(e) => setSelectedQuarter(e.target.value)}
                    className="filter-dropdown"
                  >
                    <option value="">All Quarters</option>
                    {quarters.map((quarter) => (
                      <option key={quarter.value} value={quarter.value}>
                        {quarter.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <hr />
              <div className="reports-list">
                {loading ? (
                  <div className="loading-message">Loading submitted reports...</div>
                ) : filteredSubmittedReports.length > 0 ? (
                  filteredSubmittedReports.slice(0, 5).map((report, index) => (
                    <div 
                      key={report.submission_id || index} 
                      className="submitted-reports-container clickable-report"
                      onClick={() => handleSubmittedReportClick(report)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="submitted-report-title">
                        <h4>{report.assignment_title || 'Report'}</h4>
                        <p>{report.category_name || 'Category'}</p>
                        <p>{report.sub_category_name || 'Sub-Category'}</p>
                      </div>
                      <div className="submitted-report-date">
                        <p>SY: {report.school_year || '2024-2025'}</p>
                        <p>Date Submitted: {report.date_submitted || 'N/A'}</p>
                        <p>Status: {report.status === 2 ? 'Submitted' : 'Unknown'}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-reports-message">No submitted reports found</div>
                )}
              </div>
            </div>

            <div className="approved-reports">
              <h2>Approved Reports</h2>
              <hr />
              <div className="reports-list">
                {loading ? (
                  <div className="loading-message">Loading approved reports...</div>
                ) : filteredApprovedReports.length > 0 ? (
                  filteredApprovedReports.slice(0, 5).map((report, index) => (
                    <div 
                      key={report.submission_id || index} 
                      className="submitted-reports-container clickable-report"
                      onClick={() => handleApprovedReportClick(report)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="submitted-report-title">
                        <h4>{report.assignment_title || report.title || 'Report'}</h4>
                        <p>{report.category_name || 'Category'}</p>
                        <p>{report.sub_category_name || 'Sub-Category'}</p>
                      </div>
                      <div className="submitted-report-date">
                        <p>SY: {report.school_year || '2024-2025'}</p>
                        <p>Date Submitted: {report.date_submitted || 'N/A'}</p>
                        <p>Status: Approved</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-reports-message">No approved reports found</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar with calendar + upcoming deadlines */}
        <div className="dashboard-sidebar">
          <CalendarComponent deadlines={deadlines} />
          <DeadlineComponent deadlines={deadlines} />
        </div>
      </div>
    </>
  );
}

function CalendarComponent({ deadlines = [] }) {
  const [date, setDate] = useState(new Date());
  const onChange = (newDate) => setDate(newDate);

  // Extract due dates from deadlines
  const dueDates = deadlines.map(deadline => {
    // Try different possible field names for due date
    const dueDateField = deadline.due_date || deadline.to_date || deadline.dueDate || deadline.toDate;
    
    if (dueDateField) {
      let date;
      
      // Try parsing as ISO string first
      date = new Date(dueDateField);
      
      // If that fails, try parsing as a formatted date string
      if (isNaN(date.getTime())) {
        // Handle formats like "Oct 21, 2025, 12:00 AM"
        const dateStr = dueDateField.toString();
        const match = dateStr.match(/(\w{3})\s+(\d{1,2}),\s+(\d{4})/);
        if (match) {
          const [, month, day, year] = match;
          const monthMap = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
          };
          date = new Date(parseInt(year), monthMap[month], parseInt(day));
        }
      }
      
      if (!isNaN(date.getTime())) {
        console.log('Deadline date found:', dueDateField, 'parsed as:', date);
        return {
          year: date.getFullYear(),
          month: date.getMonth(),
          day: date.getDate()
        };
      }
    }
    return null;
  }).filter(Boolean);

  console.log('All deadlines:', deadlines);
  console.log('Extracted due dates:', dueDates);

  // Function to check if a date has a deadline
  const hasDeadline = (date) => {
    return dueDates.some(dueDate => 
      dueDate.year === date.getFullYear() &&
      dueDate.month === date.getMonth() &&
      dueDate.day === date.getDate()
    );
  };

  // Custom tile content to highlight due dates
  const tileContent = ({ date, view }) => {
    if (view === 'month' && hasDeadline(date)) {
      return <div className="deadline-indicator">●</div>;
    }
    return null;
  };

  // Custom tile class name for styling
  const tileClassName = ({ date, view }) => {
    if (view === 'month' && hasDeadline(date)) {
      return 'react-calendar__tile--deadline';
    }
    return null;
  };

  return (
    <div className="calendar-container">
      <Calendar 
        onChange={onChange} 
        value={date}
        tileContent={tileContent}
        tileClassName={tileClassName}
      />
    </div>
  );
}

export default DashboardCoordinator;
