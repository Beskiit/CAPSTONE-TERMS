import React from "react";
import { Link } from "react-router-dom";
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import './Instruction.css';
import Header from "../../components/shared/Header.jsx";
import Breadcrumb from "../../components/Breadcrumb.jsx";
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import SidebarPrincipal from "../../components/shared/SidebarPrincipal.jsx";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function AccomplishmentReportInstruction() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const { search, state } = useLocation();

    // ✅ always resolve the id, even on hard reloads
    const qsId = new URLSearchParams(search).get("id");
    const submissionId = qsId ?? state?.submission_id ?? state?.id;
    const reportAssignmentId = state?.report_assignment_id;

    const title = state?.title;
    const instruction = state?.instruction;
    const fromDate = state?.from_date;
    const toDate = state?.to_date;
    const attempts = state?.number_of_submission;
    const allowLate = state?.allow_late;

    const role = (user?.role || "").toLowerCase();
    const forceTeacherView = state?.forceTeacherView === true && role !== "principal";
    const isTeacherSidebar = role === "teacher"; // Sidebar should reflect real role
    const isCoordinatorSidebar = role === "coordinator";
    const isPrincipalSidebar = role === "principal";


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

    const ensureAndOpenTemplate = async () => {
        try {
            const recipients = Number(state?.recipients_count || 0);
            const isPrincipal = (user?.role || '').toLowerCase() === 'principal';
            // If principal and consolidation flow (>=2 recipients), ensure a submission exists
            if (isPrincipal && recipients >= 2 && reportAssignmentId) {
                // 1) Try to fetch mine
                const r = await fetch(`${API_BASE}/submissions/by-assignment/${reportAssignmentId}/mine`, { credentials: 'include' });
                if (r.ok) {
                    const j = await r.json();
                    const sid = j?.submission_id || j?.id;
                    if (sid) {
                        return navigate(`/AccomplishmentReport?id=${sid}&forceTeacher=${(forceTeacherView && (user?.role||'').toLowerCase() !== 'principal') ? '1' : '0'}`, { state: { ...state, breadcrumbTitle: title, report_assignment_id: reportAssignmentId } });
                    }
                }
                // 2) Create one
                const c = await fetch(`${API_BASE}/submissions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ report_assignment_id: reportAssignmentId })
                });
                if (c.ok) {
                    const j = await c.json();
                    const sid = j?.submission_id || j?.id;
                    if (sid) {
                        return navigate(`/AccomplishmentReport?id=${sid}&forceTeacher=${(forceTeacherView && (user?.role||'').toLowerCase() !== 'principal') ? '1' : '0'}`, { state: { ...state, breadcrumbTitle: title, report_assignment_id: reportAssignmentId } });
                    }
                }
                // If both fail, fall back to template without id
            }
            // Non-principal or < 2 recipients fallback
            navigate(`/AccomplishmentReport?id=${submissionId || ""}&forceTeacher=${(forceTeacherView && role !== 'principal') ? '1' : '0'}`, { state: { ...state, breadcrumbTitle: title, report_assignment_id: reportAssignmentId } });
        } catch (_) {
            navigate(`/AccomplishmentReport?id=${submissionId || ""}&forceTeacher=${(forceTeacherView && role !== 'principal') ? '1' : '0'}`, { state: { ...state, breadcrumbTitle: title, report_assignment_id: reportAssignmentId } });
        }
    };

    return (
        <>
        <Header userText={user ? user.name : "Guest"} />
            <div className="dashboard-container">
                {isTeacherSidebar && <Sidebar activeLink="Accomplishment Report" />}
                {isCoordinatorSidebar && <SidebarCoordinator activeLink="Accomplishment Report" />}
                {isPrincipalSidebar && <SidebarPrincipal activeLink="Accomplishment Report" />}
                <div className="dashboard-content">
                    <Breadcrumb />
                    <div className="dashboard-main">
                        <h2>Accomplishment Report</h2>
                    </div>
                    <div className="content">
                        <h3 className="header">Instructions</h3>
                        <p className="instruction">{instruction || "No instruction provided."}</p>
                        <button className="instruction-btn" onClick={ensureAndOpenTemplate}>
                            + Prepare Report</button>
                    </div>
                </div>
            </div> 
        </>
    )
}

export default AccomplishmentReportInstruction;