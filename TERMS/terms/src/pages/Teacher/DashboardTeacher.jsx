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
import Approved from '../../assets/approved.svg';
import Rejected from '../../assets/rejected.svg';

const API_BASE = import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com";

function Dashboard() {
  const [user, setUser] = useState(null);
  const [deadlines, setDeadlines] = useState([]);
  const [counts, setCounts] = useState({
    submitted: 0,  // we will store COMPLETED here (per your request)
    pending: 0,
    approved: 0,   // strict approved-only
    rejected: 0,
  });

  const fetchCounts = async () => {
    try {
      if (!user?.user_id) return; // safety
      const res = await fetch(
        `${API_BASE}/reports/status/count/user/${user.user_id}`,
        { credentials: "include" }
      );

      if (!res.ok) {
        const txt = await res.text();
        console.warn("Counts fetch failed:", res.status, txt);
        return;
      }

      let data = await res.json();

      // Normalize keys to lowercase to be safe:
      if (data && typeof data === "object") {
        const lower = {};
        for (const k of Object.keys(data)) lower[k.toLowerCase()] = data[k];
        data = lower;
      }

      setCounts({
        // ⬇️ Use COMPLETED for the left card (you called it "Total Submitted")
        submitted: Number(data.completed ?? 0),

        pending: Number(data.pending ?? 0),

        // ⬇️ Show STRICT approved-only (status=3)
        approved: Number(data.approved_strict ?? data.approved ?? 0),

        rejected: Number(data.rejected ?? 0),
      });
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
                  <img src={Submitted} alt="Completed Photo" />
                  {/* You can keep the old label if you want, but this is clearer */}
                  <h3>Completed</h3>
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
              <hr />
              <div className="submitted-reports-container" clickable="true">
                <div className="submitted-report-title">
                  <h4>Quarterly Assessment Report</h4>
                  <p>Intervention Report</p>
                  <p>1st Quarter</p>
                </div>
                <div className="submitted-report-date">
                  <p>SY: 2025-2026</p>
                  <p>Date Given: May 06, 2025</p>
                  <p>May 06, 2025</p>
                </div>
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

export default Dashboard;
