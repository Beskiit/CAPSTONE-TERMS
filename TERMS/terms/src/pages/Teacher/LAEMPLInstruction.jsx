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
    const fromAssignedReport = state?.fromAssignedReport === true;
    const recipientsCount = Number(state?.recipients_count || 0);
    const isGivenFlag = state?.is_given === 1 || state?.is_given === '1';
    
    // Debug logging
    console.log("[LAEMPLInstruction] User:", user);
    console.log("[LAEMPLInstruction] Role:", role);
    console.log("[LAEMPLInstruction] isCoordinator:", isCoordinator);
    console.log("[LAEMPLInstruction] forceTeacherView:", forceTeacherView);
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

    const handleViewSubmission = () => {
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
            const res = await fetch(`${API_BASE}/reports/assignment/${reportAssignmentId}`, {
                credentials: "include"
            });
            
            if (res.ok) {
                const assignmentData = await res.json();
                
                // Fetch submissions to get assignees for prefill
                const subRes = await fetch(`${API_BASE}/submissions/by-assignment/${reportAssignmentId}`, {
                    credentials: "include"
                });
                
                let assignees = [];
                if (subRes.ok) {
                    const submissions = await subRes.json();
                    assignees = [...new Set(submissions.map(s => s.submitted_by).filter(Boolean))];
                }
                
                navigate(`/SetReport?reportId=${reportAssignmentId}&isPrincipalReport=true`, {
                    state: {
                        assignmentData,
                        assignees,
                        prefillData: true,
                        fromAssignedReport: fromAssignedReport
                    }
                });
            } else {
                navigate(`/SetReport?reportId=${reportAssignmentId}&isPrincipalReport=true`);
            }
        } catch (error) {
            console.error("Error fetching assignment data:", error);
            navigate(`/SetReport?reportId=${reportAssignmentId}&isPrincipalReport=true`);
        }
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
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch user:", err);
        setLoading(false);
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
                                        <button className="instruction-btn" onClick={onPrepare}>+ Prepare Report</button>
                                        {!loading && isCoordinator && (
                                            <button className="instruction-btn" onClick={onSetAsReport}>Set as Report to Teachers</button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                        <div style={{ width: '300px', backgroundColor: '#fff', borderRadius: '8px', padding: '16px', border: '1px solid #ccc' }}>
                            <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #ccc' }}>
                                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold' }}>Assignment</h3>
                                <div style={{ marginBottom: '8px' }}>
                                    <span style={{ fontWeight: '500' }}>Type:</span>{" "}
                                    <span>{state?.category_name || "Quarterly Achievement Test"}</span>
                                </div>
                            </div>
                            <div>
                                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold' }}>Details</h3>
                                <div style={{ marginBottom: '8px' }}>
                                    <span style={{ fontWeight: '500' }}>Title:</span>{" "}
                                    <span>{title || 'N/A'}</span>
                                </div>
                                <div style={{ marginBottom: '8px' }}>
                                    <span style={{ fontWeight: '500' }}>Start Date:</span>{" "}
                                    <span>{formatDateOnly(fromDate)}</span>
                                </div>
                                <div style={{ marginBottom: '8px' }}>
                                    <span style={{ fontWeight: '500' }}>Due Date:</span>{" "}
                                    <span>{formatDateOnly(toDate)}</span>
                                </div>
                                <div style={{ marginBottom: '8px' }}>
                                    <span style={{ fontWeight: '500' }}>Report Type:</span>{" "}
                                    <span>{state?.sub_category_name || state?.subject_name || 'LAEMPL & MPS'}</span>
                                </div>
                                {state?.subject_name && (
                                    <div style={{ marginBottom: '8px' }}>
                                        <span style={{ fontWeight: '500' }}>Subject:</span>{" "}
                                        <span>{state.subject_name}</span>
                                    </div>
                                )}
                                {state?.grade_level_name && (
                                    <div style={{ marginBottom: '8px' }}>
                                        <span style={{ fontWeight: '500' }}>Grade Level:</span>{" "}
                                        <span>{state.grade_level_name}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default LAEMPLInstruction;