import React from "react";
import Sidebar from "../../components/shared/SidebarCoordinator";
import "./AssignedReport.css";
import "../../components/shared/StatusBadges.css";
import SidebarPrincipal from "../../components/shared/SidebarPrincipal";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header";
import YearQuarterFileManager from "../../components/YearQuarterFileManager";
import QuarterEnumService from "../../services/quarterEnumService";
import QuarterSelector from "../../components/QuarterSelector";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function AssignedReport() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [assignedReports, setAssignedReports] = useState([]);
    const [loadingReports, setLoadingReports] = useState(true);
    const [groupedReports, setGroupedReports] = useState([]);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'year-quarter'
    
    // Dropdown states
    const [selectedSchoolYear, setSelectedSchoolYear] = useState(2025);
    const [selectedQuarter, setSelectedQuarter] = useState(1);
    const [schoolYears, setSchoolYears] = useState([{ value: 2025, label: '2025-2026' }]);
    const [quarters, setQuarters] = useState([
        { value: 1, label: '1st Quarter' },
        { value: 2, label: '2nd Quarter' },
        { value: 3, label: '3rd Quarter' },
        { value: 4, label: '4th Quarter' }
    ]);

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

    // Fetch school years
    useEffect(() => {
        const fetchSchoolYears = async () => {
            try {
                const res = await fetch(`${API_BASE}/admin/school-years`, {
                    credentials: "include"
                });
                if (res.ok) {
                    const data = await res.json();
                    // Format years properly
                    const formattedYears = data.map(year => ({
                        value: year.year_id,
                        label: year.school_year
                    }));
                    setSchoolYears(formattedYears);
                    
                    // Set default to the first year if available
                    if (formattedYears.length > 0 && !selectedSchoolYear) {
                        setSelectedSchoolYear(formattedYears[0].value);
                    }
                } else {
                    // If API fails, set default school year
                    setSchoolYears([{ value: 1, label: '2025-2026' }]);
                    if (!selectedSchoolYear) {
                        setSelectedSchoolYear(1);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch school years:", err);
                // Set a default school year if API fails
                setSchoolYears([{ value: 1, label: '2025-2026' }]);
                if (!selectedSchoolYear) {
                    setSelectedSchoolYear(1);
                }
            }
        };
        fetchSchoolYears();
    }, []);

    // Set quarters using quarter enum service when year changes
    useEffect(() => {
        if (selectedSchoolYear) {
            const fetchQuarters = async () => {
                try {
                    const formattedQuarters = await QuarterEnumService.getFormattedQuarters();
                    setQuarters(formattedQuarters);
                    
                    // Set default to the first quarter if not already selected
                    if (!selectedQuarter) {
                        setSelectedQuarter(1);
                    }
                } catch (error) {
                    console.error('Error fetching quarters:', error);
                    // Fallback to static quarters
                    const staticQuarters = [
                        { value: 1, label: 'Quarter 1', quarter: 1 },
                        { value: 2, label: 'Quarter 2', quarter: 2 },
                        { value: 3, label: 'Quarter 3', quarter: 3 },
                        { value: 4, label: 'Quarter 4', quarter: 4 }
                    ];
                    setQuarters(staticQuarters);
                    
                    if (!selectedQuarter) {
                        setSelectedQuarter(1);
                    }
                }
            };
            
            fetchQuarters();
        }
    }, [selectedSchoolYear]);


    // Fetch assigned reports grouped by assignment
    useEffect(() => {
        const fetchGroupedReports = async () => {
            if (!user?.user_id || !selectedSchoolYear || !selectedQuarter) return;
            
            try {
                setLoadingReports(true);
                
                // Fetch all report assignments created by this user using existing endpoint
                const assignmentsRes = await fetch(`${API_BASE}/reports/assigned_by/${user.user_id}`, {
                    credentials: "include"
                });
                
                if (!assignmentsRes.ok) {
                    console.error("Failed to fetch report assignments:", assignmentsRes.status);
                    setGroupedReports([]);
                    return;
                }
                
                const allReports = await assignmentsRes.json();
                
                // Filter reports by selected year and quarter
                const filteredReports = allReports.filter(report => {
                    // Check if the report matches the selected year and quarter
                    // Handle both year_id format (1) and actual year format (2025)
                    const reportYear = report.year;
                    const selectedYear = parseInt(selectedSchoolYear);
                    
                    // If report year is 1, it means it's using year_id format
                    // If report year is 2025, it means it's using actual year format
                    const yearMatches = (reportYear === selectedYear) || 
                                      (reportYear === 1 && selectedYear === 2025);
                    
                    return yearMatches && report.quarter === parseInt(selectedQuarter);
                });
                
                // Group reports by assignment_id and calculate submission counts
                const assignmentMap = new Map();
                
                filteredReports.forEach(report => {
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
                            year: report.year,
                            quarter: report.quarter,
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
                    year: assignment.year,
                    quarter: assignment.quarter,
                    submitted: assignment.submittedCount,
                    total: assignment.totalAssigned,
                    status: assignment.submittedCount === assignment.totalAssigned && assignment.totalAssigned > 0 ? 'complete' : 'partial',
                    first_submission_id: assignment.reports.length > 0 ? assignment.reports[0].submission_id : null
                }));
                
                setGroupedReports(groupedData);
            } catch (err) {
                console.error("Error fetching grouped reports:", err);
                setGroupedReports([]);
            } finally {
                setLoadingReports(false);
            }
        };

        if (user?.user_id && selectedSchoolYear && selectedQuarter) {
            fetchGroupedReports();
        }
    }, [user?.user_id, selectedSchoolYear, selectedQuarter]);

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
                        <h2>Assigned Report</h2>
                        
                        {/* School Year and Quarter Dropdowns */}
                        <div className="filter-dropdowns">
                            <div className="dropdown-group">
                                <label htmlFor="school-year-select">School Year:</label>
                                <select 
                                    id="school-year-select"
                                    value={selectedSchoolYear || ''} 
                                    onChange={(e) => setSelectedSchoolYear(parseInt(e.target.value) || 2025)}
                                    className="dropdown-select"
                                >
                                    <option value="">Select School Year</option>
                                    {schoolYears.map(year => (
                                        <option key={year.value} value={year.value}>
                                            {year.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="dropdown-group">
                                <label htmlFor="quarter-select">Quarter:</label>
                                <QuarterSelector
                                    id="quarter-select"
                                    selectedQuarter={selectedQuarter}
                                    onQuarterChange={setSelectedQuarter}
                                    placeholder="Select Quarter"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="content">
                        {viewMode === 'list' ? (
                            <>
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
                            </>
                        ) : (
                            <YearQuarterFileManager 
                                user={user} 
                                reportType="assigned"
                            />
                        )}
                    </div>
                </div>
            </div> 
        </>
    )
}

export default AssignedReport;