import React from "react";
import Sidebar from "../../components/shared/SidebarCoordinator";
import "./AssignedReport.css";
import "../../components/shared/StatusBadges.css";
import SidebarPrincipal from "../../components/shared/SidebarPrincipal";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "../../components/shared/Header";
import YearQuarterFileManager from "../../components/YearQuarterFileManager";
import QuarterEnumService from "../../services/quarterEnumService";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function AssignedReport() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [assignedReports, setAssignedReports] = useState([]);
    const [loadingReports, setLoadingReports] = useState(true);
    const [groupedReports, setGroupedReports] = useState([]);
    const [filteredGroupedReports, setFilteredGroupedReports] = useState([]);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'year-quarter'
    
    // Dropdown states
    const [selectedSchoolYear, setSelectedSchoolYear] = useState('');
    const [selectedQuarter, setSelectedQuarter] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [schoolYears, setSchoolYears] = useState([{ value: 2025, label: '2025-2026' }]);
    const [quarters, setQuarters] = useState([
        { value: 1, label: '1st Quarter' },
        { value: 2, label: '2nd Quarter' },
        { value: 3, label: '3rd Quarter' },
        { value: 4, label: '4th Quarter' }
    ]);
    const [categories, setCategories] = useState([]);

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

    // Handle URL parameters and fetch school years
    useEffect(() => {
        const yearParam = searchParams.get('year');
        const quarterParam = searchParams.get('quarter');
        
        console.log('URL parameters:', { yearParam, quarterParam });
        
        // No default values from URL parameters
        
        // Debug: Log current state values
        console.log('Current state:', { selectedSchoolYear, selectedQuarter });
        console.log('Available school years:', schoolYears);

        // Then fetch school years
        const fetchSchoolYears = async () => {
            try {
                const res = await fetch(`${API_BASE}/admin/school-years`, {
                    credentials: "include"
                });
                if (res.ok) {
                    const data = await res.json();
                    console.log('🔍 [DEBUG] School years data:', data);
                    setSchoolYears(data); // Use raw data like submitted reports
                    
                    // No default year selection
                } else {
                    console.error("Failed to fetch school years");
                    setSchoolYears([]);
                }
            } catch (err) {
                console.error("Failed to fetch school years:", err);
                setSchoolYears([]);
            }
        };
        
        const fetchCategories = async () => {
            try {
                const res = await fetch(`${API_BASE}/categories`, {
                    credentials: "include"
                });
                if (res.ok) {
                    const data = await res.json();
                    setCategories(data); // Use raw data like submitted reports
                } else {
                    console.error("Failed to fetch categories");
                    setCategories([]);
                }
            } catch (err) {
                console.error("Failed to fetch categories:", err);
                setCategories([]);
            }
        };
        
        fetchSchoolYears();
        fetchCategories();
    }, [searchParams]);

    // Debug: Monitor state changes
    useEffect(() => {
        console.log('State changed - selectedSchoolYear:', selectedSchoolYear, 'selectedQuarter:', selectedQuarter, 'selectedCategory:', selectedCategory);
    }, [selectedSchoolYear, selectedQuarter, selectedCategory]);

    // Set quarters using quarter enum service when year changes
    useEffect(() => {
        if (selectedSchoolYear) {
            const fetchQuarters = async () => {
                try {
                    const formattedQuarters = await QuarterEnumService.getFormattedQuarters();
                    setQuarters(formattedQuarters);
                    
                    // No default quarter selection
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
                    
                    // No default quarter selection
                }
            };
            
            fetchQuarters();
        }
    }, [selectedSchoolYear]);


    // Fetch assigned reports grouped by assignment
    useEffect(() => {
        const fetchGroupedReports = async () => {
            if (!user?.user_id) return;
            
            try {
                setLoadingReports(true);
                
                // Fetch ALL report assignments (no server-side filtering)
                const assignmentsRes = await fetch(`${API_BASE}/reports/assigned_by/${user.user_id}`, {
                    credentials: "include"
                });
                
                if (!assignmentsRes.ok) {
                    console.error("Failed to fetch report assignments:", assignmentsRes.status);
                    setGroupedReports([]);
                    return;
                }
                
                const allReports = await assignmentsRes.json();
                console.log('🔍 [DEBUG] All reports fetched from API:', allReports);
                console.log('🔍 [DEBUG] Reports count:', allReports.length);
                
                // Use all reports for client-side filtering
                const filteredReports = allReports;
                
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
                            from_date: report.from_date,
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
                    from_date: assignment.from_date,
                    year: assignment.year,
                    quarter: assignment.quarter,
                    submitted: assignment.submittedCount,
                    total: assignment.totalAssigned,
                    status: assignment.submittedCount === assignment.totalAssigned && assignment.totalAssigned > 0 ? 'complete' : 'partial',
                    first_submission_id: assignment.reports.length > 0 ? assignment.reports[0].submission_id : null
                }));
                
                console.log('🔍 [DEBUG] Final grouped reports:', groupedData);
                console.log('🔍 [DEBUG] Number of grouped reports:', groupedData.length);
                setGroupedReports(groupedData);
            } catch (err) {
                console.error("Error fetching grouped reports:", err);
                setGroupedReports([]);
            } finally {
                setLoadingReports(false);
            }
        };

        if (user?.user_id) {
            fetchGroupedReports();
        }
    }, [user?.user_id]);

    // Client-side filtering function (similar to submitted reports)
    useEffect(() => {
        const filterGroupedReports = () => {
            console.log('🔍 [DEBUG] Filtering reports:', {
                groupedReports: groupedReports.length,
                selectedSchoolYear,
                selectedQuarter,
                selectedCategory,
                schoolYears: schoolYears.length,
                quarters: quarters.length,
                categories: categories.length
            });

            if (!groupedReports.length) {
                console.log('🔍 [DEBUG] No grouped reports to filter');
                setFilteredGroupedReports([]);
                return;
            }

            let filtered = [...groupedReports];
            console.log('🔍 [DEBUG] Initial filtered reports:', filtered.length);

            // If no filters are applied, show all reports
            if (!selectedSchoolYear && !selectedQuarter && !selectedCategory) {
                console.log('🔍 [DEBUG] No filters applied, showing all reports');
                setFilteredGroupedReports(filtered);
                return;
            }

            // Filter by school year
            if (selectedSchoolYear) {
                const selectedYearObj = schoolYears.find(year => year.year_id.toString() === selectedSchoolYear);
                console.log('🔍 [DEBUG] Selected year object:', selectedYearObj);
                if (selectedYearObj) {
                    filtered = filtered.filter(group => {
                        const matches = group.school_year === selectedYearObj.school_year;
                        console.log('🔍 [DEBUG] Year filter:', {
                            groupYear: group.school_year,
                            selectedSchoolYear: selectedYearObj.school_year,
                            matches
                        });
                        return matches;
                    });
                }
            }

            // Filter by quarter
            if (selectedQuarter) {
                const selectedQuarterObj = quarters.find(quarter => quarter.value === selectedQuarter);
                console.log('🔍 [DEBUG] Selected quarter object:', selectedQuarterObj);
                if (selectedQuarterObj) {
                    filtered = filtered.filter(group => {
                        const matches = group.quarter_name === selectedQuarterObj.label;
                        console.log('🔍 [DEBUG] Quarter filter:', {
                            groupQuarter: group.quarter_name,
                            selectedLabel: selectedQuarterObj.label,
                            matches
                        });
                        return matches;
                    });
                }
            }

            // Filter by category
            if (selectedCategory) {
                const selectedCategoryObj = categories.find(cat => cat.category_id.toString() === selectedCategory);
                console.log('🔍 [DEBUG] Selected category object:', selectedCategoryObj);
                if (selectedCategoryObj) {
                    filtered = filtered.filter(group => {
                        const matches = group.category_name === selectedCategoryObj.category_name;
                        console.log('🔍 [DEBUG] Category filter:', {
                            groupCategory: group.category_name,
                            selectedCategoryName: selectedCategoryObj.category_name,
                            matches
                        });
                        return matches;
                    });
                }
            }

            console.log('🔍 [DEBUG] Final filtered reports:', filtered.length);
            setFilteredGroupedReports(filtered);
        };

        filterGroupedReports();
    }, [groupedReports, selectedSchoolYear, selectedQuarter, selectedCategory, schoolYears, quarters, categories]);

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
                                        <option key={year.year_id} value={year.year_id}>
                                            {year.school_year}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="dropdown-group">
                                <label htmlFor="quarter-select">Quarter:</label>
                                <select
                                    id="quarter-select"
                                    value={selectedQuarter || ''}
                                    onChange={(e) => setSelectedQuarter(e.target.value)}
                                    className="dropdown-select"
                                >
                                    <option value="">All Quarters</option>
                                    {quarters.map(quarter => (
                                        <option key={quarter.value} value={quarter.value}>
                                            {quarter.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="dropdown-group">
                                <label htmlFor="category-select">Category:</label>
                                <select 
                                    id="category-select"
                                    value={selectedCategory} 
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="dropdown-select"
                                >
                                    <option value="">All Categories</option>
                                    {categories.map(category => (
                                        <option key={category.category_id} value={category.category_id}>
                                            {category.category_name}
                                        </option>
                                    ))}
                                </select>
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
                                                <th>Category</th>
                                                <th>Assignment Title</th>
                                                <th>Created Date</th>
                                                <th>Status</th>
                                                <th>Submitted</th>
                                                <th>Due Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredGroupedReports.map((report) => (
                                                <tr key={report.report_assignment_id} onClick={() => navigate(`/AssignedReportData/${report.first_submission_id}`)}>
                                                    <td className="file-cell">
                                                        <span className="file-name">{report.category_name || 'N/A'}</span>
                                                    </td>
                                                    <td>
                                                        <span className="file-name">
                                                            {report.assignment_title || 'Report'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="created-date-info">
                                                            {report.from_date || 'N/A'}
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