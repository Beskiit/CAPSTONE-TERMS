import "./Dashboard.css";
import React from 'react'
import { useState } from 'react'
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import DepedLogo from '../assets/deped-logo.png';
import Logout from '../assets/logout.svg';
import Submitted from '../assets/submitted.svg';
import Pending from '../assets/pending.svg';
import Approved from '../assets/approved.svg';
import Notification from '../assets/notification.svg';

function Dashboard(){
    return (
        <>
        <Header />
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

function Header({userText}){
    return (
        <header>
            <div className="header-left">
                <img src={DepedLogo} alt="DepEd Logo" />
                <h2 className="header-title">Teacher's Report Management System</h2>
            </div>
            <div className="header-right">
                <h2 className="header-title">{userText}</h2>
                <img src={Notification} alt="" />
            </div>
        </header>
    )
}

function Sidebar({activeLink}){
    return (
        <>
        <div className="sidebar">
            <ul className="sidebar-menu">
                <div className="sidebar-menu-container">
                    <div>
                        <li className={`sidebar-item ${activeLink === 'Dashboard' ? 'active' : ''}`}><a href="#">Dashboard</a></li>
                        <li className={`sidebar-item ${activeLink === 'Assessments' ? 'active' : ''}`}><a href="#">Assessments</a></li>
                        <li className={`sidebar-item ${activeLink === 'Classification of Grades' ? 'active' : ''}`}><a href="#">Classification of Grades</a></li>
                        <li className={`sidebar-item ${activeLink === 'Enrollment' ? 'active' : ''}`}><a href="#">Enrollment</a></li>
                    </div>
                    <div className="sidebar-menu-logout">
                        <li className="sidebar-item"><a href="#"><img src={Logout} alt="log out button" /></a></li>
                    </div>
                </div>
            </ul>
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
    return(
    <>
        <h4>Upcoming Deadlines</h4>
        <hr />
        <div className="deadline-container">
            <div className="deadline-item">
                <p className="deadline-title">Quarterly Assessment Report</p>
                <div className="deadline-details">
                    <p>Due: May 06, 2025 <span>7:00pm</span></p>
                </div>
            </div>
        </div>
    </>
    )
}

export default Dashboard;