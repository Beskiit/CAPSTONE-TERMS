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
    const [quarters, setQuarters] = useState([]);
    const [categories, setCategories] = useState([]);
    const [filteredSubmissions, setFilteredSubmissions] = useState([]);

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

    // Fetch school years and quarters
    useEffect(() => {
        const fetchSchoolYearsAndQuarters = async () => {
            try {
                // Fetch school years
                const schoolYearsRes = await fetch(`${API_BASE}/admin/school-years`, {
                    credentials: "include",
                });
                if (schoolYearsRes.ok) {
                    const schoolYearsData = await schoolYearsRes.json();
                    console.log('📊 School years data:', schoolYearsData);
                    setSchoolYears(schoolYearsData);
                }

                // Fetch quarters
                // Use quarter enum service for clean quarter data
                const formattedQuarters = await QuarterEnumService.getFormattedQuarters();
                console.log('📊 Formatted quarters:', formattedQuarters);
                setQuarters(formattedQuarters);
            } catch (err) {
                console.error("Failed to fetch school years and quarters:", err);
            }
        };

        fetchSchoolYearsAndQuarters();
    }, []);

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
                    const selectedYearObj = schoolYears.find(year => year.year_id.toString() === selectedSchoolYear);
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
                                                    <td>{submission.assignment_title || submission.title || 'N/A'}</td>
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