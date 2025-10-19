import React from "react";
import Sidebar from "../../components/shared/SidebarCoordinator";
import "./AssignedReport.css";
import "../../components/shared/StatusBadges.css";
import SidebarPrincipal from "../../components/shared/SidebarPrincipal";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function AssignedReport() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [assignedReports, setAssignedReports] = useState([]);
    const [loadingReports, setLoadingReports] = useState(true);
    const [groupedReports, setGroupedReports] = useState([]);

    const role = (user?.role || "").toLowerCase();
    const isCoordinator = role === "coordinator";

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");
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

    // Fetch assigned reports grouped by assignment
    useEffect(() => {
        const fetchGroupedReports = async () => {
            if (!user?.user_id) return;
            
            try {
                setLoadingReports(true);
                
                // Fetch all report assignments created by this user using existing endpoint
                const assignmentsRes = await fetch(`${API_BASE}/reports/assigned_by/${user.user_id}`, {
                    credentials: "include"
                });
                
                if (!assignmentsRes.ok) {
                    console.error("Failed to fetch report assignments:", assignmentsRes.status);
                    return;
                }
                
                const allReports = await assignmentsRes.json();
                
                // Group reports by assignment_id and calculate submission counts
                const assignmentMap = new Map();
                
                allReports.forEach(report => {
                    const assignmentId = report.report_assignment_id;
                    
                    if (!assignmentMap.has(assignmentId)) {
                        // Initialize assignment with first report data
                        assignmentMap.set(assignmentId, {
                            report_assignment_id: assignmentId,
                            assignment_title: report.assignment_title,
                            category_name: report.category_name,
                            sub_category_name: report.sub_category_name,
                            due_date: report.due_date,
                            to_date: report.to_date,
                            created_at: report.created_at,
                            totalAssigned: 0,
                            submittedCount: 0,
                            reports: []
                        });
                    }
                    
                    // Add this report to the assignment
                    const assignment = assignmentMap.get(assignmentId);
                    assignment.reports.push(report);
                    assignment.totalAssigned++;
                    
                    // Count as submitted if status >= 2
                    if (report.status >= 2) {
                        assignment.submittedCount++;
                    }
                });
                
                // Convert to final format
                const groupedData = Array.from(assignmentMap.values()).map(assignment => ({
                    report_assignment_id: assignment.report_assignment_id,
                    assignment_title: assignment.assignment_title,
                    category_name: assignment.category_name,
                    sub_category_name: assignment.sub_category_name,
                    due_date: assignment.due_date,
                    to_date: assignment.to_date,
                    created_at: assignment.created_at,
                    submitted: assignment.submittedCount,
                    total: assignment.totalAssigned,
                    status: assignment.submittedCount === assignment.totalAssigned && assignment.totalAssigned > 0 ? 'complete' : 'partial',
                    first_submission_id: assignment.reports.length > 0 ? assignment.reports[0].submission_id : null
                }));
                
                setGroupedReports(groupedData);
            } catch (err) {
                console.error("Error fetching grouped reports:", err);
            } finally {
                setLoadingReports(false);
            }
        };

        if (user?.user_id) {
            fetchGroupedReports();
        }
    }, [user?.user_id]);

    return(
        <>
            <Header userText={user ? user.name : "Guest"} />
            <div className="dashboard-container">
                {isCoordinator ? (
                    <Sidebar activeLink="Assigned Report" />
                ) : (
                    <SidebarPrincipal activeLink="Assigned Report" />
                )}
                <div className="dashboard-content">
                    <div className="dashboard-main">
                        <h2>Submitted Report</h2>
                    </div>
                    <div className="content">
                        {loadingReports ? (
                            <p>Loading assigned reports...</p>
                        ) : groupedReports.length === 0 ? (
                            <p>No assigned reports found.</p>
                        ) : (
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>Report Title</th>
                                        <th>Category</th>
                                        <th>Status</th>
                                        <th>Submitted</th>
                                        <th>Due Date</th>
                                        <th>Created Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupedReports.map((report) => (
                                        <tr key={report.report_assignment_id} onClick={() => navigate(`/AssignedReportData/${report.first_submission_id}`)}>
                                            <td className="file-cell">
                                                <span className="file-name">{report.assignment_title || 'Report'}</span>
                                            </td>
                                            <td>
                                                <span className="category-info">
                                                    {report.category_name} - {report.sub_category_name}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`status-badge status-${report.status}`}>
                                                    {report.status === 'complete' ? 'Complete' : 
                                                     report.status === 'rejected' ? 'Rejected' : 'In Progress'}
                                                </span>
                                            </td>
                                            <td className="submission-count">
                                                <span className={`count-badge ${report.status === 'complete' ? 'complete' : 'partial'}`}>
                                                    {report.submitted}/{report.total}
                                                </span>
                                            </td>
                                            <td>{report.to_date || report.due_date || 'No due date'}</td>
                                            <td>{report.created_at ? new Date(report.created_at).toLocaleDateString() : 'N/A'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div> 
        </>
    )
}

export default AssignedReport;