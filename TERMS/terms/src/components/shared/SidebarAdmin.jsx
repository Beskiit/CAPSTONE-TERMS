import React, {useState} from 'react';
import './SharedComponents.css';
import Logout from '../../assets/logout.svg';
import { Link } from 'react-router-dom'; // Import Link
import { useAuth } from '../../context/AuthContext';
import { ConfirmationModal } from '../ConfirmationModal';
import AddSchool from '../../assets/AddSchool.png';
import UserManagement from '../../assets/UserManagement.png';

function SidebarAdmin({ activeLink }) {
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
                            <li className={`sidebar-item ${activeLink === 'User Management' ? 'active' : ''}`}>
                                <Link to="/UserManagement">
                                    <img src={UserManagement} alt="User Management" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                                    User Management
                                </Link>
                            </li>
                            <li className={`sidebar-item ${activeLink === 'Add School' ? 'active' : ''}`}>
                                    <Link to="/AddSchool">
                                        <img src={AddSchool} alt="Add School" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                                        Add School
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

export default SidebarAdmin;