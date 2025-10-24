import React, {useEffect, useState} from "react";
import { Link } from "react-router-dom";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import './Instruction.css';
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function LAEMPLInstruction() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const assignmentId = state?.id;
    const submissionId = state?.submission_id;
    const title = state?.title;
    const instruction = state?.instruction;
    const fromDate = state?.from_date;
    const toDate = state?.to_date;
    const attempts = state?.number_of_submission;
    const allowLate = state?.allow_late;

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);


    const role = (user?.role || "").toLowerCase();
    const isTeacher = role === "teacher";

    useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
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
                    <Sidebar activeLink="LAEMPL" />
                ) : (
                    <SidebarCoordinator activeLink="LAEMPL" />
                )}
                <div className="dashboard-content">
                    <div className="dashboard-main">
                        <h2>LAEMPL</h2>
                    </div>
                    <div className="content">
                        <h3 className="header">Instructions</h3>
                        <p className="instruction">{instruction || "No instruction provided."}</p>
                        <button className="instruction-btn" onClick={() => navigate(`/LAEMPLReport?id=${submissionId || ''}`)}>+ Prepare Report</button>
                    </div>
                </div>
            </div>
        </>
    )
}

export default LAEMPLInstruction;