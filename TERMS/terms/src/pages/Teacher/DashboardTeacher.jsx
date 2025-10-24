import "./DashboardTeacher.css";
import DeadlineComponent from "./DeadlineComponent.jsx";
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import Header from '../../components/shared/Header.jsx';
import Sidebar from '../../components/shared/SidebarTeacher.jsx';
import Submitted from '../../assets/submitted.svg';
import Pending from '../../assets/pending.svg';

const API_BASE = import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com";

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [deadlines, setDeadlines] = useState([]);
  const [counts, setCounts] = useState({
    submitted: 0,  // we will store COMPLETED here (per your request)
    pending: 0,
  });
  const [submittedReports, setSubmittedReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCounts = async () => {
    try {
      if (!user?.user_id) return; // safety
      const res = await fetch(
        `${API_BASE}/reports/status/count/teacher/${user.user_id}`,
        { credentials: "include" }
      );

      if (!res.ok) {
        const txt = await res.text();
        console.warn("Counts fetch failed:", res.status, txt);
        return;
      }

      let data = await res.json();
      console.log('📊 Teacher counts API response:', data);

      // Normalize keys to lowercase to be safe:
      if (data && typeof data === "object") {
        const lower = {};
        for (const k of Object.keys(data)) lower[k.toLowerCase()] = data[k];
        data = lower;
      }

      const finalCounts = {
        // Status 2 = Submitted/Completed
        submitted: Number(data.submitted ?? 0),
        // Status 1 = Pending/Draft
        pending: Number(data.pending ?? 0),
      };
      
      console.log('📊 Final teacher counts:', finalCounts);
      setCounts(finalCounts);
    } catch (e) {
      console.error("Failed to load counts:", e);
    }
  };

  // Load current user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }
    };
    fetchUser();
  }, []);

  // fetch counts when user is known
  useEffect(() => {
    if (!user?.user_id) return;
    fetchCounts();
  }, [user]);

  // Load upcoming deadlines when user is known
  useEffect(() => {
    if (!user?.user_id) return; // wait until user is loaded
    const fetchDeadlines = async () => {
      try {
        const res = await fetch(`${API_BASE}/reports/status/user/${user.user_id}/upcoming`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch deadlines");
        const data = await res.json();
        setDeadlines(data);
      } catch (err) {
        console.error("Failed to load deadlines:", err);
      }
    };
    fetchDeadlines();
  }, [user]);

  // Fetch submitted reports data
  useEffect(() => {
    const fetchReportsData = async () => {
      try {
        setLoading(true);
        
        // Fetch submitted reports by user ID
        if (user?.user_id) {
          const submittedRes = await fetch(`${API_BASE}/submissions/user/${user.user_id}`, {
            credentials: "include",
          });
          if (submittedRes.ok) {
            const submittedData = await submittedRes.json();
            // Filter for submitted reports (status 2)
            const submittedOnly = submittedData.filter(report => report.status === 2);
            setSubmittedReports(submittedOnly);
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

  // Navigation handlers
  const handleSubmittedReportClick = (report) => {
    // Navigate to ViewSubmission for submitted reports
    if (report.submission_id) {
      navigate(`/submission/${report.submission_id}`);
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
                  <h3>Submitted</h3>
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
            </div>

            <div className="submitted-reports">
              <h2>Submitted Reports</h2>
              <hr />
              <div className="reports-list">
                {loading ? (
                  <div className="loading-message">Loading submitted reports...</div>
                ) : submittedReports.length > 0 ? (
                  submittedReports.slice(0, 5).map((report, index) => (
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

          </div>
        </div>

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
  const navigate = useNavigate();
  const onChange = (newDate) => {
    setDate(newDate);
  };

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
    const hasDeadlineResult = dueDates.some(dueDate => 
      dueDate.year === date.getFullYear() &&
      dueDate.month === date.getMonth() &&
      dueDate.day === date.getDate()
    );
    
    if (hasDeadlineResult) {
      console.log('Date has deadline:', date, 'dueDates:', dueDates);
    }
    
    return hasDeadlineResult;
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

    if (kind === "laempl")         return navigate("/LAEMPLInstruction", { state: commonState });
    if (kind === "mps")            return navigate("/MPSInstruction", { state: commonState });
    if (kind === "accomplishment") return navigate("/AccomplishmentReportInstruction", { state: commonState });
    if (kind === "cog")            return navigate("/ClassificationOfGradesInstruction", { state: commonState });
    return navigate("/SubmittedReport");
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

export default Dashboard;
