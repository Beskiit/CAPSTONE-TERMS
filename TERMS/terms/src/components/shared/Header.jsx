import React from 'react';
import './SharedComponents.css';
import DepedLogo from '../../assets/deped-logo.png';
import Notification from '../../assets/notification.svg';

function Header({ userText }) {
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
    );
}

export default Header; 