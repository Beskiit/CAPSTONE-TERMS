import React from "react";
import Sidebar from "../../components/shared/SidebarCoordinator";
import "./AssignedReport.css";
import "../../components/shared/StatusBadges.css";
import SidebarPrincipal from "../../components/shared/SidebarPrincipal";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import Header from "../../components/shared/Header";
import Breadcrumb from "../../components/Breadcrumb";
import YearQuarterFileManager from "../../components/YearQuarterFileManager";
import QuarterEnumService from "../../services/quarterEnumService";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function AssignedReport() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    
    // Debug: Log when component mounts/unmounts
    useEffect(() => {
        console.log('🟢 [AssignedReport] Component mounted');
        return () => {
            console.log('🔴 [AssignedReport] Component unmounting');
        };
    }, []);

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
    const [assignmentYearsAndQuarters, setAssignmentYearsAndQuarters] = useState([]);
    const [quarters, setQuarters] = useState([]);
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

        // Fetch all school years and quarters from admin API
        const fetchAllSchoolYearsAndQuarters = async () => {
            try {
                console.log('🔍 [DEBUG] Fetching all school years and quarters');
                
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

        // Then fetch school years and quarters from actual report assignments
        const fetchSchoolYearsAndQuarters = async () => {
            try {
                if (!user?.user_id) {
                    console.log('🔍 [DEBUG] No user ID available yet');
                    return;
                }
                
                console.log('🔍 [DEBUG] Fetching assignment years and quarters for user:', user.user_id);
                const res = await fetch(`${API_BASE}/reports/assignment-years-quarters/${user.user_id}`, {
                    credentials: "include"
                });
                
                console.log('🔍 [DEBUG] API response status:', res.status);
                
                if (res.ok) {
                    const data = await res.json();
                    console.log('🔍 [DEBUG] Assignment years and quarters data:', data);
                    console.log('🔍 [DEBUG] Data length:', data.length);
                    setAssignmentYearsAndQuarters(data); // Use new state for assignment data
                    
                    // Set default selection if URL parameters are provided
                    const yearParam = searchParams.get('year');
                    const quarterParam = searchParams.get('quarter');
                    
                    if (yearParam && quarterParam && data.length > 0) {
                        const selectedYear = data.find(year => year.year_id.toString() === yearParam);
                        if (selectedYear) {
                            setSelectedSchoolYear(selectedYear.school_year);
                            setSelectedQuarter(quarterParam);
                        }
                    } else if (data.length > 0) {
                        // Set default to the first available year if no URL params
                        setSelectedSchoolYear(data[0].school_year);
                    }
                } else {
                    const errorText = await res.text();
                    console.error("Failed to fetch assignment years and quarters:", res.status, errorText);
                }
            } catch (err) {
                console.error("Failed to fetch assignment years and quarters:", err);
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
        
        // Fetch all school years and quarters
        fetchAllSchoolYearsAndQuarters();
        
        if (user?.user_id) {
            fetchSchoolYearsAndQuarters();
        }
        fetchCategories();
    }, [searchParams, user?.user_id]);

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

    // Debug: Monitor state changes
    useEffect(() => {
        console.log('State changed - selectedSchoolYear:', selectedSchoolYear, 'selectedQuarter:', selectedQuarter, 'selectedCategory:', selectedCategory);
    }, [selectedSchoolYear, selectedQuarter, selectedCategory]);



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
                
                const assignedReports = await assignmentsRes.json();
                console.log('🔍 [DEBUG] Reports assigned by coordinator:', assignedReports);
                
                // Also fetch coordinator's own assignments (where coordinator is the assignee)
                // These are assignments created by the coordinator for themselves
                let coordinatorOwnReports = [];
                try {
                    const ownAssignmentsRes = await fetch(`${API_BASE}/reports/given_to/${user.user_id}`, {
                        credentials: "include"
                    });
                    
                    if (ownAssignmentsRes.ok) {
                        const allOwnReports = await ownAssignmentsRes.json();
                        console.log('🔍 [DEBUG] All reports given to coordinator:', allOwnReports);
                        
                        // For each report, fetch assignment details to check if it's coordinator's own assignment
                        const assignmentChecks = await Promise.all(
                            allOwnReports.map(async (report) => {
                                try {
                                    const assignmentRes = await fetch(`${API_BASE}/reports/assignment/${report.report_assignment_id}`, {
                                        credentials: "include"
                                    });
                                    if (assignmentRes.ok) {
                                        const assignmentData = await assignmentRes.json();
                                        return {
                                            report,
                                            assignment: assignmentData
                                        };
                                    }
                                } catch (err) {
                                    console.warn(`Failed to fetch assignment ${report.report_assignment_id}:`, err);
                                }
                                return null;
                            })
                        );
                        
                        // Filter to only include assignments where:
                        // 1. The coordinator created it (given_by = coordinator_id)
                        // 2. It's the coordinator's own assignment (parent_report_assignment_id IS NULL)
                        // 3. Category is Accomplishment Report (category_id = 0) or LAEMPL (category_id = 1, sub_category_id = 3)
                        coordinatorOwnReports = assignmentChecks
                            .filter(item => item && item.assignment)
                            .filter(item => {
                                const assignment = item.assignment;
                                const isCoordinatorCreated = Number(assignment.given_by) === Number(user.user_id);
                                const isOwnAssignment = !assignment.parent_report_assignment_id;
                                const isAccomplishmentOrLAEMPL = Number(assignment.category_id) === 0 || 
                                                                 (Number(assignment.category_id) === 1 && Number(assignment.sub_category_id) === 3);
                                return isCoordinatorCreated && isOwnAssignment && isAccomplishmentOrLAEMPL;
                            })
                            .map(item => item.report);
                        
                        console.log('🔍 [DEBUG] Coordinator own assignments:', coordinatorOwnReports);
                    }
                } catch (err) {
                    console.warn('Failed to fetch coordinator own assignments:', err);
                }
                
                // Combine both sets of reports, but deduplicate by submission_id to avoid counting the same submission twice
                // Coordinator's own assignments appear in both assignedReports (as given_by) and coordinatorOwnReports (as assignee)
                const allReportsMap = new Map();
                
                // First, add all assigned reports
                assignedReports.forEach(report => {
                    const key = `${report.report_assignment_id}_${report.submission_id}`;
                    if (!allReportsMap.has(key)) {
                        allReportsMap.set(key, report);
                    }
                });
                
                // Then, add coordinator's own reports (will skip duplicates)
                coordinatorOwnReports.forEach(report => {
                    const key = `${report.report_assignment_id}_${report.submission_id}`;
                    if (!allReportsMap.has(key)) {
                        allReportsMap.set(key, report);
                    } else {
                        console.log('⚠️ [DEBUG] Duplicate submission skipped:', {
                            assignmentId: report.report_assignment_id,
                            submission_id: report.submission_id,
                            source: 'coordinatorOwnReports'
                        });
                    }
                });
                
                const allReports = Array.from(allReportsMap.values());
                console.log('🔍 [DEBUG] All reports fetched from API (assigned + own, deduplicated):', allReports);
                console.log('🔍 [DEBUG] Reports count (before dedup):', assignedReports.length + coordinatorOwnReports.length);
                console.log('🔍 [DEBUG] Reports count (after dedup):', allReports.length);
                
                // Debug: Check the structure of the first report
                if (allReports.length > 0) {
                    console.log('🔍 [DEBUG] First report structure:', allReports[0]);
                    console.log('🔍 [DEBUG] Available school years in API data:', [...new Set(allReports.map(r => r.school_year))]);
                    console.log('🔍 [DEBUG] Available years in API data:', [...new Set(allReports.map(r => r.year))]);
                    console.log('🔍 [DEBUG] First report keys:', Object.keys(allReports[0]));
                }
                
                // Use all reports for client-side filtering
                const filteredReports = allReports;
                
                // Create a mapping from year_id to school_year if school_year is undefined
                const yearToSchoolYearMap = {
                    50000: '2025-2026',
                    51000: '2026-2027', 
                    52000: '2027-2028'
                };
                
                // Group reports by assignment_id and calculate submission counts
                const assignmentMap = new Map();
                
                // First, fetch assignment details to check parent_report_assignment_id for all assignments
                const assignmentDetailsMap = new Map();
                const uniqueAssignmentIds = [...new Set(filteredReports.map(r => r.report_assignment_id))];
                await Promise.all(
                    uniqueAssignmentIds.map(async (assignmentId) => {
                        try {
                            const assignmentRes = await fetch(`${API_BASE}/reports/assignment/${assignmentId}`, {
                                credentials: "include"
                            });
                            if (assignmentRes.ok) {
                                const assignmentData = await assignmentRes.json();
                                assignmentDetailsMap.set(assignmentId, assignmentData);
                            }
                        } catch (err) {
                            console.warn(`Failed to fetch assignment ${assignmentId}:`, err);
                        }
                    })
                );
                
                // Debug: Log all reports for coordinator's own assignments before filtering
                const coordinatorOwnAssignmentIds = coordinatorOwnReports.map(r => r.report_assignment_id);
                const reportsForCoordinatorOwn = filteredReports.filter(r => coordinatorOwnAssignmentIds.includes(r.report_assignment_id));
                if (reportsForCoordinatorOwn.length > 0) {
                    console.log('🔍 [DEBUG] ALL reports for coordinator own assignments BEFORE filtering:', reportsForCoordinatorOwn);
                    
                    // Group by assignment ID to see how many submissions per assignment
                    const byAssignment = new Map();
                    reportsForCoordinatorOwn.forEach(r => {
                        if (!byAssignment.has(r.report_assignment_id)) {
                            byAssignment.set(r.report_assignment_id, []);
                        }
                        byAssignment.get(r.report_assignment_id).push(r);
                    });
                    
                    console.log('🔍 [DEBUG] Submissions per coordinator own assignment:');
                    byAssignment.forEach((reports, assignmentId) => {
                        console.log(`  Assignment ID ${assignmentId}: ${reports.length} submission(s)`);
                        reports.forEach(r => {
                            console.log(`    - Submission ID: ${r.submission_id}, Submitted by: ${r.submitted_by}, User ID: ${user?.user_id}, Status: ${r.status}, Is Coordinator: ${Number(r.submitted_by) === Number(user?.user_id)}`);
                        });
                    });
                }
                
                filteredReports.forEach(report => {
                    const assignmentId = report.report_assignment_id;
                    const assignmentDetails = assignmentDetailsMap.get(assignmentId);
                    
                    // Skip if this is a child assignment (has parent_report_assignment_id) when counting coordinator's own assignments
                    // Coordinator's own assignment should have parent_report_assignment_id = null
                    const isChildAssignment = assignmentDetails?.parent_report_assignment_id != null;
                    const isCoordinatorOwnAssignment = coordinatorOwnReports.some(r => r.report_assignment_id === assignmentId);
                    
                    // Debug log for coordinator's own assignments
                    if (isCoordinatorOwnAssignment) {
                        console.log('🔍 [DEBUG] Processing coordinator own assignment:', {
                            assignmentId,
                            isChildAssignment,
                            parent_report_assignment_id: assignmentDetails?.parent_report_assignment_id,
                            submitted_by: report.submitted_by,
                            user_id: user?.user_id,
                            status: report.status,
                            submission_id: report.submission_id
                        });
                    }
                    
                    // Only process if it's the coordinator's own assignment (not a child) OR it's not a coordinator's own assignment
                    if (isCoordinatorOwnAssignment && isChildAssignment) {
                        // This is a child assignment being incorrectly identified as coordinator's own, skip it
                        console.log('⚠️ [DEBUG] Skipping child assignment incorrectly identified as coordinator own:', assignmentId);
                        return;
                    }
                    
                    // For coordinator's own assignments, ONLY count submissions from the coordinator
                    // For other assignments, count all submissions except coordinator's
                    const isCoordinatorOwnSubmission = Number(report.submitted_by) === Number(user?.user_id);
                    
                    if (isCoordinatorOwnAssignment) {
                        // Coordinator's own assignment: ONLY count coordinator's submissions
                        if (!isCoordinatorOwnSubmission) {
                            // Skip teacher submissions in coordinator's own assignment
                            console.log('⚠️ [DEBUG] SKIPPING non-coordinator submission in coordinator own assignment:', {
                                assignmentId,
                                submission_id: report.submission_id,
                                submitted_by: report.submitted_by,
                                user_id: user?.user_id,
                                assignment_title: report.assignment_title
                            });
                            return;
                        } else {
                            console.log('✅ [DEBUG] INCLUDING coordinator submission in coordinator own assignment:', {
                                assignmentId,
                                submission_id: report.submission_id,
                                submitted_by: report.submitted_by,
                                status: report.status
                            });
                        }
                    } else {
                        // Other assignments: exclude coordinator's submissions
                        if (isCoordinatorOwnSubmission) {
                            // Skip coordinator's submissions in teacher assignments
                            console.log('⚠️ [DEBUG] Skipping coordinator submission in teacher assignment:', {
                                assignmentId,
                                submitted_by: report.submitted_by
                            });
                            return;
                        }
                    }
                    
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
                            school_year: report.school_year || yearToSchoolYearMap[report.year], // Add school_year field with fallback
                            quarter_name: report.quarter_name, // Add quarter_name field
                            totalAssigned: 0,
                            submittedCount: 0,
                            reports: []
                        });
                    }
                    
                    // Add this report to the assignment
                    const assignment = assignmentMap.get(assignmentId);
                    assignment.reports.push(report);
                    
                    // Count all submissions that passed the filter above
                    assignment.totalAssigned++;
                    
                    // Debug: Log when counting for coordinator's own assignments
                    if (isCoordinatorOwnAssignment) {
                        console.log('📊 [DEBUG] Counting submission for coordinator own assignment:', {
                            assignmentId,
                            submission_id: report.submission_id,
                            submitted_by: report.submitted_by,
                            status: report.status,
                            totalAssigned_after: assignment.totalAssigned,
                            submittedCount_before: assignment.submittedCount
                        });
                    }
                    
                    // Count as submitted if status >= 2
                    if (report.status >= 2) {
                        assignment.submittedCount++;
                        if (isCoordinatorOwnAssignment) {
                            console.log('✅ [DEBUG] Marked as submitted. New submittedCount:', assignment.submittedCount);
                        }
                    } else {
                        if (isCoordinatorOwnAssignment) {
                            console.log('⏳ [DEBUG] Status < 2, not counted as submitted. Status:', report.status);
                        }
                    }
                });
                
                // Debug: Log final counts for coordinator's own assignments
                coordinatorOwnAssignmentIds.forEach(assignmentId => {
                    const assignment = assignmentMap.get(assignmentId);
                    if (assignment) {
                        console.log('📈 [DEBUG] FINAL COUNT for coordinator own assignment:', {
                            assignmentId,
                            assignment_title: assignment.assignment_title,
                            totalAssigned: assignment.totalAssigned,
                            submittedCount: assignment.submittedCount,
                            reports_count: assignment.reports.length,
                            report_details: assignment.reports.map(r => ({
                                submission_id: r.submission_id,
                                submitted_by: r.submitted_by,
                                status: r.status
                            }))
                        });
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
                
                // Highlight coordinator's own assignments in console
                const coordinatorOwnInGrouped = groupedData.filter(g => 
                    coordinatorOwnReports.some(r => r.report_assignment_id === g.report_assignment_id)
                );
                if (coordinatorOwnInGrouped.length > 0) {
                    console.log('═══════════════════════════════════════════════════════════');
                    console.log('🎯 COORDINATOR OWN ASSIGNMENTS - SUBMISSION COUNTS:');
                    coordinatorOwnInGrouped.forEach(assignment => {
                        console.log(`  Assignment ID: ${assignment.report_assignment_id}`);
                        console.log(`  Title: ${assignment.assignment_title}`);
                        console.log(`  Submitted: ${assignment.submitted}/${assignment.total}`);
                        console.log(`  Status: ${assignment.status}`);
                        console.log('  ───────────────────────────────────────────────────────');
                    });
                    console.log('═══════════════════════════════════════════════════════════');
                }
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
                console.log('🔍 [DEBUG] Filtering by school year:', selectedSchoolYear);
                console.log('🔍 [DEBUG] Available school years in data:', [...new Set(filtered.map(g => g.school_year))]);
                console.log('🔍 [DEBUG] Available school years from admin API:', schoolYears);
                
                // Find the selected school year object from the admin API data
                const selectedYearObj = schoolYears.find(year => year.school_year === selectedSchoolYear);
                console.log('🔍 [DEBUG] Selected year object:', selectedYearObj);
                
                if (selectedYearObj) {
                    filtered = filtered.filter(group => {
                        // Compare using the year_id from the admin API data
                        const matches = group.year === selectedYearObj.year_id;
                        console.log('🔍 [DEBUG] Year filter:', {
                            groupYear: group.year,
                            selectedYearId: selectedYearObj.year_id,
                            selectedSchoolYear: selectedSchoolYear,
                            matches,
                            groupYearType: typeof group.year,
                            selectedYearIdType: typeof selectedYearObj.year_id
                        });
                        return matches;
                    });
                } else {
                    console.log('🔍 [DEBUG] Selected year object not found, using fallback comparison');
                    filtered = filtered.filter(group => {
                        const matches = group.school_year === selectedSchoolYear;
                        console.log('🔍 [DEBUG] Fallback year filter:', {
                            groupYear: group.school_year,
                            selectedSchoolYear: selectedSchoolYear,
                            matches
                        });
                        return matches;
                    });
                }
                console.log('🔍 [DEBUG] After school year filter:', filtered.length, 'reports remaining');
            }

            // Filter by quarter
            if (selectedQuarter) {
                console.log('🔍 [DEBUG] Filtering by quarter:', selectedQuarter);
                filtered = filtered.filter(group => {
                    const matches = group.quarter.toString() === selectedQuarter;
                    console.log('🔍 [DEBUG] Quarter filter:', {
                        groupQuarter: group.quarter,
                        selectedQuarter: selectedQuarter,
                        matches
                    });
                    return matches;
                });
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
                    <Breadcrumb />
                    <div className="dashboard-main">
                        
                        {/* School Year and Quarter Dropdowns */}
                        <div className="filter-dropdowns">
                            <div className="dropdown-group">
                                <label htmlFor="school-year-select">School Year:</label>
                                <select 
                                    id="school-year-select"
                                    value={selectedSchoolYear || ''} 
                                    onChange={(e) => setSelectedSchoolYear(e.target.value)}
                                    className="dropdown-select"
                                >
                                    <option value="">Select School Year</option>
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
                                            {filteredGroupedReports.map((report) => {
                                                // Helper function to detect report type
                                                const detectReportType = (categoryName, subCategoryName, title, categoryId, subCategoryId) => {
                                                    const cat = (categoryName || "").toLowerCase();
                                                    const subCat = (subCategoryName || "").toLowerCase();
                                                    const t = (title || "").toLowerCase();
                                                    
                                                    // Check by category_id first (more reliable)
                                                    // category_id 0 = Accomplishment Report
                                                    if (categoryId === 0) {
                                                        return "accomplishment";
                                                    }
                                                    
                                                    // category_id 1 = Quarterly Achievement Test
                                                    if (categoryId === 1) {
                                                        // Check sub_category_id for LAEMPL & MPS
                                                        if (subCategoryId === 3) {
                                                            return "laempl"; // LAEMPL & MPS
                                                        }
                                                        // Other subcategories under Quarterly Achievement Test
                                                        if (subCat.includes("laempl") || subCat.includes("mps")) {
                                                            return "laempl";
                                                        }
                                                    }
                                                    
                                                    // Fallback to name-based detection
                                                    if (cat.includes("accomplishment")) return "accomplishment";
                                                    if (subCat.includes("laempl") || subCat.includes("mps")) return "laempl";
                                                    if (t.includes("laempl")) return "laempl";
                                                    if (t.includes("mps")) return "mps";
                                                    if (t.includes("classification")) return "cog";
                                                    return "generic";
                                                };
                                                
                                                const handleRowClick = async () => {
                                                    try {
                                                        console.log("[AssignedReport] Row clicked, report:", report);
                                                        console.log("[AssignedReport] Fetching assignment:", report.report_assignment_id);
                                                        
                                                        // Fetch report assignment details to get instruction
                                                        const res = await fetch(`${API_BASE}/reports/assignment/${report.report_assignment_id}`, {
                                                            credentials: "include"
                                                        });
                                                        
                                                        console.log("[AssignedReport] Fetch response status:", res.status);
                                                        
                                                        if (res.ok) {
                                                            const assignmentData = await res.json();
                                                            console.log("[AssignedReport] Assignment data:", assignmentData);
                                                            
                                                            const reportType = detectReportType(
                                                                report.category_name,
                                                                report.sub_category_name,
                                                                report.assignment_title,
                                                                assignmentData.category_id,
                                                                assignmentData.sub_category_id
                                                            );
                                                            
                                                            console.log("[AssignedReport] Detected report type:", reportType);
                                                            
                                                            const commonState = {
                                                                submission_id: report.first_submission_id,
                                                                report_assignment_id: report.report_assignment_id,
                                                                title: assignmentData.title || report.assignment_title,
                                                                instruction: assignmentData.instruction || "",
                                                                from_date: assignmentData.from_date || report.from_date,
                                                                to_date: assignmentData.to_date || report.to_date,
                                                                number_of_submission: assignmentData.number_of_submission,
                                                                allow_late: assignmentData.allow_late,
                                                                is_given: assignmentData.is_given,
                                                                recipients_count: report.total,
                                                                category_name: report.category_name,
                                                                sub_category_name: report.sub_category_name,
                                                                fromAssignedReport: true // Flag to indicate navigation from AssignedReport
                                                            };
                                                            
                                                            console.log("[AssignedReport] Navigating with state:", commonState);
                                                            
                                                            // Navigate to appropriate instruction page
                                                            if (reportType === "laempl") {
                                                                console.log("[AssignedReport] Navigating to LAEMPLInstruction");
                                                                navigate("/LAEMPLInstruction", { state: commonState });
                                                            } else if (reportType === "mps") {
                                                                console.log("[AssignedReport] Navigating to MPSInstruction");
                                                                navigate("/MPSInstruction", { state: commonState });
                                                            } else if (reportType === "accomplishment") {
                                                                console.log("[AssignedReport] Navigating to AccomplishmentReportInstruction");
                                                                navigate("/AccomplishmentReportInstruction", { state: commonState });
                                                            } else if (reportType === "cog") {
                                                                console.log("[AssignedReport] Navigating to ClassificationOfGradesInstruction");
                                                                navigate("/ClassificationOfGradesInstruction", { state: commonState });
                                                            } else {
                                                                console.log("[AssignedReport] Generic report type, using fallback");
                                                                // Fallback to AssignedReportData for generic reports
                                                                navigate(`/AssignedReportData/${report.first_submission_id}`, { state: { assignmentTitle: report.assignment_title } });
                                                            }
                                                        } else {
                                                            const errorText = await res.text().catch(() => 'Unknown error');
                                                            console.error("[AssignedReport] Fetch failed:", res.status, errorText);
                                                            // If fetch fails, fallback to original navigation
                                                            navigate(`/AssignedReportData/${report.first_submission_id}`, { state: { assignmentTitle: report.assignment_title } });
                                                        }
                                                    } catch (error) {
                                                        console.error("[AssignedReport] Error fetching assignment details:", error);
                                                        // Fallback to original navigation
                                                        navigate(`/AssignedReportData/${report.first_submission_id}`, { state: { assignmentTitle: report.assignment_title } });
                                                    }
                                                };
                                                
                                                return (
                                                <tr key={report.report_assignment_id} onClick={handleRowClick}>
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
                                                );
                                            })}
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