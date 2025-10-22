import React, {useState} from 'react';
import './SharedComponents.css';
import Logout from '../../assets/logout.svg';
import { Link } from 'react-router-dom'; // Import Link

function SidebarAdmin({ activeLink }) {
    const [openMenu, setOpenMenu] = useState(null);

    var toggleMenu = (menu) => {
        setOpenMenu(openMenu === menu ? null : menu);
    };

    return (
        <div className="sidebar">
            <ul className="sidebar-menu">
                <div className="sidebar-menu-container">
                    <div>
                        <li className={`sidebar-item ${activeLink === 'User Management' ? 'active' : ''}`}>
                            <Link to="/UserManagement">User Management</Link>
                        </li>
                        <li className={`sidebar-item ${activeLink === 'Assign User/Principal' ? 'active' : ''}`}>
                                <Link to="/AssignUser">Assign User/Principal</Link>
                        </li>
                        <li className={`sidebar-item ${activeLink === 'Add School' ? 'active' : ''}`}>
                                <Link to="/AddSchool">Add School</Link>
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

export default SidebarAdmin;