import "./Dashboard.css";
import React from 'react'
import { useState } from 'react'
import DepedLogo from './assets/deped-logo.png';

function Dashboard(){
    return (
        <Header />
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
            </div>
        </header>
    )
}

function Sidebar(){
    return (
        <aside className="sidebar">
            {
                <h1>HHello world</h1>
            }
        </aside>
    )
}

export default Dashboard;