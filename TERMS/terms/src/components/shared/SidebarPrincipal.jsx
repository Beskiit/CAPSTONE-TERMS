import React, {useState} from 'react';
import './SharedComponents.css';
import Logout from '../../assets/logout.svg';
import { Link } from 'react-router-dom'; // Import Link
import { useAuth } from '../../context/AuthContext';
import { ConfirmationModal } from '../ConfirmationModal';
import DashboardLayout from '../../assets/DashboardLayout.png';
import ReportsViewReports from '../../assets/ReportsViewReports.png';
import Schedule from '../../assets/Schedule.png';
import Assigned from '../../assets/Assigned.png';
import ForApproval from '../../assets/ForApproval.png';


function SidebarCoordinator({ activeLink, style }) {
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
            <div className="sidebar" style={style}>
                <ul className="sidebar-menu">
                    <div className="sidebar-menu-container">
                        <div>
                                   <li className={`sidebar-item ${activeLink === 'Dashboard' ? 'active' : ''}`}>
                                       <Link to="/DashboardPrincipal">
                                           <img src={DashboardLayout} alt="Dashboard" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                                           Dashboard
                                       </Link>
                                   </li>
                            <li className={`sidebar-item ${activeLink === 'View Report' ? 'active' : ''}`}>
                                <Link to="/ViewSubmission">
                                    <img src={ReportsViewReports} alt="View Report" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                                    View Report
                                </Link>
                            </li>
                            <li className={`sidebar-item ${activeLink === 'Set Report Schedule' ? 'active' : ''}`}>
                                <Link to="/SetReport">
                                    <img src={Schedule} alt="Set Report Schedule" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                                    Set Report Schedule
                                </Link>
                            </li>
                            <li className={`sidebar-item ${activeLink === 'Assigned Report' ? 'active' : ''}`}>
                                <Link to="/AssignedReport">
                                    <img src={Assigned} alt="Assigned Reports" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                                    Assigned Reports
                                </Link>
                            </li>
                            <li className={`sidebar-item ${activeLink === 'For Approval' ? 'active' : ''}`}>
                                <Link to="/ForApproval">
                                    <img src={ForApproval} alt="For Approval" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                                    For Approval
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
    )
}

export default SidebarCoordinator;