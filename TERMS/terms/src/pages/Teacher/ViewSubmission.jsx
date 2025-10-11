import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header";
import Sidebar from "../../components/shared/SidebarTeacher";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator";
import "../../components/shared/StatusBadges.css";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function ViewSubmission() {
    const { submissionId } = useParams();
    const navigate = useNavigate();
    
    const [user, setUser] = useState(null);
    const [submission, setSubmission] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const role = (user?.role || "").toLowerCase();
    const isTeacher = role === "teacher";
    const isCoordinator = role === "coordinator";

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch(`${API_BASE}/auth/me`, {
                    credentials: "include",
                });
                if (!res.ok) return;
                const data = await res.json();
                setUser(data);
            } catch (err) {
                console.error("Failed to fetch user:", err);
            }
        };
        fetchUser();
    }, []);

    useEffect(() => {
        const fetchSubmission = async () => {
            if (!submissionId) return;
            
            try {
                setLoading(true);
                const res = await fetch(`${API_BASE}/submissions/${submissionId}`, {
                    credentials: "include"
                });
                
                if (!res.ok) {
                    setError("Failed to load submission");
                    return;
                }
                
                const data = await res.json();
                setSubmission(data);
            } catch (err) {
                setError("Error loading submission");
                console.error("Error fetching submission:", err);
            } finally {
                setLoading(false);
            }
        };

        if (submissionId) {
            fetchSubmission();
        }
    }, [submissionId]);

    const getStatusText = (status) => {
        switch (status) {
            case 0: return 'Draft';
            case 1: return 'Pending';
            case 2: return 'Submitted';
            case 3: return 'Approved';
            case 4: return 'Rejected';
            default: return 'Unknown';
        }
    };

    if (loading) {
        return (
            <>
                <Header userText={user ? user.name : "Guest"} />
                <div className="dashboard-container">
                    <div className="dashboard-content">
                        <div className="dashboard-main">
                            <h2>Loading Submission...</h2>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    if (error || !submission) {
        return (
            <>
                <Header userText={user ? user.name : "Guest"} />
                <div className="dashboard-container">
                    <div className="dashboard-content">
                        <div className="dashboard-main">
                            <h2>Error</h2>
                            <p>{error || "Submission not found"}</p>
                            <button onClick={() => navigate(-1)}>Go Back</button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Header userText={user ? user.name : "Guest"} />
            <div className="dashboard-container">
                {isTeacher ? (
                    <Sidebar activeLink="Submitted Report" />
                ) : (
                    <SidebarCoordinator activeLink="Assigned Report" />
                )}
                <div className="dashboard-content">
                    <div className="dashboard-main">
                        <h2>Submission Details</h2>
                        <div className="submission-details">
                            <div className="detail-row">
                                <label>Submission ID:</label>
                                <span>{submission.submission_id}</span>
                            </div>
                            <div className="detail-row">
                                <label>Title:</label>
                                <span>{submission.value || 'Report'}</span>
                            </div>
                            <div className="detail-row">
                                <label>Status:</label>
                                <span className={`status-badge status-${submission.status}`}>
                                    {getStatusText(submission.status)}
                                </span>
                            </div>
                            <div className="detail-row">
                                <label>Date Submitted:</label>
                                <span>{submission.date_submitted || 'Not submitted'}</span>
                            </div>
                            <div className="detail-row">
                                <label>Assignment ID:</label>
                                <span>{submission.report_assignment_id || 'N/A'}</span>
                            </div>
                        </div>
                        
                        {submission.fields && (
                            <div className="submission-content">
                                <h3>Content</h3>
                                <div className="content-section">
                                    {submission.fields.narrative && (
                                        <div>
                                            <h4>Narrative:</h4>
                                            <p>{submission.fields.narrative}</p>
                                        </div>
                                    )}
                                    {submission.fields.images && submission.fields.images.length > 0 && (
                                        <div>
                                            <h4>Images:</h4>
                                            <div className="image-gallery">
                                                {submission.fields.images.map((img, index) => (
                                                    <div key={index} className="image-item">
                                                        <img src={img.url || img} alt={`Submission image ${index + 1}`} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        <div className="action-buttons">
                            <button onClick={() => navigate(-1)}>Go Back</button>
                            {isTeacher && submission.status < 2 && (
                                <button onClick={() => navigate(`/AccomplishmentReport/${submissionId}`)}>
                                    Edit Submission
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default ViewSubmission;
