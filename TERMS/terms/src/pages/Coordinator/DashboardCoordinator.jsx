import "./DashboardCoordinator.css";
import React from 'react'
import {useEffect, useState } from 'react'
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import Header from '../../components/shared/Header.jsx';
import Sidebar from '../../components/shared/SidebarCoordinator.jsx';
import Submitted from '../../assets/submitted.svg';
import Pending from '../../assets/pending.svg';
import Approved from '../../assets/approved.svg';

function DashboardCoordinator(){

    const [user, setUser] = useState(null);
    
        useEffect(() => {
        const fetchUser = async () => {
          try {
            const res = await fetch("http://localhost:5000/auth/me", {
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

    return (
        <>
        <Header userText={user ? user.name : "Guest"} />
        <div className="dashboard-container">
            <Sidebar activeLink="Dashboard"/>
            <div className="dashboard-content">
                <div className="dashboard-main">
                    <h2>Dashboard</h2>
                <div className="dashboard-cards">
                    <div className="dashboard-card">
                        <div className="title-container">
                            <img src={Submitted} alt="Submitted Photo" />
                            <h3>Total Submitted</h3>
                        </div>
                        <p>50</p>
                    </div>
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
            <div className="dashboard-sidebar">
                <CalendarComponent />
                <DeadlineComponent />
            </div>
        </div>
        </>
        
    )
}

function CalendarComponent() {
    const [date, setDate] = useState(new Date());
    const onChange = (newDate) => {
        setDate(newDate);
    };
    return (
        <div className="calendar-container">
            <Calendar onChange={onChange} value={date} />
        </div>
    );
}

function DeadlineComponent(){
    const deadlines = [
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
    return(
    <>
    <div className="deadline-component">
            <h4>Upcoming Deadlines</h4>
            <hr />
            <div className="deadline-container">
                {deadlines.map((deadline) => (
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

export default DashboardCoordinator;