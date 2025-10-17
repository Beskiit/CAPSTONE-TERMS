import React from "react";
import Sidebar from "../../components/shared/SidebarPrincipal";
import "./ForApproval.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function ForApproval() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

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

  // Fetch submissions for principal approval
  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/submissions/for-principal-approval`, {
          credentials: "include"
        });
        
        if (!res.ok) {
          throw new Error('Failed to fetch submissions');
        }
        
        const data = await res.json();
        setSubmissions(data);
      } catch (err) {
        console.error("Error fetching submissions:", err);
        setError("Failed to load submissions");
      } finally {
        setLoading(false);
      }
    };

    if (user?.role?.toLowerCase() === 'principal') {
      fetchSubmissions();
    }
  }, [user]);
    return(
        <>
            <Header userText={user ? user.name : "Guest"} />
            <div className="dashboard-container">
                <Sidebar activeLink="For Approval" />
                <div className="dashboard-content">
                    <div className="dashboard-main">
                        <h2>Submitted Report</h2>
                    </div>
                    <div className="content">
                        {loading ? (
                            <div className="loading-container">
                                <div className="loading-spinner"></div>
                                <p>Loading submissions...</p>
                            </div>
                        ) : error ? (
                            <div className="error-message">
                                <p>{error}</p>
                                <button onClick={() => window.location.reload()}>Retry</button>
                            </div>
                        ) : submissions.length === 0 ? (
                            <div className="no-submissions">
                                <p>No submissions pending approval.</p>
                            </div>
                        ) : (
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>Report Title</th>
                                        <th>Submitted By</th>
                                        <th>Due Date</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {submissions.map((submission) => (
                                        <tr key={submission.submission_id} onClick={() => navigate(`/ForApprovalData?id=${submission.submission_id}`)}>
                                            <td className="file-cell">
                                                <span className="file-name">{submission.title || submission.assignment_title || 'Report'}</span>
                                            </td>
                                            <td>{submission.submitted_by_name || 'Unknown'}</td>
                                            <td>{submission.due_date || 'No due date'}</td>
                                            <td>
                                                <span className="status-badge status-completed">
                                                    Completed
                                                </span>
                                            </td>
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

export default ForApproval;