import React from 'react';
import './SharedComponents.css';
import Logout from '../../assets/logout.svg';

function Sidebar({ activeLink }) {
    return (
        <div className="sidebar">
            <ul className="sidebar-menu">
                <div className="sidebar-menu-container">
                    <div>
                        <li className={`sidebar-item ${activeLink === 'Dashboard' ? 'active' : ''}`}>
                            <a href="#">Dashboard</a>
                        </li>
                        <li className={`sidebar-item ${activeLink === 'Assessments' ? 'active' : ''}`}>
                            <a href="#">Assessments</a>
                        </li>
                        <li className={`sidebar-item ${activeLink === 'Classification of Grades' ? 'active' : ''}`}>
                            <a href="#">Classification of Grades</a>
                        </li>
                        <li className={`sidebar-item ${activeLink === 'Enrollment' ? 'active' : ''}`}>
                            <a href="#">Enrollment</a>
                        </li>
                    </div>
                    <div className="sidebar-menu-logout">
                        <li className="sidebar-item">
                            <a href="#"><img src={Logout} alt="log out button" /></a>
                        </li>
                    </div>
                </div>
            </ul>
        </div>
    );
}

export default Sidebar; 