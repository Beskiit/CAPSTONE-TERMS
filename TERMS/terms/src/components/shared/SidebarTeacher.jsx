import React from 'react';
import './SharedComponents.css';
import Logout from '../../assets/logout.svg';
import { Link } from 'react-router-dom'; // Import Link

function SidebarTeacher({ activeLink }) {
    return (
        <div className="sidebar">
            <ul className="sidebar-menu">
                <div className="sidebar-menu-container">
                    <div>
                        <li className={`sidebar-item ${activeLink === 'Dashboard' ? 'active' : ''}`}>
                            <Link to="/DashboardTeacher">Dashboard</Link>
                        </li>
                        <li className={`sidebar-item ${activeLink === 'Assessments' ? 'active' : ''}`}>
                            <a href="#">Assessments</a>
                        </li>
                        <li className={`sidebar-item ${activeLink === 'Classification of Grades' ? 'active' : ''}`}>
                            <Link to="/ClassificationOfGrades">Classification of Grades</Link>
                        </li>
                        <li className={`sidebar-item ${activeLink === 'Enrollment' ? 'active' : ''}`}>
                            <a href="#">Enrollment</a>
                        </li>
                        <li className={`sidebar-item ${activeLink === 'Accomplishment Report' ? 'active' : ''}`}>
                            <a href="/AccomplishmentReport">Accomplishment Report</a>
                        </li>
                    </div>
                    <div className="sidebar-menu-logout">
                        <li className="sidebar-item">
                            <Link to={"/"}><img src={Logout} alt="log out button" /></Link>
                        </li>
                    </div>
                </div>
            </ul>
        </div>
    );
}

export default SidebarTeacher;