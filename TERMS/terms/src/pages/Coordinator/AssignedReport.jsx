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

    // Fetch assigned reports with submissions
    useEffect(() => {
        const fetchAssignedReports = async () => {
            if (!user?.user_id) return;
            
            try {
                setLoadingReports(true);
                const res = await fetch(`${API_BASE}/reports/assigned_by/${user.user_id}`, {
                    credentials: "include"
                });
                
                if (!res.ok) {
                    console.error("Failed to fetch assigned reports:", res.status);
                    return;
                }
                
                const data = await res.json();
                setAssignedReports(data);
            } catch (err) {
                console.error("Error fetching assigned reports:", err);
            } finally {
                setLoadingReports(false);
            }
        };

        if (user?.user_id) {
            fetchAssignedReports();
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
                        ) : assignedReports.length === 0 ? (
                            <p>No assigned reports found.</p>
                        ) : (
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>Report Title</th>
                                        <th>Teacher</th>
                                        <th>Status</th>
                                        <th>Due Date</th>
                                        <th>Submitted Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assignedReports.map((report) => (
                                        <tr key={report.submission_id} onClick={() => navigate(`/AssignedReportData/${report.submission_id}`)}>
                                            <td className="file-cell">
                                                <span className="file-name">{report.assignment_title || report.submission_title || 'Report'}</span>
                                            </td>
                                            <td>{report.submitted_by_name || 'Unknown Teacher'}</td>
                                            <td>
                                                <span className={`status-badge status-${report.status}`}>
                                                    {report.status === 0 ? 'Draft' : 
                                                     report.status === 1 ? 'Pending' : 
                                                     report.status === 2 ? 'Submitted' : 
                                                     report.status === 3 ? 'Approved' : 
                                                     report.status === 4 ? 'Rejected' : 'Unknown'}
                                                </span>
                                            </td>
                                            <td>{report.to_date || 'No due date'}</td>
                                            <td>{report.date_submitted || 'Not submitted'}</td>
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