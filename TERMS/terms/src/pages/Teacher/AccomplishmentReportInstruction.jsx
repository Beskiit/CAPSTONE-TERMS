import React from "react";
import { Link } from "react-router-dom";
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import './Instruction.css';
import Header from "../../components/shared/Header.jsx";
import toast from "react-hot-toast";
import Breadcrumb from "../../components/Breadcrumb.jsx";
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import SidebarPrincipal from "../../components/shared/SidebarPrincipal.jsx";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function AccomplishmentReportInstruction() {
    const navigate = useNavigate();
    const formatDateOnly = (val) => {
        if (!val) return 'N/A';
        try {
            const d = new Date(val);
            if (Number.isNaN(d.getTime())) return String(val).split('T')[0] || String(val);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${mm}/${dd}/${yyyy}`;
        } catch {
            return String(val).split('T')[0] || String(val);
        }
    };
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
    const recipientsCount = Number(state?.recipients_count || 0);
    const isGivenFlag = state?.is_given === 1 || state?.is_given === '1';
    const fromAssignedReport = state?.fromAssignedReport === true;


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

    const handleSetAsReport = () => {
        const isGiven = state?.is_given === 1 || state?.is_given === '1';
        if (isCoordinatorSidebar && isGiven) {
            toast.error("This report has already been given to teachers.");
            return;
        }
        if (!reportAssignmentId) {
            toast.error("Missing report assignment ID.");
            return;
        }
        // Only meaningful for coordinators, but harmless otherwise
        navigate(`/SetReport?reportId=${reportAssignmentId}&isPrincipalReport=true`);
    };

    const handleViewSubmission = () => {
        // Use submissionId if available, otherwise fallback to reportAssignmentId
        const idToUse = submissionId || reportAssignmentId;
        if (idToUse) {
            navigate(`/AssignedReportData/${idToUse}`, { 
                state: { 
                    assignmentTitle: title,
                    report_assignment_id: reportAssignmentId
                } 
            });
        } else {
            toast.error("Unable to view submission: missing assignment or submission ID.");
        }
    };

    const handleEdit = async () => {
        if (!reportAssignmentId) {
            toast.error("Missing report assignment ID.");
            return;
        }
        
        try {
            // Fetch full assignment details to pass to SetReport
            const res = await fetch(`${API_BASE}/reports/assignment/${reportAssignmentId}`, {
                credentials: "include"
            });
            
            if (res.ok) {
                const assignmentData = await res.json();
                
                // Also fetch submissions to get assignees
                const subRes = await fetch(`${API_BASE}/submissions/by-assignment/${reportAssignmentId}`, {
                    credentials: "include"
                });
                
                let assignees = [];
                if (subRes.ok) {
                    const submissions = await subRes.json();
                    // Get unique submitted_by user IDs
                    assignees = [...new Set(submissions.map(s => s.submitted_by).filter(Boolean))];
                }
                
                // Navigate with all assignment data in state
                navigate(`/SetReport?reportId=${reportAssignmentId}&isPrincipalReport=true`, {
                    state: {
                        assignmentData: assignmentData,
                        assignees: assignees,
                        prefillData: true, // Flag to indicate data should be pre-filled
                        fromAssignedReport: fromAssignedReport // Pass the flag to allow editing even if is_given = 1
                    }
                });
            } else {
                // Fallback to just passing reportId
                navigate(`/SetReport?reportId=${reportAssignmentId}&isPrincipalReport=true`);
            }
        } catch (error) {
            console.error("Error fetching assignment data:", error);
            // Fallback to just passing reportId
            navigate(`/SetReport?reportId=${reportAssignmentId}&isPrincipalReport=true`);
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
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div className="content" style={{ flex: 1 }}>
                            <h3 className="header">Instructions</h3>
                            <p className="instruction">{instruction || "No instruction provided."}</p>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                {fromAssignedReport ? (
                                    <>
                                        <button className="instruction-btn" onClick={handleViewSubmission}>View Submission</button>
                                        <button className="instruction-btn" onClick={handleEdit}>Edit</button>
                                    </>
                                ) : (
                                    <>
                                        <button className="instruction-btn" onClick={ensureAndOpenTemplate}>+ Prepare Report</button>
                                        {isCoordinatorSidebar && !forceTeacherView && recipientsCount < 2 && (
                                            <button className="instruction-btn" onClick={handleSetAsReport}>Set as Report to Teachers</button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                        <div style={{ width: '300px', backgroundColor: '#fff', borderRadius: '8px', padding: '16px', border: '1px solid #ccc' }}>
                            <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #ccc' }}>
                                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold' }}>Assignment</h3>
                                <div style={{ marginBottom: '8px' }}>
                                    <span style={{ fontWeight: '500' }}>Type:</span> <span>{state?.category_name || category_name || 'N/A'}</span>
                                </div>
                            </div>
                            <div>
                                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold' }}>Details</h3>
                                <div style={{ marginBottom: '8px' }}>
                                    <span style={{ fontWeight: '500' }}>Title:</span> <span>{title || 'N/A'}</span>
                                </div>
                                <div style={{ marginBottom: '8px' }}>
                                    <span style={{ fontWeight: '500' }}>Start Date:</span> <span>{formatDateOnly(fromDate)}</span>
                                </div>
                                <div style={{ marginBottom: '8px' }}>
                                    <span style={{ fontWeight: '500' }}>Due Date:</span> <span>{formatDateOnly(toDate)}</span>
                                </div>
                                <div style={{ marginBottom: '8px' }}>
                                    <span style={{ fontWeight: '500' }}>Report Type:</span> <span>{state?.sub_category_name || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div> 
        </>
    )
}

export default AccomplishmentReportInstruction;