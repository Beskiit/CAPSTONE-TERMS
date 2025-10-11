import React from "react";
import Sidebar from "../../components/shared/SidebarCoordinator";
import "./AssignedReport.css";
import SidebarPrincipal from "../../components/shared/SidebarPrincipal";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../../components/shared/Header";

function AssignedReportData() {
    const navigate = useNavigate();
    const { submissionId } = useParams();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submission, setSubmission] = useState(null);
    const [error, setError] = useState("");
    const [retryCount, setRetryCount] = useState(0);

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

    useEffect(() => {
        const fetchSubmission = async () => {
            if (!submissionId) return;
            
            try {
                setLoading(true);
                setError("");
                const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");
                
                // Add timeout to prevent hanging requests
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
                
                const res = await fetch(`${API_BASE}/submissions/${submissionId}`, {
                    credentials: "include",
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!res.ok) {
                    if (res.status === 404) {
                        setError("Submission not found. Please check if the submission ID is correct.");
                    } else if (res.status === 500) {
                        setError("Server error. Please try again later.");
                    } else {
                        setError("Failed to load submission. Please try again.");
                    }
                    return;
                }
                
                const data = await res.json();
                setSubmission(data);
            } catch (err) {
                if (err.name === 'AbortError') {
                    setError("Request timed out. Please check your connection and try again.");
                } else {
                    setError("Error loading submission. Please try again.");
                }
                console.error("Error fetching submission:", err);
            } finally {
                setLoading(false);
            }
        };

        if (submissionId) {
            fetchSubmission();
        }
    }, [submissionId, retryCount]);

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
                    {isCoordinator ? (
                        <Sidebar activeLink="Assigned Report" />
                    ) : (
                        <SidebarPrincipal activeLink="Assigned Report" />
                    )}
                    <div className="dashboard-content">
                        <div className="dashboard-main">
                            <div className="loading-container">
                                <div className="loading-spinner"></div>
                                <h2>Loading Submission...</h2>
                                <p>Fetching submission data, please wait...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    const handleRetry = () => {
        setError("");
        setRetryCount(prev => prev + 1);
        // The useEffect will automatically retry when retryCount changes
    };

    if (error || !submission) {
        return (
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
                            <div className="error-container">
                                <h2>Error Loading Submission</h2>
                                <p className="error-message">{error || "Submission not found"}</p>
                                {retryCount < 3 && (
                                    <div className="retry-section">
                                        <button onClick={handleRetry} className="retry-button">
                                            Retry ({3 - retryCount} attempts left)
                                        </button>
                                    </div>
                                )}
                                <div className="action-buttons">
                                    <button onClick={() => navigate(-1)}>Go Back</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

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
                        <h2>Submitted Report Details</h2>
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
                                    
                                    {/* Display table data if it exists */}
                                    {submission.fields.rows && Array.isArray(submission.fields.rows) && (
                                        <div>
                                            <h4>Table Data:</h4>
                                            <div className="table-container">
                                                <table className="submission-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Trait</th>
                                                            {Object.keys(submission.fields.rows[0] || {}).filter(key => key !== 'trait').map(key => (
                                                                <th key={key}>{key.toUpperCase()}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {submission.fields.rows.map((row, index) => (
                                                            <tr key={index}>
                                                                <td className="trait-cell">{row.trait}</td>
                                                                {Object.keys(row).filter(key => key !== 'trait').map(key => (
                                                                    <td key={key} className="data-cell">
                                                                        {row[key] || ''}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
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
                        </div>
                    </div>
                </div>
            </div> 
        </>
    )
}

export default AssignedReportData;