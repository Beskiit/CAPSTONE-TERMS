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
                                <Link to="/DashboardPrincipal">Dashboard</Link>
                            </li>
                            <li className={`sidebar-item ${activeLink === 'View Report' ? 'active' : ''}`}>
                                <Link to="/ViewSubmission">View Report</Link>
                            </li>
                            <li className={`sidebar-item ${activeLink === 'Set Report Schedule' ? 'active' : ''}`}>
                                <Link to="/SetReport">Set Report Schedule</Link>
                            </li>
                            <li className={`sidebar-item ${activeLink === 'User Management' ? 'active' : ''}`}>
                                <Link to="/UserManagement">User Management</Link>
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