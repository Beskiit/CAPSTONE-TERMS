import React, {useEffect, useMemo, useState} from "react";
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
    
    // Debug: Log state received from navigation
    useEffect(() => {
        console.log("🔍 [LAEMPLInstruction] State received from navigation:", state);
    }, []);
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
    const initialCoordinatorId =
        state?.coordinator_user_id != null && !Number.isNaN(Number(state.coordinator_user_id))
            ? Number(state.coordinator_user_id)
            : state?.coordinatorUserId != null && !Number.isNaN(Number(state.coordinatorUserId))
            ? Number(state.coordinatorUserId)
            : null;
    const [assignedCoordinatorId, setAssignedCoordinatorId] = useState(initialCoordinatorId);
    const initialAssignmentGradeLevelId = 
        state?.grade_level_id != null && !Number.isNaN(Number(state.grade_level_id))
            ? Number(state.grade_level_id)
            : null;
    const [assignmentGradeLevelId, setAssignmentGradeLevelId] = useState(initialAssignmentGradeLevelId);
    const [coordinatorGradeLevelId, setCoordinatorGradeLevelId] = useState(null);
    const initialIsGiven = state?.is_given === 1 || state?.is_given === '1';
    const [assignmentIsGiven, setAssignmentIsGiven] = useState(initialIsGiven);


    const role = (user?.role || "").toLowerCase();
    const isTeacher = role === "teacher";
    const isCoordinator = role === "coordinator";
    
    // Compute forceTeacherView: check state first, then check if coordinator_user_id is null
    const forceTeacherView = useMemo(() => {
        // Check state first
        const v = state?.forceTeacherView;
        if (typeof v === "string" && (v === "true" || v === "1")) return true;
        if (typeof v === "number" && v === 1) return true;
        if (v === true) return true;
        
        // If coordinator and assignedCoordinatorId is null, force teacher view
        if (isCoordinator && assignedCoordinatorId == null && !loading) {
            return true;
        }
        
        return false;
    }, [state?.forceTeacherView, isCoordinator, assignedCoordinatorId, loading]);
    
    const fromAssignedReport = state?.fromAssignedReport === true;
    const recipientsCount = Number(state?.recipients_count || 0);
    const isGivenFlag = state?.is_given === 1 || state?.is_given === '1';
    
    // Debug logging - moved to useEffect to log after user is fetched
    const onPrepare = () => {
        navigate(`/LAEMPLReport?id=${submissionId || ''}`);
    };

    const onSetAsReport = () => {
        // Check both state and assignment data for is_given value
        const isGiven = assignmentIsGiven || state?.is_given === 1 || state?.is_given === '1';
        if (isGiven) {
            toast.error("This report has already been given to teachers.");
            return;
        }
        if (!reportAssignmentId) {
            toast.error("Missing report assignment ID.");
            return;
        }
        navigate(`/SetReport?reportId=${reportAssignmentId}&isPrincipalReport=true`, {
            state: {
                fromAssignedReport: true,
                prefillData: true,
                forceCreate: true,
                parentAssignmentId: reportAssignmentId
            }
        });
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

    useEffect(() => {
        if (!reportAssignmentId) return;

        const fetchAssignmentData = async () => {
            try {
                const res = await fetch(`${API_BASE}/reports/assignment/${reportAssignmentId}`, {
                    credentials: "include"
                });
                if (!res.ok) return;
                const assignment = await res.json();
                
                // Set coordinator_user_id if available
                if (assignment?.coordinator_user_id != null && assignedCoordinatorId == null) {
                    setAssignedCoordinatorId(Number(assignment.coordinator_user_id));
                }
                
                // Set assignment grade level
                if (assignment?.grade_level_id != null) {
                    setAssignmentGradeLevelId(Number(assignment.grade_level_id));
                }
                
                // Set assignment is_given flag
                if (assignment?.is_given != null) {
                    setAssignmentIsGiven(assignment.is_given === 1 || assignment.is_given === '1');
                }
            } catch (err) {
                console.warn("[LAEMPLInstruction] Failed to fetch assignment data:", err);
            }
        };

        fetchAssignmentData();
    }, [reportAssignmentId, assignedCoordinatorId]);

    // Fetch coordinator's assigned grade level
    useEffect(() => {
        if (!isCoordinator || !user?.user_id) return;
        if (coordinatorGradeLevelId != null) return;

        const fetchCoordinatorGrade = async () => {
            try {
                const res = await fetch(`${API_BASE}/reports/laempl-mps/coordinator-grade`, {
                    credentials: "include"
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data?.grade_level_id != null) {
                        setCoordinatorGradeLevelId(Number(data.grade_level_id));
                    }
                }
            } catch (err) {
                console.warn("[LAEMPLInstruction] Failed to fetch coordinator grade level:", err);
            }
        };

        fetchCoordinatorGrade();
    }, [isCoordinator, user, coordinatorGradeLevelId]);

    const isAssignedCoordinator = useMemo(() => {
        if (!isCoordinator) return false;
        if (!user?.user_id) return false;
        
        // Only check coordinator_user_id - if it's null or doesn't match, coordinator acts as teacher
        // No grade level fallback - coordinator_user_id must explicitly match
        if (assignedCoordinatorId != null) {
            return Number(assignedCoordinatorId) === Number(user.user_id);
        }
        
        // If assignedCoordinatorId is null, coordinator is NOT the assigned coordinator
        return false;
    }, [isCoordinator, assignedCoordinatorId, user]);

    const canSetReportToTeachers = useMemo(() => {
        if (loading) {
            console.log("❌ [canSetReportToTeachers] Blocked: loading");
            return false;
        }
        if (!isCoordinator) {
            console.log("❌ [canSetReportToTeachers] Blocked: not coordinator");
            return false;
        }
        if (forceTeacherView) {
            console.log("❌ [canSetReportToTeachers] Blocked: forceTeacherView");
            return false;
        }
        // Removed isGivenFlag check - button should show even if report is already given
        // The toast will be shown in onSetAsReport if is_given = 1
        if (recipientsCount >= 2) {
            console.log("❌ [canSetReportToTeachers] Blocked: recipientsCount >= 2");
            return false;
        }
        
        // If coordinator IS the assigned coordinator, they should see the button
        // even if they have a submission (they can distribute to other teachers)
        // even if is_given = 1 (toast will show when clicked)
        if (isAssignedCoordinator) {
            console.log("✅ [canSetReportToTeachers] Allowed: isAssignedCoordinator = true");
            return true;
        }
        
        // If coordinator has a submission AND they're NOT the assigned coordinator,
        // they're acting as a teacher and should NOT see the button
        if (submissionId) {
            console.log("❌ [canSetReportToTeachers] Blocked: has submission and not assigned coordinator");
            return false;
        }
        
        // If there's an assigned coordinator and it's NOT the current user,
        // then the current coordinator is acting as a teacher (recipient)
        // and should NOT see the "Set as Report to Teachers" button
        if (assignedCoordinatorId != null && !isAssignedCoordinator) {
            console.log("❌ [canSetReportToTeachers] Blocked: different coordinator assigned");
            return false;
        }
        
        // Show button if coordinator IS the assigned coordinator for this report
        // (checked by coordinator_user_id match OR grade level match as fallback)
        console.log("✅ [canSetReportToTeachers] Allowed: isAssignedCoordinator = true (fallback)");
        return isAssignedCoordinator;
    }, [loading, isCoordinator, forceTeacherView, recipientsCount, assignedCoordinatorId, isAssignedCoordinator, submissionId, assignmentGradeLevelId, coordinatorGradeLevelId]);

    // Debug logging - log after user and assignment data are loaded
    useEffect(() => {
        if (loading) return;
        console.log("🔍 [LAEMPLInstruction] Full State Check:", {
            user: user,
            userId: user?.user_id,
            role: role,
            isCoordinator: isCoordinator,
            forceTeacherView: forceTeacherView,
            assignedCoordinatorId: assignedCoordinatorId,
            assignmentGradeLevelId: assignmentGradeLevelId,
            coordinatorGradeLevelId: coordinatorGradeLevelId,
            isAssignedCoordinator: isAssignedCoordinator,
            submissionId: submissionId,
            recipientsCount: recipientsCount,
            isGivenFlag: isGivenFlag,
            canSetReportToTeachers: canSetReportToTeachers,
            buttonShouldShow: canSetReportToTeachers
        });
    }, [loading, user, role, isCoordinator, forceTeacherView, assignedCoordinatorId, assignmentGradeLevelId, coordinatorGradeLevelId, isAssignedCoordinator, submissionId, recipientsCount, isGivenFlag, canSetReportToTeachers]);

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
                                        {canSetReportToTeachers && (
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