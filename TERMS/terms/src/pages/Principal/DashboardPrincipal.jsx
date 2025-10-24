import "./DashboardPrincipal.css";
import React from 'react'
import {useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import Header from '../../components/shared/Header.jsx';
import Sidebar from '../../components/shared/SidebarPrincipal.jsx';
import Submitted from '../../assets/submitted.svg';
import Pending from '../../assets/pending.svg';
import Approved from '../../assets/approved.svg';
import Rejected from '../../assets/rejected.svg';

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function DashboardPrincipal(){
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [deadlines, setDeadlines] = useState([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [approvedCount, setApprovedCount] = useState(0);
    const [rejectedCount, setRejectedCount] = useState(0);
    const [approvedReports, setApprovedReports] = useState([]);
    const [pendingReports, setPendingReports] = useState([]);
    const [rejectedReports, setRejectedReports] = useState([]);
    const [loading, setLoading] = useState(true);
    
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

    // Fetch deadlines data
    useEffect(() => {
        const fetchDeadlines = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/deadlines`, {
                    credentials: "include",
                });
                if (res.ok) {
                    const data = await res.json();
                    setDeadlines(data);
                }
            } catch (err) {
                console.error("Failed to fetch deadlines:", err);
            }
        };
        fetchDeadlines();
    }, []);

    // Fetch pending and approved reports data
    useEffect(() => {
        const fetchReportsData = async () => {
            try {
                setLoading(true);
                
        // Fetch pending reports (status 2 - submitted, waiting for approval)
        const pendingRes = await fetch(`${API_BASE}/submissions/for-principal-approval`, {
          credentials: "include",
        });
        if (pendingRes.ok) {
          const pendingData = await pendingRes.json();
          setPendingReports(pendingData);
          setPendingCount(pendingData.length);
        }

                // Fetch approved reports (status 3 - approved by principal)
                const approvedRes = await fetch(`${API_BASE}/submissions/approved-by-principal`, {
                    credentials: "include",
                });
                if (approvedRes.ok) {
                    const approvedData = await approvedRes.json();
                    setApprovedReports(approvedData);
                    setApprovedCount(approvedData.length);
                }

                // Fetch rejected reports (status 4 - rejected by principal)
                const rejectedRes = await fetch(`${API_BASE}/submissions/rejected-by-principal`, {
                    credentials: "include",
                });
                if (rejectedRes.ok) {
                    const rejectedData = await rejectedRes.json();
                    setRejectedReports(rejectedData);
                    setRejectedCount(rejectedData.length);
                }
            } catch (err) {
                console.error("Failed to fetch reports data:", err);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchReportsData();
        }
    }, [user]);

    // Navigation handlers
    const handleApprovedReportClick = (report) => {
        // Navigate to ViewSubmissionData for approved reports
        if (report.submission_id) {
            navigate(`/ViewSubmissionData?id=${report.submission_id}`);
        }
    };

    const handlePendingReportClick = (report) => {
        // Navigate to ForApprovalData for pending reports
        if (report.submission_id) {
            navigate(`/ForApprovalData?id=${report.submission_id}`);
        }
    };

    const handleRejectedReportClick = (report) => {
        // Navigate to AssignedReportData for rejected reports
        if (report.submission_id) {
            navigate(`/AssignedReportData/${report.submission_id}`);
        }
    };

    return (
        <>
        <Header userText={user ? user.name : "Guest"} />
        <div className="dashboard-container">
            <Sidebar activeLink="Dashboard" />
            <div className="dashboard-content">
                <div className="dashboard-main">
                    <h2>Dashboard</h2>
                <div className="dashboard-cards">
                    <div className="dashboard-card">
                        <div className="title-container">
                            <img src={Pending} alt="Pending Photo" />
                            <h3>Pending</h3>
                        </div>
                        <p>{loading ? "Loading..." : pendingCount}</p>
                    </div>
                    <div className="dashboard-card">
                        <div className="title-container">
                            <img src={Approved} alt="Approved Photo" />
                            <h3>Approved</h3>
                        </div>
                        <p>{loading ? "Loading..." : approvedCount}</p>
                    </div>
                    <div className="dashboard-card">
                        <div className="title-container">
                            <img src={Rejected} alt="Rejected Photo" />
                            <h3>Rejected</h3>
                        </div>
                        <p>{loading ? "Loading..." : rejectedCount}</p>
                    </div>
                </div>
                    <div className="submitted-reports">
                        <h2>Approved Reports</h2>
                        <hr />
                        <div className="reports-list">
                            {loading ? (
                                <div className="loading-message">Loading approved reports...</div>
                            ) : approvedReports.length > 0 ? (
                                approvedReports.slice(0, 5).map((report, index) => (
                                    <div 
                                        key={report.report_assignment_id || index} 
                                        className="submitted-reports-container clickable-report"
                                        onClick={() => handleApprovedReportClick(report)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="submitted-report-title">
                                            <h4>{report.assignment_title || 'Report'}</h4>
                                            <p>{report.category_name || 'Category'}</p>
                                            <p>{report.sub_category_name || 'Sub-Category'}</p>
                                        </div>
                                        <div className="submitted-report-date">
                                            <p>SY: {report.school_year || '2024-2025'}</p>
                                            <p>Date Submitted: {report.date_submitted || 'N/A'}</p>
                                            <p>Submitted by: {report.submitted_by_name || 'Unknown'}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="no-reports-message">No approved reports found</div>
                            )}
                        </div>
                    </div>

                    <div className="submitted-reports">
                        <h2>Rejected Reports</h2>
                        <hr />
                        <div className="reports-list">
                            {loading ? (
                                <div className="loading-message">Loading rejected reports...</div>
                            ) : rejectedReports.length > 0 ? (
                                rejectedReports.slice(0, 5).map((report, index) => (
                                    <div 
                                        key={report.report_assignment_id || index} 
                                        className="submitted-reports-container clickable-report"
                                        onClick={() => handleRejectedReportClick(report)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="submitted-report-title">
                                            <h4>{report.assignment_title || 'Report'}</h4>
                                            <p>{report.category_name || 'Category'}</p>
                                            <p>{report.sub_category_name || 'Sub-Category'}</p>
                                        </div>
                                        <div className="submitted-report-date">
                                            <p>SY: {report.school_year || '2024-2025'}</p>
                                            <p>Date Submitted: {report.date_submitted || 'N/A'}</p>
                                            <p>Submitted by: {report.submitted_by_name || 'Unknown'}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="no-reports-message">No rejected reports found</div>
                            )}
                        </div>
                    </div>

                    <div className="submitted-reports-upon-approval">
                        <h2>Submitted Reports Upon Approval</h2>
                        <hr />
                        <div className="reports-list">
                            {loading ? (
                                <div className="loading-message">Loading pending reports...</div>
                            ) : pendingReports.length > 0 ? (
                                pendingReports.slice(0, 5).map((report, index) => (
                                    <div 
                                        key={report.report_assignment_id || index} 
                                        className="submitted-reports-container clickable-report"
                                        onClick={() => handlePendingReportClick(report)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="submitted-report-title">
                                            <h4>{report.assignment_title || 'Report'}</h4>
                                            <p>{report.category_name || 'Category'}</p>
                                            <p>{report.sub_category_name || 'Sub-Category'}</p>
                                        </div>
                                        <div className="submitted-report-date">
                                            <p>SY: {report.school_year || '2024-2025'}</p>
                                            <p>Date Submitted: {report.date_submitted || 'N/A'}</p>
                                            <p>Submitted by: {report.submitted_by_name || 'Unknown'}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="no-reports-message">No pending reports found</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <div className="dashboard-sidebar">
                <CalendarComponent deadlines={deadlines} />
            </div>
        </div>
        </>
        
    )
}

function CalendarComponent({ deadlines = [] }) {
    const [date, setDate] = useState(new Date());
    const navigate = useNavigate();
    const onChange = (newDate) => {
        setDate(newDate);
    };

    // Extract due dates from deadlines
    const dueDates = deadlines.map(deadline => {
        // Try different possible field names for due date
        const dueDateField = deadline.due_date || deadline.to_date || deadline.dueDate || deadline.toDate;
        
        if (dueDateField) {
            let date;
            
            // Try parsing as ISO string first
            date = new Date(dueDateField);
            
            // If that fails, try parsing as a formatted date string
            if (isNaN(date.getTime())) {
                // Handle formats like "Oct 21, 2025, 12:00 AM"
                const dateStr = dueDateField.toString();
                const match = dateStr.match(/(\w{3})\s+(\d{1,2}),\s+(\d{4})/);
                if (match) {
                    const [, month, day, year] = match;
                    const monthMap = {
                        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
                    };
                    date = new Date(parseInt(year), monthMap[month], parseInt(day));
                }
            }
            
            if (!isNaN(date.getTime())) {
                console.log('Deadline date found:', dueDateField, 'parsed as:', date);
                return {
                    year: date.getFullYear(),
                    month: date.getMonth(),
                    day: date.getDate()
                };
            }
        }
        return null;
    }).filter(Boolean);

    console.log('All deadlines:', deadlines);
    console.log('Extracted due dates:', dueDates);

    // Function to check if a date has a deadline
    const hasDeadline = (date) => {
        return dueDates.some(dueDate => 
            dueDate.year === date.getFullYear() &&
            dueDate.month === date.getMonth() &&
            dueDate.day === date.getDate()
        );
    };

    // Custom tile content to highlight due dates
    const tileContent = ({ date, view }) => {
        if (view === 'month' && hasDeadline(date)) {
            return <div className="deadline-indicator">●</div>;
        }
        return null;
    };

    // Custom tile class name for styling
    const tileClassName = ({ date, view }) => {
        if (view === 'month' && hasDeadline(date)) {
            return 'react-calendar__tile--deadline';
        }
        return null;
    };

    // Function to detect deadline type (copied from DeadlineComponent)
    const detectType = (d) => {
        const title   = (d?.title || "").toLowerCase();
        const catName = (d?.category_name || "").toLowerCase();
        const subName = (d?.sub_category_name || "").toLowerCase();
        const subId   = Number(d?.sub_category_id);
        const catId   = Number(d?.category_id);

        const hay = `${title} ${catName} ${subName}`;
        if (hay.includes("laempl")) return "laempl";
        if (hay.includes("mps")) return "mps";
        if (hay.includes("accomplishment")) return "accomplishment";
        if (hay.includes("classification of grades") || hay.includes("classification")) return "cog";

        if (subId === 20) return "laempl";
        if (subId === 30) return "mps";
        if (catId === 1)  return "accomplishment";
        if (catId === 2)  return "laempl";
        return "generic";
    };

    // Function to get submission ID (copied from DeadlineComponent)
    const getSubmissionId = (d) =>
        d?.submission_id ?? d?.id ?? d?.report_assignment_id ?? null;

    // Function to navigate to deadline template
    const goToTemplate = (deadline) => {
        const kind = detectType(deadline);
        const submissionId = getSubmissionId(deadline);

        const commonState = {
            submission_id: submissionId,
            title: deadline.title,
            instruction: deadline.instruction,
            from_date: deadline.from_date,
            to_date: deadline.to_date,
            number_of_submission: deadline.number_of_submission,
            allow_late: deadline.allow_late,
        };

        if (kind === "laempl")         return navigate("/LAEMPLInstruction", { state: commonState });
        if (kind === "mps")            return navigate("/MPSInstruction", { state: commonState });
        if (kind === "accomplishment") return navigate("/AccomplishmentReportInstruction", { state: commonState });
        if (kind === "cog")            return navigate("/ClassificationOfGradesInstruction", { state: commonState });
        return navigate("/SubmittedReport");
    };

    // Function to handle tile click
    const handleTileClick = (value, event) => {
        if (hasDeadline(value)) {
            // Find the deadline that matches this date
            const clickedDeadline = deadlines.find(deadline => {
                const dueDateField = deadline.due_date || deadline.to_date || deadline.dueDate || deadline.toDate;
                if (dueDateField) {
                    let date;
                    date = new Date(dueDateField);
                    
                    if (isNaN(date.getTime())) {
                        const dateStr = dueDateField.toString();
                        const match = dateStr.match(/(\w{3})\s+(\d{1,2}),\s+(\d{4})/);
                        if (match) {
                            const [, month, day, year] = match;
                            const monthMap = {
                                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
                            };
                            date = new Date(parseInt(year), monthMap[month], parseInt(day));
                        }
                    }
                    
                    if (!isNaN(date.getTime())) {
                        return date.getFullYear() === value.getFullYear() &&
                               date.getMonth() === value.getMonth() &&
                               date.getDate() === value.getDate();
                    }
                }
                return false;
            });

            if (clickedDeadline) {
                goToTemplate(clickedDeadline);
            }
        }
    };

    return (
        <div className="calendar-container">
            <Calendar 
                onChange={onChange} 
                value={date}
                tileContent={tileContent}
                tileClassName={tileClassName}
                onClickDay={handleTileClick}
            />
        </div>
    );
}

function DeadlineComponent({ deadlines = [] }){
    // Use static deadlines as fallback if no data is provided
    const staticDeadlines = [
        {
            id: 1,
            title: "Quarterly Assessment Report",
            dueDate: "May 06, 2025",
            dueTime: "7:00 PM"
        },
        {
            id: 2,
            title: "Final Grades Submission",
            dueDate: "May 15, 2025",
            dueTime: "11:59 PM"
        },
        {
            id: 3,
            title: "Parent-Teacher Meeting",
            dueDate: "May 20, 2025",
            dueTime: "3:00 PM"
        }
    ];
    
    const displayDeadlines = deadlines.length > 0 ? deadlines : staticDeadlines;
    return(
    <>
    <div className="deadline-component">
            <h4>Upcoming Deadlines</h4>
            <hr />
            <div className="deadline-container">
                {displayDeadlines.map((deadline) => (
                    <div key={deadline.id} className="deadline-item">
                        <p className="deadline-title">{deadline.title}</p>
                        <div className="deadline-details">
                            <p>Due: {deadline.dueDate} <span>{deadline.dueTime}</span></p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </>
    )
}

export default DashboardPrincipal;