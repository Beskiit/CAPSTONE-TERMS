import React, {useEffect, useState} from "react";
import { Link } from "react-router-dom";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import './Instruction.css';
import Header from "../../components/shared/Header.jsx";
import Breadcrumb from "../../components/Breadcrumb.jsx";
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import toast from "react-hot-toast";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function LAEMPLInstruction() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const assignmentId = state?.id;
    const submissionId = state?.submission_id;
    const reportAssignmentId = state?.report_assignment_id || assignmentId;
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
    const isCoordinator = role === "coordinator";
    const forceTeacherView = state?.forceTeacherView === true;
    const recipientsCount = Number(state?.recipients_count || 0);
    const isGivenFlag = state?.is_given === 1 || state?.is_given === '1';
    const onPrepare = () => {
        navigate(`/LAEMPLReport?id=${submissionId || ''}`);
    };

    const onSetAsReport = () => {
        const isGiven = state?.is_given === 1 || state?.is_given === '1';
        if (isCoordinator && isGiven) {
            toast.error("This report has already been given to teachers.");
            return;
        }
        if (!reportAssignmentId) {
            toast.error("Missing report assignment ID.");
            return;
        }
        navigate(`/SetReport?reportId=${reportAssignmentId}&isPrincipalReport=true`);
    };

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
                    <Breadcrumb />
                    <div className="dashboard-main">
                        <h2>LAEMPL</h2>
                    </div>
                    <div className="content">
                        <h3 className="header">Instructions</h3>
                        <p className="instruction">{instruction || "No instruction provided."}</p>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <button className="instruction-btn" onClick={onPrepare}>+ Prepare Report</button>
                            {isCoordinator && !forceTeacherView && recipientsCount < 2 && (
                                <button className="instruction-btn" onClick={onSetAsReport}>Set as Report to Teachers</button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default LAEMPLInstruction;