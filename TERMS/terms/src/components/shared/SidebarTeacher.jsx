import React, {useState} from 'react';
import './SharedComponents.css';
import Logout from '../../assets/logout.svg';
import { Link } from 'react-router-dom'; // Import Link
import { useAuth } from '../../context/AuthContext';
import { ConfirmationModal } from '../ConfirmationModal';
import DashboardLayout from '../../assets/DashboardLayout.png';
import ReportsViewReports from '../../assets/ReportsViewReports.png';
import SubmittedReports from '../../assets/SubmittedReports.png';

function SidebarTeacher({ activeLink }) {
    const [openMenu, setOpenMenu] = useState(null);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const { logout } = useAuth();

    var toggleMenu = (menu) => {
        setOpenMenu(openMenu === menu ? null : menu);
    };

    const handleLogout = () => {
        logout();
    };

    return (
        <>
            <div className="sidebar">
                <ul className="sidebar-menu">
                    <div className="sidebar-menu-container">
                        <div>
                            <li className={`sidebar-item ${activeLink === 'Dashboard' ? 'active' : ''}`}>
                                <Link to="/DashboardTeacher">
                                    <img src={DashboardLayout} alt="Dashboard" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                                    Dashboard
                                </Link>
                            </li>
                            <li className={`sidebar-item ${activeLink === 'Reports' ? 'active' : ''}`}>
                                    <a className={`dropdown-btn ${openMenu === "reports" ? "open" : ""}`} 
                                    onClick={() => toggleMenu('reports')}>
                                        <img src={ReportsViewReports} alt="Reports" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                                        Reports <span className="arrow">{openMenu === "reports" ? "▲" : "▼"}</span>
                                    </a>
                                    {openMenu === "reports" && (
                                        <ul className="dropdown-menu">
                                        <li className={`${activeLink === 'LAEMPL & MPS' ? 'active' : ''}`}><a href="/LAEMPL">LAEMPL & MPS</a></li>
                                        <li className={`${activeLink === 'Accomplishment Report' ? 'active' : ''}`}><a href="/Accomplishment">Accomplishment Report</a></li>
                                        </ul>
                                    )}
                            </li>
                            <li className={`sidebar-item ${activeLink === 'Submitted Report' ? 'active' : ''}`}>
                                    <Link to="/SubmittedReport">
                                        <img src={SubmittedReports} alt="Submitted Reports" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                                        Submitted Reports
                                    </Link>
                            </li>
                        </div>
                        <div className="sidebar-menu-logout">
                            <li className="sidebar-item">
                                <button 
                                    onClick={() => setShowLogoutModal(true)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                                >
                                    <img src={Logout} alt="log out button" />
                                </button>
                            </li>
                        </div>
                    </div>
                </ul>
            </div>

            <ConfirmationModal
                isOpen={showLogoutModal}
                onClose={() => setShowLogoutModal(false)}
                onConfirm={handleLogout}
                title="Confirm Logout"
                message="Are you sure you want to log out?"
                confirmText="Yes"
                cancelText="Cancel"
                type="info"
            />
        </>
    );
}

export default SidebarTeacher;