import "./DashboardPrincipal.css";
import React from 'react'
import {useEffect, useState } from 'react'
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import Header from '../../components/shared/Header.jsx';
import Sidebar from '../../components/shared/SidebarPrincipal.jsx';
import Submitted from '../../assets/submitted.svg';
import Pending from '../../assets/pending.svg';
import Approved from '../../assets/approved.svg';

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function DashboardPrincipal(){

    const [user, setUser] = useState(null);
    const [deadlines, setDeadlines] = useState([]);
    
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

    // Fetch deadlines data
    useEffect(() => {
        const fetchDeadlines = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/deadlines`, {
                    credentials: "include",
                });
                if (res.ok) {
                    const data = await res.json();
                    setDeadlines(data);
                }
            } catch (err) {
                console.error("Failed to fetch deadlines:", err);
            }
        };
        fetchDeadlines();
    }, []);

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
                            <img src={Pending} alt="Pending Photo" />
                            <h3>Pending</h3>
                        </div>
                        <p>500</p>
                    </div>
                    <div className="dashboard-card">
                        <div className="title-container">
                            <img src={Approved} alt="Approved Photo" />
                            <h3>Approved</h3>
                        </div>
                        <p>20</p>
                    </div>
                </div>
                    <div className="submitted-reports">
                        <h2>Submitted Reports</h2>
                        <hr />
                        <div className="reports-list">
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

                            {/* more items can go here */}
                        </div>
                        </div>

                    <div className="submitted-reports-upon-approval">
                        <h2>Submitted Reports Upon Approval</h2>
                        <hr />
                        <div className="reports-list">
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

                            {/* more items can go here */}
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
        
    )
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

function DeadlineComponent({ deadlines = [] }){
    // Use static deadlines as fallback if no data is provided
    const staticDeadlines = [
        {
            id: 1,
            title: "Quarterly Assessment Report",
            dueDate: "May 06, 2025",
            dueTime: "7:00 PM"
        },
        {
            id: 2,
            title: "Final Grades Submission",
            dueDate: "May 15, 2025",
            dueTime: "11:59 PM"
        },
        {
            id: 3,
            title: "Parent-Teacher Meeting",
            dueDate: "May 20, 2025",
            dueTime: "3:00 PM"
        }
    ];
    
    const displayDeadlines = deadlines.length > 0 ? deadlines : staticDeadlines;
    return(
    <>
    <div className="deadline-component">
            <h4>Upcoming Deadlines</h4>
            <hr />
            <div className="deadline-container">
                {displayDeadlines.map((deadline) => (
                    <div key={deadline.id} className="deadline-item">
                        <p className="deadline-title">{deadline.title}</p>
                        <div className="deadline-details">
                            <p>Due: {deadline.dueDate} <span>{deadline.dueTime}</span></p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </>
    )
}

export default DashboardPrincipal;