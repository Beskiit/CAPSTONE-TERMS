import React, {useState} from 'react';
import './SharedComponents.css';
import Logout from '../../assets/logout.svg';
import { Link } from 'react-router-dom'; // Import Link


function SidebarCoordinator({ activeLink, style }) {
    const [openMenu, setOpenMenu] = useState(null);

    var toggleMenu = (menu) => {
        setOpenMenu(openMenu === menu ? null : menu);
    };

    return (
        <>
            <div className="sidebar" style={style}>
                <ul className="sidebar-menu">
                    <div className="sidebar-menu-container">
                        <div>
                            <li className={`sidebar-item ${activeLink === 'Dashboard' ? 'active' : ''}`}>
                                <Link to="/DashboardCoordinator">Dashboard</Link>
                            </li>
                            <li className={`sidebar-item ${activeLink === 'Reports' ? 'active' : ''}`}>
                                <a className={`dropdown-btn ${openMenu === "reports" ? "open" : ""}`} 
                                onClick={() => toggleMenu('reports')}>
                                    Reports <span className="arrow">{openMenu === "reports" ? "▲" : "▼"}</span>
                                </a>
                                {openMenu === "reports" && (
                                    <ul className="dropdown-menu">
                                    <li className={`${activeLink === 'LAEMPL' ? 'active' : ''}`}><a href="/LAEMPL">LAEMPL</a></li>
                                    <li className={`${activeLink === 'MPS' ? 'active' : ''}`}><a href="/MPS">MPS</a></li>
                                    <li><a href="/Accomplishment">Accomplishment Report</a></li>
                                    </ul>
                                )}
                            </li>
                            <li className={`sidebar-item ${activeLink === 'Set Report Schedule' ? 'active' : ''}`}>
                                <Link to="/SetReport">Set Report Schedule</Link>
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
        </>
    )
}

export default SidebarCoordinator;