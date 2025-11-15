import "./DashboardCoordinator.css";
import React from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import Header from '../../components/shared/Header.jsx';
import Breadcrumb from '../../components/Breadcrumb.jsx';
import Sidebar from '../../components/shared/SidebarCoordinator.jsx';
import QuarterEnumService from '../../services/quarterEnumService';
import Submitted from '../../assets/submitted.svg';
import Pending from '../../assets/pending.svg';
import Approved from '../../assets/approved.svg';
import Rejected from '../../assets/rejected.svg';
import CoordinatorDeadlineComponent from "./CoordinatorDeadlineComponent.jsx";
// React already imported above

const API_BASE = import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com";

function DashboardCoordinator() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  
  // Debug: Log when component mounts/unmounts
  useEffect(() => {
    console.log('🟢 [DashboardCoordinator] Component mounted');
    return () => {
      console.log('🔴 [DashboardCoordinator] Component unmounting');
    };
  }, []);

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
  const [selectedCategory, setSelectedCategory] = useState('');
  const [schoolYears, setSchoolYears] = useState([]);
  const [quarters, setQuarters] = useState([]);
  const [categories, setCategories] = useState([]);
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

  // Fetch school years, quarters, and categories
  useEffect(() => {
    const fetchSchoolYearsQuartersAndCategories = async () => {
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

        // Fetch categories
        const categoriesRes = await fetch(`${API_BASE}/categories`);
        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategories(categoriesData);
        }
      } catch (err) {
        console.error("Failed to fetch school years, quarters, and categories:", err);
      }
    };

    fetchSchoolYearsQuartersAndCategories();
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

  // Fetch ALL upcoming deadlines for coordinator (combining is_given = 0 and is_given = 1)
  // Since scheduling is now optional via modal, we show all upcoming deadlines together
  useEffect(() => {
    if (!user?.user_id) return;

    const fetchAllDeadlines = async () => {
      try {
        // Fetch both types: is_given = 1 (already given) and is_given = 0 (not yet given)
        const [givenDeadlinesRes, notGivenDeadlinesRes] = await Promise.all([
          fetch(`${API_BASE}/reports/status/user/${user.user_id}/upcoming`, { credentials: "include" }),
          fetch(`${API_BASE}/reports/upcoming-deadlines/${user.user_id}`, { credentials: "include" })
        ]);

        const givenDeadlines = givenDeadlinesRes.ok ? await givenDeadlinesRes.json() : [];
        const notGivenDeadlines = notGivenDeadlinesRes.ok ? await notGivenDeadlinesRes.json() : [];

        // Combine both lists, ensuring we have unique items by report_assignment_id
        const combinedDeadlines = [];
        const seenIds = new Set();

        // First add not given deadlines (is_given = 0) - these come with submission data
        notGivenDeadlines.forEach(d => {
          const key = d.report_assignment_id || d.submission_id;
          if (key && !seenIds.has(key)) {
            seenIds.add(key);
            combinedDeadlines.push({
              ...d,
              title: d.assignment_title || d.title,
              is_given: 0 // Mark as not given for reference
            });
          }
        });

        // Then add given deadlines (is_given = 1)
        givenDeadlines.forEach(d => {
          const key = d.report_assignment_id || d.submission_id;
          if (key && !seenIds.has(key)) {
            seenIds.add(key);
            combinedDeadlines.push({
              ...d,
              title: d.title || d.assignment_title,
              is_given: 1 // Mark as given for reference
            });
          }
        });

        // Sort by due date
        combinedDeadlines.sort((a, b) => {
          const dateA = new Date(a.to_date || a.due_date || 0);
          const dateB = new Date(b.to_date || b.due_date || 0);
          return dateA - dateB;
        });

        setDeadlines(combinedDeadlines);
        console.log('🔄 [DEBUG] Combined upcoming deadlines:', combinedDeadlines.length);
      } catch (e) {
        console.error("Failed to load deadlines:", e);
        setDeadlines([]);
      }
    };

    fetchAllDeadlines();
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

  // Filter reports based on selected school year, quarter, and category
  useEffect(() => {
    const filterReports = () => {
      // Filter submitted reports (status 2) only
      let filteredSubmitted = submittedReports.filter(report => report.status === 2);
      let filteredApproved = approvedReports;

      if (selectedSchoolYear && selectedQuarter) {
        filteredSubmitted = filteredSubmitted.filter(report => {
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

      // Filter by category
      if (selectedCategory) {
        const selectedCategoryObj = categories.find(cat => cat.category_id.toString() === selectedCategory);
        if (selectedCategoryObj) {
          filteredSubmitted = filteredSubmitted.filter(report => {
            return report.category_name === selectedCategoryObj.category_name;
          });
          filteredApproved = filteredApproved.filter(report => {
            return report.category_name === selectedCategoryObj.category_name;
          });
        }
      }

      setFilteredSubmittedReports(filteredSubmitted);
      setFilteredApprovedReports(filteredApproved);
    };

    filterReports();
  }, [submittedReports, approvedReports, selectedSchoolYear, selectedQuarter, selectedCategory, schoolYears, quarters, categories]);

  // Update counts based on filtered reports
  useEffect(() => {
    const updateFilteredCounts = () => {
      // Apply the same filtering logic as the main filter function
      let filteredForCounts = submittedReports;
      
      // Apply school year and quarter filters
      if (selectedSchoolYear && selectedQuarter) {
        filteredForCounts = filteredForCounts.filter(report => {
          const reportYear = report.school_year;
          const reportQuarter = report.quarter_name;
          
          const selectedYearObj = schoolYears.find(year => year.year_id.toString() === selectedSchoolYear);
          const selectedQuarterObj = quarters.find(quarter => quarter.value.toString() === selectedQuarter);
          
          return reportYear === selectedYearObj?.school_year && 
                 reportQuarter === selectedQuarterObj?.label;
        });
      }
      
      // Apply category filter
      if (selectedCategory) {
        const selectedCategoryObj = categories.find(cat => cat.category_id.toString() === selectedCategory);
        if (selectedCategoryObj) {
          filteredForCounts = filteredForCounts.filter(report => {
            return report.category_name === selectedCategoryObj.category_name;
          });
        }
      }
      
      // Calculate counts from the filtered data
      const totalSubmitted = filteredForCounts.filter(report => 
        report.status === 2 || report.status === 3
      ).length;
      
      // Pending = status 1 (pending)
      const pending = filteredForCounts.filter(report => 
        report.status === 1
      ).length;
      
      // Approved = status 3 (approved)
      const approved = filteredForCounts.filter(report => 
        report.status === 3
      ).length;
      
      // Rejected = status 4 (rejected)
      const rejected = filteredForCounts.filter(report => 
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
  }, [submittedReports, selectedSchoolYear, selectedQuarter, selectedCategory, schoolYears, quarters, categories]);

  // Navigation handlers
  const handleSubmittedReportClick = (report) => {
    // Navigate directly to the submission details viewing page
    if (report.submission_id) {
      navigate(`/submission/${report.submission_id}`, { state: { breadcrumbTitle: (report.assignment_title || report.title) } });
    }
  };

  const handleApprovedReportClick = (report) => {
    // Navigate directly to the submission details viewing page for approved reports
    if (report.submission_id) {
      navigate(`/submission/${report.submission_id}`, { state: { breadcrumbTitle: (report.assignment_title || report.title) } });
    }
  };

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        <Sidebar activeLink="Dashboard" />
        <div className="dashboard-content">
          <Breadcrumb />
          <div className="dashboard-main">

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

                <div className="filter-group">
                  <label htmlFor="category-filter">Category:</label>
                  <select 
                    id="category-filter"
                    value={selectedCategory} 
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="filter-dropdown"
                  >
                    <option value="">All Categories</option>
                    {categories.map((category) => (
                      <option key={category.category_id} value={category.category_id}>
                        {category.category_name}
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

        {/* Sidebar with calendar + deadline components */}
        <div className="dashboard-sidebar">
          <CalendarComponent deadlines={deadlines} />
          <CoordinatorDeadlineComponent deadlines={deadlines} />
          {/* UpcomingDeadlineComponent removed - all deadlines now show in CoordinatorDeadlineComponent with modal options */}
        </div>
      </div>
    </>
  );
}

function CalendarComponent({ deadlines = [] }) {
  const [date, setDate] = useState(new Date());
  const navigate = useNavigate();
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

  // Function to detect deadline type (copied from DeadlineComponent)
  const detectType = (d) => {
    const title   = (d?.title || "").toLowerCase();
    const catName = (d?.category_name || "").toLowerCase();
    const subName = (d?.sub_category_name || "").toLowerCase();
    const subId   = Number(d?.sub_category_id);
    const catId   = Number(d?.category_id);

    const hay = `${title} ${catName} ${subName}`;
    if (hay.includes("laempl")) return "laempl";
    if (hay.includes("mps")) return "mps";
    if (hay.includes("accomplishment")) return "accomplishment";
    if (hay.includes("classification of grades") || hay.includes("classification")) return "cog";

    if (subId === 20) return "laempl";
    if (subId === 30) return "mps";
    if (catId === 1)  return "accomplishment";
    if (catId === 2)  return "laempl";
    return "generic";
  };

  // Function to get submission ID (copied from DeadlineComponent)
  const getSubmissionId = (d) =>
    d?.submission_id ?? d?.id ?? d?.report_assignment_id ?? null;

  // Function to navigate to deadline template
  const goToTemplate = (deadline) => {
    const kind = detectType(deadline);
    const submissionId = getSubmissionId(deadline);

    const commonState = {
      submission_id: submissionId,
      title: deadline.title,
      instruction: deadline.instruction,
      from_date: deadline.from_date,
      to_date: deadline.to_date,
      number_of_submission: deadline.number_of_submission,
      allow_late: deadline.allow_late,
    };

    if (kind === "laempl")         return navigate("/LAEMPLInstruction", { state: { ...commonState, fromDeadline: true } });
    if (kind === "mps")            return navigate("/MPSInstruction", { state: { ...commonState, fromDeadline: true } });
    if (kind === "accomplishment") return navigate("/AccomplishmentReportInstruction", { state: { ...commonState, fromDeadline: true } });
    if (kind === "cog")            return navigate("/ClassificationOfGradesInstruction", { state: commonState });
    // Fallback to original grouped flow
    return navigate("/AssignedReport");
  };

  // Function to handle tile click
  const handleTileClick = (value, event) => {
    if (hasDeadline(value)) {
      // Find the deadline that matches this date
      const clickedDeadline = deadlines.find(deadline => {
        const dueDateField = deadline.due_date || deadline.to_date || deadline.dueDate || deadline.toDate;
        if (dueDateField) {
          let date;
          date = new Date(dueDateField);
          
          if (isNaN(date.getTime())) {
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
            return date.getFullYear() === value.getFullYear() &&
                   date.getMonth() === value.getMonth() &&
                   date.getDate() === value.getDate();
          }
        }
        return false;
      });

      if (clickedDeadline) {
        goToTemplate(clickedDeadline);
      }
    }
  };

  return (
    <div className="calendar-container">
      <Calendar 
        onChange={onChange} 
        value={date}
        tileContent={tileContent}
        tileClassName={tileClassName}
        onClickDay={handleTileClick}
      />
    </div>
  );
}

export default DashboardCoordinator;

// CombinedDeadlines was used during the merge; reverting to original separate components.
function CombinedDeadlines({ deadlines = [], needsScheduling = [] }) {
  const navigate = useNavigate();

  const fmtDateTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const detectType = (d) => {
    const title   = (d?.title || d?.assignment_title || "").toLowerCase();
    const catName = (d?.category_name || "").toLowerCase();
    const subName = (d?.sub_category_name || "").toLowerCase();
    const subId   = Number(d?.sub_category_id);
    const catId   = Number(d?.category_id);

    const hay = `${title} ${catName} ${subName}`;
    if (hay.includes("laempl")) return "laempl";
    if (hay.includes("mps")) return "mps";
    if (hay.includes("accomplishment")) return "accomplishment";
    if (hay.includes("classification of grades") || hay.includes("classification")) return "cog";

    if (subId === 20) return "laempl";
    if (subId === 30) return "mps";
    if (catId === 1)  return "accomplishment";
    if (catId === 2)  return "laempl";
    return "generic";
  };

  const onClickRegular = (d) => {
    const kind = detectType(d);
    const commonState = {
      submission_id: d?.submission_id ?? d?.id ?? d?.report_assignment_id ?? null,
      title: d.title || d.assignment_title,
      instruction: d.instruction,
      from_date: d.from_date,
      to_date: d.to_date,
      number_of_submission: d.number_of_submission,
      allow_late: d.allow_late,
    };

    if (kind === "laempl")         return navigate("/LAEMPLInstruction", { state: commonState });
    if (kind === "mps")            return navigate("/MPSInstruction", { state: commonState });
    if (kind === "accomplishment") return navigate("/AccomplishmentReportInstruction", { state: commonState });
    if (kind === "cog")            return navigate("/ClassificationOfGradesInstruction", { state: commonState });
    return navigate("/SubmittedReport");
  };

  const onClickNeedsScheduling = (d) => {
    // Send coordinator to SetReport for editing principal's assignment
    navigate(`/SetReport?reportId=${d.report_assignment_id}&isPrincipalReport=true`);
  };

  // Single unified list: needs scheduling first (marked), then regular deadlines
  const unified = [
    ...(needsScheduling || []).map(d => ({ ...d, __needs: true })),
    ...(deadlines || []).map(d => ({ ...d, __needs: false })),
  ];

  return (
    <div className="deadline-component">
      <h4>Upcoming Deadlines</h4>
      <hr />
      <div className="deadline-box">
        <div className="deadline-list">
          {unified.length > 0 ? (
            unified.slice(0, 10).map((d, idx) => {
              const title = d.title || d.assignment_title || "Untitled Report";
              const recipientsCount = Number(d?.recipients_count || 0);
              const onClick = d.__needs
                ? (recipientsCount >= 2 ? () => onClickRegular(d) : () => onClickNeedsScheduling(d))
                : () => onClickRegular(d);
              return (
                <a key={d.submission_id || d.report_assignment_id || idx}
                   className="deadline-item"
                   role="button"
                   tabIndex={0}
                   onClick={onClick}
                   onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}>
                  <p className="deadline-title">{title}</p>
                  <div className="deadline-details">
                    {d.__needs && (
                      <p><b>Teacher:</b> {d.submitted_by_name || 'N/A'}</p>
                    )}
                    <p><b>Category:</b> {d.category_name || 'N/A'} {d.sub_category_name && `(${d.sub_category_name})`}</p>
                    <p><b>Due:</b> {fmtDateTime(d.to_date)}</p>
                    {d.__needs ? (
                      <span className="status-badge" style={{ background:'#ffcc80', color:'#7a4d00', padding:'2px 6px', borderRadius:4, marginTop:4 }}>Not Given</span>
                    ) : (
                      <span className="status-badge" style={{ background:'#c8e6c9', color:'#1b5e20', padding:'2px 6px', borderRadius:4, marginTop:4 }}>Given</span>
                    )}
                  </div>
                </a>
              );
            })
          ) : (
            <p style={{ opacity: 0.8, margin: 0 }}>No upcoming deadlines 🎉</p>
          )}
        </div>
      </div>
    </div>
  );
}
