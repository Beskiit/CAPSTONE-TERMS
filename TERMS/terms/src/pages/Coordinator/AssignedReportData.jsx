import React from "react";
import Sidebar from "../../components/shared/SidebarCoordinator";
import "./AssignedReport.css";
import SidebarPrincipal from "../../components/shared/SidebarPrincipal";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../../components/shared/Header";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import toast from "react-hot-toast";

function AssignedReportData() {
    const navigate = useNavigate();
    const { submissionId } = useParams();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submission, setSubmission] = useState(null);
    const [error, setError] = useState("");
    const [retryCount, setRetryCount] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [submitMessage, setSubmitMessage] = useState("");

    // New states for assignment navigation
    const [allSubmissions, setAllSubmissions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [assignmentInfo, setAssignmentInfo] = useState(null);

    // Confirmation Modal
    const [showSubmitModal, setShowSubmitModal] = useState(false);

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
        const fetchAssignmentData = async () => {
            if (!submissionId) return;
            
            // Check if we already have this submission in our allSubmissions array
            if (allSubmissions.length > 0) {
                const existingSubmission = allSubmissions.find(sub => sub.submission_id == submissionId);
                if (existingSubmission) {
                    console.log('Submission already loaded, using existing data');
                    setSubmission(existingSubmission);
                    
                    // Update current index
                    const newIndex = allSubmissions.findIndex(sub => sub.submission_id == submissionId);
                    setCurrentIndex(newIndex >= 0 ? newIndex : 0);
                    return;
                }
            }
            
            try {
                setLoading(true);
                setError("");
                const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");
                
                // First, try to fetch the individual submission to get assignment info
                const res = await fetch(`${API_BASE}/submissions/${submissionId}`, {
                    credentials: "include"
                });
                
                if (!res.ok) {
                    setError("Submission not found.");
                    return;
                }
                
                const submissionData = await res.json();
                setSubmission(submissionData);
                
                // Fetch all submissions for this user and filter by assignment
                let assignmentReports = [];
                
                try {
                    const submissionsRes = await fetch(`${API_BASE}/reports/assigned_by/${user?.user_id}`, {
                        credentials: "include"
                    });
                    
                    if (submissionsRes.ok) {
                        const allReports = await submissionsRes.json();
                        console.log('All reports from assigned_by endpoint:', allReports.length);
                        
                        // Filter reports for the same assignment
                        assignmentReports = allReports.filter(report => 
                            report.report_assignment_id == submissionData.report_assignment_id
                        );
                        
                        console.log('Assignment ID we\'re looking for:', submissionData.report_assignment_id);
                        console.log('Found submissions for assignment:', assignmentReports.length);
                        console.log('Assignment reports:', assignmentReports);
                        
                        // Debug: show all assignment IDs in the reports
                        const allAssignmentIds = allReports.map(r => r.report_assignment_id);
                        console.log('All assignment IDs in reports:', [...new Set(allAssignmentIds)]);
                    }
                } catch (err) {
                    console.log('Error fetching assignment submissions:', err);
                }
                
                console.log('Assignment ID from submission:', submissionData.report_assignment_id);
                console.log('Final assignment reports:', assignmentReports);
                
                if (assignmentReports.length > 0) {
                    
                    // Always set assignment info if we have it
                    if (submissionData.report_assignment_id) {
                        setAssignmentInfo({
                            assignment_title: submissionData.assignment_title || submissionData.value || 'Report Assignment',
                            category_name: submissionData.category_name || 'Unknown Category',
                            sub_category_name: submissionData.sub_category_name || 'Unknown Sub-Category',
                            due_date: submissionData.due_date,
                            to_date: submissionData.to_date
                        });
                    }
                    
                    if (assignmentReports.length > 1) {
                        setAllSubmissions(assignmentReports);
                        
                        // Find current submission index
                        const currentIdx = assignmentReports.findIndex(report => 
                            report.submission_id == submissionId
                        );
                        setCurrentIndex(currentIdx >= 0 ? currentIdx : 0);
                        
                        console.log('Navigation enabled - multiple submissions found');
                    } else {
                        // Single submission, but still show assignment info
                        setAllSubmissions([submissionData]);
                        setCurrentIndex(0);
                        console.log('Single submission - no navigation needed');
                    }
                } else {
                    // Fallback to single submission
                    console.log('No other submissions found, using single submission');
                    setAllSubmissions([submissionData]);
                    setCurrentIndex(0);
                    
                    // Still set assignment info
                    if (submissionData.report_assignment_id) {
                        setAssignmentInfo({
                            assignment_title: submissionData.assignment_title || submissionData.value || 'Report Assignment',
                            category_name: submissionData.category_name || 'Unknown Category',
                            sub_category_name: submissionData.sub_category_name || 'Unknown Sub-Category',
                            due_date: submissionData.due_date,
                            to_date: submissionData.to_date
                        });
                    }
                }
            } catch (err) {
                setError("Error loading data. Please try again.");
                console.error("Error fetching assignment data:", err);
            } finally {
                setLoading(false);
            }
        };

        if (submissionId && user?.user_id) {
            fetchAssignmentData();
        }
    }, [submissionId, user?.user_id, retryCount]);

    // Navigation functions
    const goToNext = async () => {
        if (currentIndex < allSubmissions.length - 1) {
            const nextIndex = currentIndex + 1;
            const nextSubmission = allSubmissions[nextIndex];
            
            console.log('Navigating to next submission:', nextSubmission.submission_id);
            
            setCurrentIndex(nextIndex);
            
            // Fetch full submission details for the new submission
            try {
                setLoading(true);
                const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");
                const res = await fetch(`${API_BASE}/submissions/${nextSubmission.submission_id}`, {
                    credentials: "include"
                });
                
                if (res.ok) {
                    const fullSubmissionData = await res.json();
                    setSubmission(fullSubmissionData);
                    console.log('Fetched full data for submission:', nextSubmission.submission_id);
                } else {
                    console.error('Failed to fetch submission details');
                    setSubmission(nextSubmission); // Fallback to basic data
                }
            } catch (err) {
                console.error('Error fetching submission details:', err);
                setSubmission(nextSubmission); // Fallback to basic data
            } finally {
                setLoading(false);
            }
            
            // Update URL without triggering a page reload
            const newUrl = `/AssignedReportData/${nextSubmission.submission_id}`;
            window.history.pushState(null, '', newUrl);
        }
    };

    const goToPrevious = async () => {
        if (currentIndex > 0) {
            const prevIndex = currentIndex - 1;
            const prevSubmission = allSubmissions[prevIndex];
            
            console.log('Navigating to previous submission:', prevSubmission.submission_id);
            
            setCurrentIndex(prevIndex);
            
            // Fetch full submission details for the new submission
            try {
                setLoading(true);
                const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");
                const res = await fetch(`${API_BASE}/submissions/${prevSubmission.submission_id}`, {
                    credentials: "include"
                });
                
                if (res.ok) {
                    const fullSubmissionData = await res.json();
                    setSubmission(fullSubmissionData);
                    console.log('Fetched full data for submission:', prevSubmission.submission_id);
                } else {
                    console.error('Failed to fetch submission details');
                    setSubmission(prevSubmission); // Fallback to basic data
                }
            } catch (err) {
                console.error('Error fetching submission details:', err);
                setSubmission(prevSubmission); // Fallback to basic data
            } finally {
                setLoading(false);
            }
            
            // Update URL without triggering a page reload
            const newUrl = `/AssignedReportData/${prevSubmission.submission_id}`;
            window.history.pushState(null, '', newUrl);
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 0: return 'Draft';
            case 1: return 'Pending';
            case 2: return 'Completed';
            case 3: return 'Approved';
            case 4: return 'Rejected';
            default: return 'Unknown';
        }
    };

    const handleSubmitToPrincipal = async () => {
        if (!submissionId) return;
        
        try {
            setSubmitting(true);
            setSubmitMessage("");
            
            const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");
            
            const response = await fetch(`${API_BASE}/submissions/${submissionId}/submit-to-principal`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    coordinator_notes: 'Submitted by coordinator for principal approval'
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to submit to principal');
            }

            const result = await response.json();
            setSubmitMessage(result.message || 'Successfully submitted to principal!');
            toast.success(result.message || 'Successfully submitted to principal!');
            
            // Refresh the submission data to show updated status
            const updatedSubmission = await fetch(`${API_BASE}/submissions/${submissionId}`, {
                credentials: "include"
            });
            
            if (updatedSubmission.ok) {
                const updatedData = await updatedSubmission.json();
                setSubmission(updatedData);
            }
            
        } catch (err) {
            console.error('Error submitting to principal:', err);
            setSubmitMessage(`Error: ${err.message}`);
            toast.error(`Error: ${err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitConfirmation = () => {
        setShowSubmitModal(true);
    };

    const handleSubmitConfirm = async () => {
        setShowSubmitModal(false);
        await handleSubmitToPrincipal();
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
                        
                        {/* Assignment Navigation */}
                        {assignmentInfo && (
                            <div className="assignment-navigation">
                                <div className="assignment-info">
                                    <h3>{assignmentInfo.assignment_title}</h3>
                                    <p>{assignmentInfo.category_name} - {assignmentInfo.sub_category_name}</p>
                                </div>
                                <div className="submission-navigation">
                                    <button 
                                        onClick={goToPrevious} 
                                        disabled={currentIndex === 0}
                                        className="nav-button prev-button"
                                    >
                                        ← Previous
                                    </button>
                                    <span className="submission-counter">
                                        {currentIndex + 1} of {allSubmissions.length}
                                    </span>
                                    <button 
                                        onClick={goToNext} 
                                        disabled={currentIndex === allSubmissions.length - 1}
                                        className="nav-button next-button"
                                    >
                                        Next →
                                    </button>
                                </div>
                            </div>
                        )}
                        
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
                        
                        {/* Submit to Principal Section */}
                        {isCoordinator && submission && submission.status === 1 && (
                            <div className="submit-section">
                                <h3>Submit to Principal</h3>
                                <p>This submission is ready to be submitted to the principal for approval.</p>
                                {submitMessage && (
                                    <div className={`message ${submitMessage.includes('Error') ? 'error' : 'success'}`}>
                                        {submitMessage}
                                    </div>
                                )}
                                <button 
                                    onClick={handleSubmitConfirmation}
                                    disabled={submitting}
                                    className="submit-button"
                                >
                                    {submitting ? 'Submitting...' : 'Submit to Principal'}
                                </button>
                            </div>
                        )}
                        
                        {/* Show status if already completed and ready for principal review */}
                        {submission && submission.status === 2 && (
                            <div className="status-info">
                                <div className="info-message">
                                    <strong>Status:</strong> This submission has been completed and is ready for principal review.
                                </div>
                            </div>
                        )}
                        
                        <div className="action-buttons">
                            <button onClick={() => navigate(-1)}>Go Back</button>
                        </div>
                    </div>
                </div>
            </div> 

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={showSubmitModal}
                onClose={() => setShowSubmitModal(false)}
                onConfirm={handleSubmitConfirm}
                title="Submit to Principal"
                message="Are you sure you want to submit this report to the principal? Once submitted, the principal will review and approve or reject the submission."
                confirmText="Submit to Principal"
                cancelText="Cancel"
                type="warning"
            />
        </>
    )
}

export default AssignedReportData;