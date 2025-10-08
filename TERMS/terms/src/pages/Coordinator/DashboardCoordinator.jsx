import "./DashboardCoordinator.css";
import React from 'react'
import { useEffect, useState } from 'react'
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import Header from '../../components/shared/Header.jsx';
import Sidebar from '../../components/shared/SidebarCoordinator.jsx';
import Submitted from '../../assets/submitted.svg';
import Pending from '../../assets/pending.svg';
import Approved from '../../assets/approved.svg';

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

function DashboardCoordinator() {
  const [user, setUser] = useState(null);

  // NEW: counts + deadlines
  const [counts, setCounts] = useState({
    submitted: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [deadlines, setDeadlines] = useState([]);

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
            </div>

            <div className="submitted-reports">
              <h2>Submitted Reports</h2>
              <hr />
              <div className="submitted-reports-container">
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

        {/* Sidebar with calendar + upcoming deadlines */}
        <div className="dashboard-sidebar">
          <CalendarComponent />
          <DeadlineComponent deadlines={deadlines} />
        </div>
      </div>
    </>
  );
}

function CalendarComponent() {
  const [date, setDate] = useState(new Date());
  const onChange = (newDate) => setDate(newDate);
  return (
    <div className="calendar-container">
      <Calendar onChange={onChange} value={date} />
    </div>
  );
}

function DeadlineComponent({ deadlines = [] }) {
  const fmtDateTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="deadline-component">
      <h4>Upcoming Deadlines</h4>
      <hr />
      <div className="deadline-container">
        {Array.isArray(deadlines) && deadlines.length > 0 ? (
          deadlines.map((d) => (
            <div key={d.submission_id || d.report_assignment_id} className="deadline-item">
              <p className="deadline-title">{d.title || "Untitled Report"}</p>
              <div className="deadline-details">
                <p>Due: {fmtDateTime(d.to_date)} </p>
                <p style={{ fontSize: 12, opacity: 0.8 }}>
                  Opens: {fmtDateTime(d.from_date)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p style={{ opacity: 0.8 }}>No upcoming deadlines 🎉</p>
        )}
      </div>
    </div>
  );
}

export default DashboardCoordinator;
