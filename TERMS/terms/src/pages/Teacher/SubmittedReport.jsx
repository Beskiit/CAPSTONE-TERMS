import React from "react";
import Sidebar from "../../components/shared/SidebarTeacher";
import "./SubmittedReport.css";
import "../../components/shared/StatusBadges.css";
import "../Coordinator/AssignedReport.css";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header";
import YearQuarterFileManager from "../../components/YearQuarterFileManager";
import QuarterEnumService from "../../services/quarterEnumService";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function SubmittedReport() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submissions, setSubmissions] = useState([]);
    const [loadingSubmissions, setLoadingSubmissions] = useState(true);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'year-quarter'
    
    // Dropdown states
    const [selectedSchoolYear, setSelectedSchoolYear] = useState('');
    const [selectedQuarter, setSelectedQuarter] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [schoolYears, setSchoolYears] = useState([]);
    const [assignmentYearsAndQuarters, setAssignmentYearsAndQuarters] = useState([]);
    const [quarters, setQuarters] = useState([]);
    const [categories, setCategories] = useState([]);
    const [filteredSubmissions, setFilteredSubmissions] = useState([]);
    const [assignmentDetails, setAssignmentDetails] = useState({});

    const role = (user?.role || "").toLowerCase();
    const isTeacher = role === "teacher";

    // Function to fetch assignment details from report_assignment table
    const fetchAssignmentDetails = async (assignmentId) => {
        if (!assignmentId) return null;
        
        try {
            const response = await fetch(`${API_BASE}/reports/${assignmentId}`, {
                credentials: "include"
            });
            
            if (response.ok) {
                const assignmentData = await response.json();
                console.log('Report assignment details fetched:', assignmentData);
                return assignmentData;
            }
        } catch (error) {
            console.error('Failed to fetch report assignment details:', error);
        }
        return null;
    };

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

    // Fetch categories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await fetch(`${API_BASE}/categories`);
                if (!res.ok) return;
                const data = await res.json();
                setCategories(data);
            } catch (err) {
                console.error("Failed to fetch categories:", err);
            }
        };
        fetchCategories();
    }, []);

    // Fetch all school years and quarters from admin API
    useEffect(() => {
        const fetchAllSchoolYearsAndQuarters = async () => {
            try {
                console.log('🔍 [DEBUG] Fetching all school years and quarters for SubmittedReport');
                
                // Fetch school years
                const schoolYearsRes = await fetch(`${API_BASE}/admin/school-years`, {
                    credentials: "include"
                });
                
                if (schoolYearsRes.ok) {
                    const schoolYearsData = await schoolYearsRes.json();
                    console.log('🔍 [DEBUG] School years data:', schoolYearsData);
                    
                    // Fetch quarters for each school year
                    const quartersRes = await fetch(`${API_BASE}/admin/quarters-comprehensive`, {
                        credentials: "include"
                    });
                    
                    if (quartersRes.ok) {
                        const quartersData = await quartersRes.json();
                        console.log('🔍 [DEBUG] Quarters data:', quartersData);
                        
                        // Combine school years with their quarters
                        const combinedData = schoolYearsData.map(year => {
                            const yearQuarters = quartersData.filter(q => q.year === year.year_id);
                            return {
                                ...year,
                                quarters: yearQuarters.map(q => ({
                                    quarter: q.quarter,
                                    quarter_name: q.quarter_name,
                                    quarter_short_name: q.quarter_short_name
                                }))
                            };
                        });
                        
                        console.log('🔍 [DEBUG] Combined data:', combinedData);
                        setAssignmentYearsAndQuarters(combinedData);
                        setSchoolYears(schoolYearsData); // Keep separate for filtering
                        
                        // Set default to the first year if available
                        if (combinedData.length > 0 && !selectedSchoolYear) {
                            setSelectedSchoolYear(combinedData[0].school_year);
                        }
                    } else {
                        console.error("Failed to fetch quarters");
                        setAssignmentYearsAndQuarters(schoolYearsData);
                        setSchoolYears(schoolYearsData);
                    }
                } else {
                    console.error("Failed to fetch school years");
                    setAssignmentYearsAndQuarters([]);
                    setSchoolYears([]);
                }
            } catch (err) {
                console.error("Failed to fetch school years and quarters:", err);
                setAssignmentYearsAndQuarters([]);
                setSchoolYears([]);
            }
        };
        fetchAllSchoolYearsAndQuarters();
    }, []);

    // Update quarters when school year changes
    useEffect(() => {
        if (selectedSchoolYear && assignmentYearsAndQuarters.length > 0) {
            const selectedYear = assignmentYearsAndQuarters.find(year => year.school_year === selectedSchoolYear);
            console.log('🔍 [DEBUG] Selected year for quarters:', selectedYear);
            if (selectedYear && selectedYear.quarters) {
                const quarterOptions = selectedYear.quarters.map(q => ({
                    value: q.quarter,
                    label: q.quarter_name
                }));
                console.log('🔍 [DEBUG] Quarter options:', quarterOptions);
                setQuarters(quarterOptions);
                
                // Reset quarter selection if current selection is not available in new year
                if (selectedQuarter && !selectedYear.quarters.some(q => q.quarter.toString() === selectedQuarter)) {
                    setSelectedQuarter('');
                }
            } else {
                console.log('🔍 [DEBUG] No quarters found for selected year');
                setQuarters([]);
                setSelectedQuarter('');
            }
        } else {
            setQuarters([]);
            setSelectedQuarter('');
        }
    }, [selectedSchoolYear, assignmentYearsAndQuarters]);

    // Fetch teacher's submitted reports
    useEffect(() => {
        const fetchSubmissions = async () => {
            if (!user?.user_id) return;
            
            try {
                setLoadingSubmissions(true);
                
                // Use the reports endpoint that includes proper school year and quarter data
                const res = await fetch(`${API_BASE}/reports/submitted_by/${user.user_id}`, {
                    credentials: "include"
                });
                
                if (!res.ok) {
                    console.error("Failed to fetch submissions:", res.status);
                    setSubmissions([]);
                    return;
                }
                
                const data = await res.json();
                console.log("All submissions:", data);
                setSubmissions(data);
                
                // Fetch assignment details for each submission
                const assignmentDetailsMap = {};
                for (const submission of data) {
                    if (submission.report_assignment_id) {
                        try {
                            const assignmentDetails = await fetchAssignmentDetails(submission.report_assignment_id);
                            if (assignmentDetails) {
                                assignmentDetailsMap[submission.report_assignment_id] = assignmentDetails;
                            }
                        } catch (error) {
                            console.error(`Failed to fetch assignment details for ${submission.report_assignment_id}:`, error);
                        }
                    }
                }
                setAssignmentDetails(assignmentDetailsMap);
            } catch (err) {
                console.error("Error fetching submissions:", err);
                setSubmissions([]);
            } finally {
                setLoadingSubmissions(false);
            }
        };

        if (user?.user_id) {
            fetchSubmissions();
        }
    }, [user?.user_id]);

    // Filter submissions based on selected school year, quarter, and category
    useEffect(() => {
        const filterSubmissions = () => {
            let filtered = submissions;

            if (selectedSchoolYear && selectedQuarter) {
                console.log('🔍 Filtering with:', { selectedSchoolYear, selectedQuarter });
                console.log('📊 Available school years:', schoolYears);
                console.log('📊 Available quarters:', quarters);
                
                filtered = submissions.filter(submission => {
                    const reportYear = submission.school_year;
                    const reportQuarter = submission.quarter_name;
                    
                    // Find the selected school year object
                    const selectedYearObj = schoolYears.find(year => year.school_year === selectedSchoolYear);
                    const selectedQuarterObj = quarters.find(quarter => quarter.value.toString() === selectedQuarter);
                    
                    console.log('🔍 Comparing:', {
                        reportYear,
                        reportQuarter,
                        selectedYearObj: selectedYearObj?.school_year,
                        selectedQuarterObj: selectedQuarterObj?.label,
                        yearMatch: reportYear === selectedYearObj?.school_year,
                        quarterMatch: reportQuarter === selectedQuarterObj?.label
                    });
                    
                    return reportYear === selectedYearObj?.school_year && 
                           reportQuarter === selectedQuarterObj?.label;
                });
                
                console.log('📊 Filtered results:', filtered.length);
            }

            // Filter by category
            if (selectedCategory) {
                const selectedCategoryObj = categories.find(cat => cat.category_id.toString() === selectedCategory);
                if (selectedCategoryObj) {
                    filtered = filtered.filter(submission => {
                        return submission.category_name === selectedCategoryObj.category_name;
                    });
                }
            }

            setFilteredSubmissions(filtered);
        };

        filterSubmissions();
    }, [submissions, selectedSchoolYear, selectedQuarter, selectedCategory, schoolYears, quarters, categories]);
    return(
        <>
            <Header userText={user ? user.name : "Guest"} />
            <div className="dashboard-container">
                {isTeacher ? (
                    <Sidebar activeLink="Submitted Reports" />
                ) : (
                    <SidebarCoordinator activeLink="Submitted Report" />
                )}
                <div className="dashboard-content">
                    <div className="dashboard-main">
                        <h2>Submitted Report</h2>
                        
                        {/* School Year, Quarter, and Category Dropdowns */}
                        <div className="filter-dropdowns">
                            <div className="dropdown-group">
                                <label htmlFor="school-year-select">School Year:</label>
                                <select 
                                    id="school-year-select"
                                    value={selectedSchoolYear || ''} 
                                    onChange={(e) => setSelectedSchoolYear(e.target.value)}
                                    className="dropdown-select"
                                >
                                    <option value="">All School Years</option>
                                    {assignmentYearsAndQuarters.map(year => (
                                        <option key={year.year_id} value={year.school_year}>
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
                                    value={selectedCategory || ''} 
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
                                {loadingSubmissions ? (
                                    <p>Loading submitted reports...</p>
                                ) : filteredSubmissions.length === 0 ? (
                                    <p>No submitted reports found.</p>
                                ) : (
                                    <table className="report-table">
                                        <thead>
                                            <tr>
                                                <th>Report Title</th>
                                                <th>Assignment Title</th>
                                                <th>Date Submitted</th>
                                                <th>Quarter</th>
                                                <th>School Year</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredSubmissions.map((submission) => (
                                                <tr key={submission.submission_id} onClick={() => navigate(`/submission/${submission.submission_id}`)}>
                                                    <td className="file-cell">
                                                        <span className="file-name">{submission.value || submission.category_name || 'Report'}</span>
                                                    </td>
                                                    <td>{(() => {
                                                        const assignmentInfo = assignmentDetails[submission.report_assignment_id];
                                                        const title = assignmentInfo?.title || 
                                                                   assignmentInfo?.assignment_title || 
                                                                   assignmentInfo?.report_title ||
                                                                   assignmentInfo?.name ||
                                                                   submission.assignment_title || 
                                                                   submission.title || 
                                                                   'N/A';
                                                        return title;
                                                    })()}</td>
                                                    <td>{submission.date_submitted || 'Not submitted'}</td>
                                                    <td>{submission.quarter_name || 'N/A'}</td>
                                                    <td>{submission.school_year || 'N/A'}</td>
                                                    <td>
                                                        <span className={`status-badge status-${submission.status}`}>
                                                            {submission.status === 0 ? 'Draft' : 
                                                             submission.status === 1 ? 'Pending' : 
                                                             submission.status === 2 ? 'Submitted' : 
                                                             submission.status === 3 ? 'Approved' : 
                                                             submission.status === 4 ? 'Rejected' : 'Unknown'}
                                                        </span>
                                                        {submission.status === 4 && submission.fields?.rejection_reason && (
                                                            <div className="rejection-details">
                                                                <small className="rejection-reason">
                                                                    Reason: {submission.fields.rejection_reason}
                                                                </small>
                                                                {submission.fields.extended_due_date && (
                                                                    <small className="extended-deadline">
                                                                        New deadline: {new Date(submission.fields.extended_due_date).toLocaleDateString()}
                                                                    </small>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </>
                        ) : (
                            <YearQuarterFileManager 
                                user={user} 
                                reportType="submitted"
                            />
                        )}
                    </div>
                </div>
            </div> 
        </>
    )
}

export default SubmittedReport;