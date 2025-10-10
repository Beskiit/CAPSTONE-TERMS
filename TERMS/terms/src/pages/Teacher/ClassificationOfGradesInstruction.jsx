import React, {useEffect, useState} from "react";
import { Link } from "react-router-dom";
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import './Instruction.css';
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";

function ClassificationOfGradesInstruction() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);


    const role = (user?.role || "").toLowerCase();
    const isTeacher = role === "teacher";

    useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("https://terms-api.kiri8tives.com/auth/me", {
          credentials: "include", // important so session cookie is sent
        });
        if (!res.ok) return; // not logged in
        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }
    };
    fetchUser();
  }, []);

    return (
        <>
        <Header userText={user ? user.name : "Guest"} />
            <div className="dashboard-container">
                {isTeacher ? (
                    <Sidebar activeLink="Classification of Grades" />
                ) : (
                    <SidebarCoordinator activeLink="Classification of Grades" />
                )}
                <div className="dashboard-content">
                    <div className="dashboard-main">
                        <h2>Classification of Grades</h2>
                    </div>
                    <div className="content">
                        <h3 className="header">Instructions</h3>
                        <p className="instruction">This is where the instruction should display.</p>
                        <button className="instruction-btn" onClick={() => navigate('/ClassificationOfGradesReport')}>+ Prepare Report</button>
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

export default ClassificationOfGradesInstruction;