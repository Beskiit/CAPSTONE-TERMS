import React from "react";
import Sidebar from "../../components/shared/SidebarTeacher";
import "./SubmittedReport.css";
import "../../components/shared/StatusBadges.css";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function SubmittedReport() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submissions, setSubmissions] = useState([]);
    const [loadingSubmissions, setLoadingSubmissions] = useState(true);

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

    // Fetch teacher's submitted reports
    useEffect(() => {
        const fetchSubmissions = async () => {
            if (!user?.user_id) return;
            
            try {
                setLoadingSubmissions(true);
                const res = await fetch(`${API_BASE}/submissions/user/${user.user_id}`, {
                    credentials: "include"
                });
                
                if (!res.ok) {
                    console.error("Failed to fetch submissions:", res.status);
                    return;
                }
                
                const data = await res.json();
                setSubmissions(data);
            } catch (err) {
                console.error("Error fetching submissions:", err);
            } finally {
                setLoadingSubmissions(false);
            }
        };

        if (user?.user_id) {
            fetchSubmissions();
        }
    }, [user?.user_id]);
    return(
        <>
            <Header userText={user ? user.name : "Guest"} />
            <div className="dashboard-container">
                {isTeacher ? (
                    <Sidebar activeLink="MPS" />
                ) : (
                    <SidebarCoordinator activeLink="MPS" />
                )}
                <div className="dashboard-content">
                    <div className="dashboard-main">
                        <h2>Submitted Report</h2>
                    </div>
                    <div className="content">
                        {loadingSubmissions ? (
                            <p>Loading submitted reports...</p>
                        ) : submissions.length === 0 ? (
                            <p>No submitted reports found.</p>
                        ) : (
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>Report Title</th>
                                        <th>Status</th>
                                        <th>Date Submitted</th>
                                        <th>Assignment</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {submissions.map((submission) => (
                                        <tr key={submission.submission_id} onClick={() => navigate(`/submission/${submission.submission_id}`)}>
                                            <td className="file-cell">
                                                <span className="file-name">{submission.value || submission.category_name || 'Report'}</span>
                                            </td>
                                            <td>
                                                <span className={`status-badge status-${submission.status}`}>
                                                    {submission.status === 0 ? 'Draft' : 
                                                     submission.status === 1 ? 'Pending' : 
                                                     submission.status === 2 ? 'Submitted' : 
                                                     submission.status === 3 ? 'Approved' : 
                                                     submission.status === 4 ? 'Rejected' : 'Unknown'}
                                                </span>
                                            </td>
                                            <td>{submission.date_submitted || 'Not submitted'}</td>
                                            <td>Assignment #{submission.report_assignment_id || 'N/A'}</td>
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

export default SubmittedReport;