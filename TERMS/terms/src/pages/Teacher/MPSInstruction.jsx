import React from "react";
import { Link } from "react-router-dom";
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import './Instruction.css';
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";

function MPSInstruction() {
    const navigate = useNavigate();

    const role = (localStorage.getItem("role") || "").toLowerCase();
    const isTeacher = role === "teacher";

    return(
        <>
           <Header />
            <div className="dashboard-container">
                {isTeacher ? (
                    <Sidebar activeLink="MPS" />
                ) : (
                    <SidebarCoordinator activeLink="MPS" />
                )}
                <div className="dashboard-content">
                    <div className="dashboard-main">
                        <h2>MPS</h2>
                    </div>
                    <div className="content">
                        <h3 className="header">Instructions</h3>
                        <p className="instruction">This is where the instruction should display.</p>
                        <button className="instruction-btn" onClick={() => navigate('/MPSReport')}>+ Prepare Report</button>
                    </div>
                </div>
                <div className="dashboard-sidebar">
                    <div className="report-card">
                        <h3 className="report-card-header">This is where the name of the report go</h3>
                        <p className="report-card-text">Start Date</p>
                        <p className="report-card-text">Due Date</p>
                    </div>
                    <div className="report-card">
                        <h3 className="report-card-header">Submission</h3>
                        <p className="report-card-text">Submissions: "Number of submission"</p>
                        <p className="report-card-text">Max. Attempts: "Number of Maximum Attempts"</p>
                        <p className="report-card-text">Allow late submissions: "logiccc"</p>
                    </div>
                </div>
            </div> 
        </>
    )
}

export default MPSInstruction;