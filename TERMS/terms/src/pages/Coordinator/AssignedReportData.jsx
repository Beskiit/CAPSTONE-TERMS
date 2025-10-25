import React from "react";
import Sidebar from "../../components/shared/SidebarCoordinator";
import "./AssignedReport.css";
import "../Teacher/ViewSubmission.css";
import SidebarPrincipal from "../../components/shared/SidebarPrincipal";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../../components/shared/Header";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import toast from "react-hot-toast";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } from "docx";
import { saveAs } from "file-saver";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function AssignedReportData() {
    const navigate = useNavigate();
    const { submissionId } = useParams();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submission, setSubmission] = useState(null);
    const [error, setError] = useState("");
    const [retryCount, setRetryCount] = useState(0);

    // New states for assignment navigation
    const [allSubmissions, setAllSubmissions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [assignmentInfo, setAssignmentInfo] = useState(null);


    // States for LAEMPL and MPS data (extracted from submission)
    const [laemplData, setLaemplData] = useState(null);
    const [mpsData, setMpsData] = useState(null);
    
    // States for consolidated view (Principal/Coordinator)
    const [isPrincipalView, setIsPrincipalView] = useState(false);
    const [allSections, setAllSections] = useState([]);
    const [consolidatedData, setConsolidatedData] = useState({});
    const [peerData, setPeerData] = useState([]);
    const [loadingConsolidated, setLoadingConsolidated] = useState(false);
    
    // Subject names for dynamic column labels
    const [subjectNames, setSubjectNames] = useState({});
    
    // Debug assignmentInfo changes
    useEffect(() => {
        console.log('AssignmentInfo updated:', assignmentInfo);
    }, [assignmentInfo]);
    
    // MPS column definitions (from ForApprovalData)
    const DEFAULT_COLS_MPS = [
        { key: "m",      label: "Male" },
        { key: "f",      label: "Female" },
        { key: "total",  label: "Total no. of Pupils" },
        { key: "total_score", label: "Total Score" },
        { key: "mean",   label: "Mean" },
        { key: "median", label: "Median" },
        { key: "pl",     label: "PL" },
        { key: "mps",    label: "MPS" },
        { key: "sd",     label: "SD" },
        { key: "target", label: "Target" },
        { key: "hs",     label: "HS" },
        { key: "ls",     label: "LS" },
    ];
    
    const [COLS_MPS, setCOLS_MPS] = useState(DEFAULT_COLS_MPS);
    
    // Helper function to get column labels (from ForApprovalData)
    const getColumnLabel = (key, subjectNames = {}) => {
        const labelMap = {
            'm': 'M',
            'f': 'F',
            'gmrc': 'GMRC (15 - 25 points)',
            'math': 'Mathematics (15 - 25 points)',
            'lang': 'Language (15 - 25 points)',
            'read': 'Reading and Literacy (15 - 25 points)',
            'makabasa': 'MAKABASA (15 - 25 points)',
            'english': 'English (15 - 25 points)',
            'araling_panlipunan': 'Araling Panlipunan (15 - 25 points)',
            'total_score': 'Total Score',
            'hs': 'HS',
            'ls': 'LS',
            'total_items': 'Total no. of Items'
        };
        
        // Handle subject IDs (e.g., subject_8, subject_10)
        if (key.startsWith('subject_')) {
            const subjectId = key.replace('subject_', '');
            const subjectName = subjectNames[subjectId];
            return subjectName || `Subject ${subjectId}`;
        }
        
        return labelMap[key] || key.toUpperCase();
    };
    
    // Combined export function for both LAEMPL and MPS reports
    const exportBothReportsToCSV = (fields) => {
        const lines = [];
        
        // Export LAEMPL Report
        if (fields.rows && fields.rows.length > 0) {
            const rows = fields.rows;
            const traits = rows.map(row => row.trait).filter(Boolean);
            
            // Get dynamic columns from the first row
            let cols = [];
            if (rows.length > 0) {
                const firstRow = rows[0];
                cols = Object.keys(firstRow)
                    .filter(key => key !== 'trait')
                    .map(key => {
                        const cleanKey = key.replace(/[^a-zA-Z0-9]/g, '_');
                        return {
                            key: cleanKey,
                            originalKey: key,
                            label: getColumnLabel(cleanKey, subjectNames)
                        };
                    });
            }
            
            lines.push("=== LAEMPL REPORT ===");
            const laemplHeader = ["Trait", ...cols.map(c => c.label)];
            const laemplRows = traits.map(trait => {
                const rowData = rows.find(r => r.trait === trait) || {};
                return [
                    trait,
                    ...cols.map(c => rowData[c.originalKey || c.key] || "")
                ];
            });
            
            lines.push(laemplHeader.map(x => `"${String(x).replace(/"/g, '""')}"`).join(","));
            laemplRows.forEach(row => {
                lines.push(row.map(x => `"${String(x).replace(/"/g, '""')}"`).join(","));
            });
        }
        
        // Export MPS Report if available
        if (fields.mps_rows && fields.mps_rows.length > 0) {
            lines.push(""); // Empty line separator
            lines.push("=== MPS REPORT ===");
            
            const mpsRows = fields.mps_rows;
            const mpsTraits = mpsRows.map(row => row.trait).filter(Boolean);
            const mpsCols = COLS_MPS;
            
            const mpsHeader = ["Trait", ...mpsCols.map(c => c.label)];
            const mpsCsvRows = mpsTraits.map(trait => {
                const rowData = mpsRows.find(r => r.trait === trait) || {};
                return [
                    trait,
                    ...mpsCols.map(c => rowData[c.key] || "")
                ];
            });
            
            lines.push(mpsHeader.map(x => `"${String(x).replace(/"/g, '""')}"`).join(","));
            mpsCsvRows.forEach(row => {
                lines.push(row.map(x => `"${String(x).replace(/"/g, '""')}"`).join(","));
            });
        }
        
        // Create and download the combined CSV
        const csvContent = lines.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Combined_Reports_${submissionId || 'export'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Function to fetch assignment details from report_assignment table
    const fetchAssignmentDetails = async (assignmentId) => {
        if (!assignmentId) return null;
        
        try {
            const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");
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

    // Function to fetch subject names (from ForApprovalData)
    const fetchSubjectNames = async (subjectIds) => {
        if (!subjectIds || subjectIds.length === 0) return;
        
        try {
            const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");
            const response = await fetch(`${API_BASE}/subjects`, {
                credentials: "include"
            });
            
            if (response.ok) {
                const subjects = await response.json();
                const subjectMap = {};
                subjects.forEach(subject => {
                    subjectMap[subject.subject_id] = subject.subject_name;
                });
                setSubjectNames(subjectMap);
                console.log('Subject names fetched:', subjectMap);
            }
        } catch (error) {
            console.error('Failed to fetch subject names:', error);
        }
    };
    
    // Export format state

    const role = (user?.role || "").toLowerCase();
    const isCoordinator = role === "coordinator";
    const isPrincipal = role === "principal";


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

    // Extract LAEMPL and MPS data from submission when it changes
    useEffect(() => {
        if (submission && submission.fields) {
            const fields = submission.fields;
            
            // Check if this is LAEMPL data
            if (fields.type === 'LAEMPL' || (fields.rows && fields.rows.some(row => row.gmrc !== undefined || row.math !== undefined))) {
                setLaemplData(submission);
                console.log('LAEMPL data extracted from submission:', submission);
                
                // If this is a principal view, fetch consolidated data
                if (isPrincipal) {
                    setIsPrincipalView(true);
                    fetchConsolidatedData();
                }
            }
            
            // Check if this is MPS data
            if (fields.type === 'MPS' || (fields.rows && fields.rows.some(row => row.mps !== undefined || row.mean !== undefined))) {
                setMpsData(submission);
                console.log('MPS data extracted from submission:', submission);
                
                // If this is a principal view, fetch consolidated data
                if (isPrincipal) {
                    setIsPrincipalView(true);
                    fetchConsolidatedData();
                }
            }
        }
    }, [submission, isPrincipal]);
    
    // Update column labels when subject names are fetched
    useEffect(() => {
        if (Object.keys(subjectNames).length > 0) {
            console.log('Subject names updated, refreshing column labels');
            // This will trigger a re-render with updated subject names
        }
    }, [subjectNames]);

    // Fetch consolidated data for principal view
    const fetchConsolidatedData = async () => {
        if (!submissionId || !isPrincipal) return;
        
        try {
            setLoadingConsolidated(true);
            const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");
            
            // Fetch peer data for consolidation
            const response = await fetch(`${API_BASE}/reports/laempl-mps/${submissionId}/peers`, {
                credentials: "include"
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Consolidated peer data:', data);
                setPeerData(data);
                
                // Set up sections based on grade level
                const gradeLevel = submission?.fields?.grade || 2;
                const sections = getSectionsForGrade(gradeLevel);
                setAllSections(sections);
                
                // Process consolidated data
                const consolidated = processConsolidatedData(data, sections);
                setConsolidatedData(consolidated);
            }
        } catch (err) {
            console.error('Failed to fetch consolidated data:', err);
        } finally {
            setLoadingConsolidated(false);
        }
    };

    // Get sections for a specific grade level
    const getSectionsForGrade = (gradeLevel) => {
        // This should match the sections in the database for the grade level
        // For now, using hardcoded sections for Grade 2
        if (gradeLevel === 2) {
            return [
                { section_name: "Gumamela", section_id: 9 },
                { section_name: "Rosal", section_id: 10 },
                { section_name: "Rose", section_id: 8 },
                { section_name: "Sampaguita", section_id: 7 }
            ];
        }
        // Add more grade levels as needed
        return [
            { section_name: "Section A", section_id: 1 },
            { section_name: "Section B", section_id: 2 }
        ];
    };

    // Process consolidated data from peer submissions
    const processConsolidatedData = (peerData, sections) => {
        const consolidated = {};
        
        sections.forEach(section => {
            consolidated[section.section_name] = {};
        });
        
        // Process each peer submission
        peerData.forEach(peer => {
            try {
                const fields = typeof peer.fields === 'string' ? JSON.parse(peer.fields) : peer.fields;
                const sectionName = peer.section_name || "Rosal";
                
                if (consolidated[sectionName]) {
                    // Merge the data for this section
                    if (fields.rows) {
                        fields.rows.forEach(row => {
                            if (row.trait) {
                                if (!consolidated[sectionName][row.trait]) {
                                    consolidated[sectionName][row.trait] = {};
                                }
                                Object.assign(consolidated[sectionName][row.trait], row);
                            }
                        });
                    }
                }
            } catch (err) {
                console.error('Error processing peer data:', err);
            }
        });
        
        return consolidated;
    };

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
                        // Always fetch assignment title from report_assignment table
                        console.log('Fetching report assignment details for ID:', submissionData.report_assignment_id);
                        const assignmentDetails = await fetchAssignmentDetails(submissionData.report_assignment_id);
                        console.log('Report assignment details fetched:', assignmentDetails);
                        
                        // Try different possible fields for the assignment title
                        let assignmentTitle = assignmentDetails?.title || 
                                           assignmentDetails?.assignment_title || 
                                           assignmentDetails?.report_title ||
                                           assignmentDetails?.name ||
                                           submissionData.assignment_title || 
                                           submissionData.value || 
                                           submissionData.title || 
                                           'Report Assignment';
                        
                        console.log('Final assignment title:', assignmentTitle);
                        
                        setAssignmentInfo({
                            assignment_title: assignmentTitle || 'Report Assignment',
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
                        // Always fetch assignment title from report_assignment table
                        console.log('Fetching report assignment details for ID (fallback):', submissionData.report_assignment_id);
                        const assignmentDetails = await fetchAssignmentDetails(submissionData.report_assignment_id);
                        console.log('Report assignment details fetched (fallback):', assignmentDetails);
                        
                        // Try different possible fields for the assignment title
                        let assignmentTitle = assignmentDetails?.title || 
                                           assignmentDetails?.assignment_title || 
                                           assignmentDetails?.report_title ||
                                           assignmentDetails?.name ||
                                           submissionData.assignment_title || 
                                           submissionData.value || 
                                           submissionData.title || 
                                           'Report Assignment';
                        
                        console.log('Final assignment title (fallback):', assignmentTitle);
                        
                        setAssignmentInfo({
                            assignment_title: assignmentTitle || 'Report Assignment',
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

    const exportToWord = async (submissionData) => {
        if (!submissionData || !submissionData.fields) {
            alert("No data available to export");
            return;
        }

        const fields = submissionData.fields;
        const answers = fields._answers || {};
        const activity = answers;

        // Normalize orientation via canvas (browser applies EXIF on decode)
        const normalizeImageForDocx = async (imageUrl, targetHeight = 150, maxWidth = 220) => {
            try {
                const res = await fetch(imageUrl, { credentials: "include" });
                if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
                const blob = await res.blob();
                const objUrl = URL.createObjectURL(blob);

                const img = await new Promise((resolve, reject) => {
                    const el = new Image();
                    el.onload = () => resolve(el);
                    el.onerror = reject;
                    el.src = objUrl;
                });

                const aspect = img.width && img.height ? img.width / img.height : 4 / 3;
                const height = targetHeight;
                const width = Math.min(Math.round(aspect * height), maxWidth);

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                const outBlob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
                URL.revokeObjectURL(objUrl);
                if (!outBlob) return null;

                return { buffer: new Uint8Array(await outBlob.arrayBuffer()), width, height };
            } catch (e) {
                console.error("normalizeImageForDocx error:", e);
                return null;
            }
        };

        // Build absolute URLs for stored images
        const imageItems = (answers.images || [])
            .map((img) => {
                if (typeof img === "string") return `${API_BASE}/uploads/accomplishments/${img}`;
                if (img?.url) return img.url.startsWith("/") ? `${API_BASE}${img.url}` : img.url;
                if (img?.filename) return `${API_BASE}/uploads/accomplishments/${img.filename}`;
                return null;
            })
            .filter(Boolean);

        const normalized = await Promise.all(imageItems.map((u) => normalizeImageForDocx(u, 150, 220)));
        const validImages = normalized.filter(Boolean);

        // === Build a small inner table: 2 images per row ===
        const makeTwoPerRowImageTable = () => {
            if (!validImages.length) {
                return new Paragraph({
                    children: [new TextRun({ text: "No images provided", italics: true })],
                });
            }

            const rows = [];
            const gapWidthDXA = 240; // ~ 0.17 inch gap (tweak as needed)

            for (let i = 0; i < validImages.length; i += 2) {
                const left = validImages[i];
                const right = validImages[i + 1]; // may be undefined for odd count

                const cells = [
                    new TableCell({
                        borders: { top: { size: 0 }, bottom: { size: 0 }, left: { size: 0 }, right: { size: 0 } },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new ImageRun({ data: left.buffer, transformation: { width: left.width, height: left.height } })],
                            }),
                        ],
                    }),
                ];

                if (right) {
                    // gap cell
                    cells.push(
                        new TableCell({
                            width: { size: gapWidthDXA, type: WidthType.DXA },
                            borders: { top: { size: 0 }, bottom: { size: 0 }, left: { size: 0 }, right: { size: 0 } },
                            children: [new Paragraph({})],
                        })
                    );
                    // right image cell
                    cells.push(
                        new TableCell({
                            borders: { top: { size: 0 }, bottom: { size: 0 }, left: { size: 0 }, right: { size: 0 } },
                            children: [
                                new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    children: [new ImageRun({ data: right.buffer, transformation: { width: right.width, height: right.height } })],
                                }),
                            ],
                        })
                    );
                }

                rows.push(new TableRow({ children: cells }));
            }

            return new Table({
                rows,
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: { top: { size: 0 }, bottom: { size: 0 }, left: { size: 0 }, right: { size: 0 } },
                alignment: AlignmentType.CENTER,
            });
        };

        try {
            const doc = new Document({
                sections: [
                    {
                        properties: {},
                        children: [
                            new Paragraph({ children: [new TextRun({ text: "Republic of the Philippines", bold: true, size: 24 })], alignment: AlignmentType.CENTER }),
                            new Paragraph({ children: [new TextRun({ text: "Department of Education", bold: true, size: 24 })], alignment: AlignmentType.CENTER }),
                            new Paragraph({ children: [new TextRun({ text: "Region III", bold: true, size: 20 })], alignment: AlignmentType.CENTER }),
                            new Paragraph({ children: [new TextRun({ text: "Schools Division of Bulacan", bold: true, size: 20 })], alignment: AlignmentType.CENTER }),
                            new Paragraph({ children: [new TextRun({ text: "Tuktukan Elementary School", bold: true, size: 20 })], alignment: AlignmentType.CENTER }),
                            new Paragraph({ text: "" }),
                            new Paragraph({ children: [new TextRun({ text: "ACTIVITY COMPLETION REPORT 2024-2025", bold: true, size: 28 })], alignment: AlignmentType.CENTER }),
                            new Paragraph({ text: "" }),

                            new Table({
                                width: { size: 100, type: WidthType.PERCENTAGE },
                                rows: [
                                    new TableRow({
                                        children: [
                                            new TableCell({
                                                width: { size: 30, type: WidthType.PERCENTAGE },
                                                children: [new Paragraph({ children: [new TextRun({ text: "Program/Activity Title:", bold: true })] })],
                                            }),
                                            new TableCell({
                                                width: { size: 70, type: WidthType.PERCENTAGE },
                                                children: [new Paragraph({ children: [new TextRun({ text: activity.activityName || "Not provided" })] })],
                                            }),
                                        ],
                                    }),
                                    new TableRow({
                                        children: [
                                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Facilitator/s:", bold: true })] })] }),
                                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: activity.facilitators || "Not provided" })] })] }),
                                        ],
                                    }),
                                    new TableRow({
                                        children: [
                                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Objectives:", bold: true })] })] }),
                                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: activity.objectives || "Not provided" })] })] }),
                                        ],
                                    }),
                                    new TableRow({
                                        children: [
                                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Program/Activity Design:", bold: true })] })] }),
                                            new TableCell({
                                                children: [
                                                    new Paragraph({ children: [new TextRun({ text: `Date: ${activity.date || "Not provided"}` })] }),
                                                    new Paragraph({ children: [new TextRun({ text: `Time: ${activity.time || "Not provided"}` })] }),
                                                    new Paragraph({ children: [new TextRun({ text: `Venue: ${activity.venue || "Not provided"}` })] }),
                                                    new Paragraph({ children: [new TextRun({ text: `Key Results: ${activity.keyResult || "Not provided"}` })] }),
                                                ],
                                            }),
                                        ],
                                    }),
                                    new TableRow({
                                        children: [
                                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Person/s Involved:", bold: true })] })] }),
                                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: activity.personsInvolved || "Not provided" })] })] }),
                                        ],
                                    }),
                                    new TableRow({
                                        children: [
                                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Expenses:", bold: true })] })] }),
                                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: activity.expenses || "Not provided" })] })] }),
                                        ],
                                    }),
                                    new TableRow({
                                        children: [
                                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Lessons Learned/Recommendation:", bold: true })] })] }),
                                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: activity.lessonLearned || "Not provided" })] })] }),
                                        ],
                                    }),

                                    // Picture/s row (2 images per row)
                                    new TableRow({
                                        children: [
                                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Picture/s:", bold: true })] })] }),
                                            new TableCell({ children: [makeTwoPerRowImageTable()] }),
                                        ],
                                    }),

                                    new TableRow({
                                        children: [
                                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Narrative:", bold: true })] })] }),
                                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: answers.narrative || "No narrative provided" })] })] }),
                                        ],
                                    }),
                                ],
                            }),

                            new Paragraph({ text: "" }),
                            new Paragraph({ children: [new TextRun({ text: "Activity Completion Report prepared by:", bold: true })] }),
                            new Paragraph({ text: "" }),
                            new Paragraph({ children: [new TextRun({ text: "Name: [Signature Name]", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: "Position: [Position Title]", bold: true })] }),
                        ],
                    },
                ],
            });

            const blob = await Packer.toBlob(doc);
            const fileName = `Activity_Completion_Report_${activity.activityName?.replace(/[^a-zA-Z0-9]/g, "_") || "Report"}.docx`;
            saveAs(blob, fileName);
        } catch (err) {
            console.error("Error generating Word document:", err);
            alert("Error generating document. Please try again.");
        }
    };


    const renderSubmissionContent = (submission) => {
        const fields = submission.fields || {};
        
        // Determine submission type based on fields structure
        if (fields.type === 'ACCOMPLISHMENT' || fields._answers) {
            return renderAccomplishmentReport(fields);
        } else if (fields.type === 'LAEMPL' && fields.rows && Array.isArray(fields.rows)) {
            return (
                <div>
                    {renderLAEMPLReport(fields)}
                    {fields.mps_rows && fields.mps_totals && (
                        <div style={{ marginTop: '2rem' }}>
                            {renderMPSReport({ rows: fields.mps_rows, totals: fields.mps_totals })}
                        </div>
                    )}
                </div>
            );
        } else if (fields.type === 'MPS' && fields.rows && Array.isArray(fields.rows)) {
            return renderMPSReport(fields);
        } else if (fields.rows && Array.isArray(fields.rows)) {
            // Check if it's LAEMPL or MPS based on column structure
            const hasLAEMPLCols = fields.rows.some(row => row.gmrc !== undefined || row.math !== undefined);
            const hasMPSCols = fields.rows.some(row => row.mps !== undefined || row.mean !== undefined);
            
            if (hasLAEMPLCols) {
                return (
                    <div>
                        {renderLAEMPLReport(fields)}
                        {fields.mps_rows && fields.mps_totals && (
                            <div style={{ marginTop: '2rem' }}>
                                {renderMPSReport({ rows: fields.mps_rows, totals: fields.mps_totals })}
                            </div>
                        )}
                    </div>
                );
            } else if (hasMPSCols) {
                return renderMPSReport(fields);
            } else {
                return renderLAEMPLReport(fields); // Default to LAEMPL
            }
        } else {
            // Fallback to generic display
            return renderGenericContent(fields);
        }
    };

    const renderAccomplishmentReport = (fields) => {
        // Debug: Log the fields structure
        console.log('🔍 [DEBUG] Fields structure:', fields);
        
        const answers = fields._answers || {};
        
        // Debug: Log the answers structure
        console.log('🔍 [DEBUG] Answers structure:', answers);
        console.log('🔍 [DEBUG] Activity name:', answers.activityName);
        console.log('🔍 [DEBUG] Narrative:', answers.narrative);
        console.log('🔍 [DEBUG] Images:', answers.images);
        
        // Try different possible field names for title
        const title = answers.activityName || answers.title || answers.activity_title || answers.program_title || '';
        
        // Try different possible field names for narrative
        const narrative = answers.narrative || answers.description || answers.summary || '';
        
        // Handle images - check different possible structures
        let images = [];
        
        // Check multiple possible image field names and structures
        const possibleImageFields = ['images', 'pictures', 'photos', 'attachments', 'files'];
        const possibleImagePaths = [
            answers.images,
            answers.pictures, 
            answers.photos,
            answers.attachments,
            answers.files,
            // Also check if images are in a nested structure
            answers._images,
            answers._pictures,
            answers._photos
        ];
        
        console.log('🔍 [DEBUG] Checking for images in answers:', answers);
        console.log('🔍 [DEBUG] Possible image paths:', possibleImagePaths);
        
        for (const imageField of possibleImagePaths) {
            if (imageField && Array.isArray(imageField) && imageField.length > 0) {
                console.log('🔍 [DEBUG] Found images in field:', imageField);
                images = imageField;
                break;
            }
        }
        
        // If no images found in answers, check the main fields object
        if (images.length === 0) {
            console.log('🔍 [DEBUG] No images in answers, checking main fields object');
            console.log('🔍 [DEBUG] Main fields object:', fields);
            
            for (const fieldName of possibleImageFields) {
                if (fields[fieldName] && Array.isArray(fields[fieldName]) && fields[fieldName].length > 0) {
                    console.log('🔍 [DEBUG] Found images in main fields:', fieldName, fields[fieldName]);
                    images = fields[fieldName];
                    break;
                }
            }
        }
        
        console.log('🔍 [DEBUG] Final title:', title);
        console.log('🔍 [DEBUG] Final narrative:', narrative);
        console.log('🔍 [DEBUG] Final images:', images);
        
        return (
            <div className="accomplishment-report-display">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h4>Activity Completion Report</h4>
                </div>
                <div className="form-display">
                    {/* Simplified format - only Title, Picture/s, and Narrative */}
                    <div className="form-row">
                        <label>Title:</label>
                        <div className="readonly-field">{title || 'No title provided'}</div>
                    </div>
                    
                    {images && images.length > 0 && (
                        <div className="form-row">
                            <label>Picture/s:</label>
                            <div className="image-gallery">
                                {images.map((img, index) => {
                                    // Handle different image formats and construct proper URLs
                                    let imageUrl = '';
                                    
                                    if (typeof img === 'string') {
                                        // If it's a string, it might be a filename or full URL
                                        if (img.startsWith('http') || img.startsWith('blob:')) {
                                            imageUrl = img;
                                        } else {
                                            // Construct full URL for filename
                                            imageUrl = `${API_BASE}/uploads/accomplishments/${img}`;
                                        }
                                    } else if (typeof img === 'object' && img !== null) {
                                        // Handle object format
                                        const rawUrl = img.url || img.src || img.path || img.filename;
                                        if (rawUrl) {
                                            if (rawUrl.startsWith('http') || rawUrl.startsWith('blob:')) {
                                                imageUrl = rawUrl;
                                            } else {
                                                imageUrl = `${API_BASE}/uploads/accomplishments/${rawUrl}`;
                                            }
                                        }
                                    }
                                    
                                    console.log('🖼️ [DEBUG] Processing image:', { img, imageUrl, index });
                                    
                                    return (
                                        <div key={index} className="image-item">
                                            <img 
                                                src={imageUrl} 
                                                alt={`Activity image ${index + 1}`}
                                                style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'cover' }}
                                                onError={(e) => {
                                                    console.error('❌ [DEBUG] Image failed to load:', imageUrl, e);
                                                    e.target.style.display = 'none';
                                                }}
                                                onLoad={() => {
                                                    console.log('✅ [DEBUG] Image loaded successfully:', imageUrl);
                                                }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    
                    <div className="form-row">
                        <label>Narrative:</label>
                        <div className="readonly-field narrative-content">{narrative || 'No narrative provided'}</div>
                    </div>
                </div>
            </div>
        );
    };

    const renderLAEMPLReport = (fields) => {
        const rows = fields.rows || [];
        
        // Extract dynamic traits and columns from the actual data (like ForApprovalData)
        const actualTraits = rows.map(row => row.trait).filter(Boolean);
        const traits = actualTraits.length > 0 ? actualTraits : ["Masipag", "Matulungin", "Masunurin", "Magalang", "Matapat", "Matiyaga"];
        
        // Extract columns from the first row
        let cols = [
            { key: "m", label: "M" },
            { key: "f", label: "F" },
            { key: "gmrc", label: "GMRC (15 - 25 points)" },
            { key: "math", label: "Mathematics (15 - 25 points)" },
            { key: "lang", label: "Language (15 - 25 points)" },
            { key: "read", label: "Reading and Literacy (15 - 25 points)" },
            { key: "makabasa", label: "MAKABASA (15 - 25 points)" },
        ];
        
        if (rows.length > 0) {
            const firstRow = rows[0];
            const actualCols = Object.keys(firstRow)
                .filter(key => key !== 'trait')
                .map(key => {
                    const cleanKey = key.replace(/[^a-zA-Z0-9]/g, '_');
                    return {
                        key: cleanKey,
                        originalKey: key,
                        label: getColumnLabel(cleanKey, subjectNames)
                    };
                });
            if (actualCols.length > 0) {
                cols = actualCols;
            }
            
            // Extract subject IDs and fetch subject names
            const subjectIds = Object.keys(firstRow)
                .filter(key => key.startsWith('subject_'))
                .map(key => key.replace('subject_', ''));
            
            if (subjectIds.length > 0) {
                console.log('Found subject IDs:', subjectIds);
                fetchSubjectNames(subjectIds);
            }
        }

        console.log('LAEMPL Report - Fields:', fields);
        console.log('LAEMPL Report - Is Principal View:', isPrincipalView);
        console.log('LAEMPL Report - All Sections:', allSections);
        console.log('LAEMPL Report - Consolidated Data:', consolidatedData);

        if (loadingConsolidated) {
            return (
                <div className="laempl-report-display">
                    <h4>LAEMPL Report - Loading Consolidated Data...</h4>
                    <div className="loading-message">Loading data from all sections...</div>
                </div>
            );
        }

        if (isPrincipalView) {
            // Principal view: show the same structure as ForApprovalData (traits as rows)
            return (
                <div className="laempl-report-display">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h4>LAEMPL Report</h4>
                        <button 
                            onClick={() => exportBothReportsToCSV(fields)}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            Export Both Reports
                        </button>
                    </div>
                    <div className="table-container">
                        <table className="laempl-table">
                            <thead>
                                <tr>
                                    <th>Trait</th>
                                    {cols.map(col => (
                                        <th key={col.key}>{col.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {traits.map(trait => {
                                    const rowData = rows.find(r => r.trait === trait) || {};
                                    return (
                                        <tr key={trait}>
                                            <td className="trait-cell">{trait}</td>
                                            {cols.map(col => (
                                                <td key={col.key} className="data-cell">
                                                    {rowData[col.originalKey || col.key] || ''}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        } else {
            // Regular view: show single submission data
            const rows = fields.rows || [];
            console.log('LAEMPL Report - Rows:', rows);

            return (
                <div className="laempl-report-display">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h4>LAEMPL Report</h4>
                        <button 
                            onClick={() => exportBothReportsToCSV(fields)}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            Export Both Reports
                        </button>
                    </div>
                    <div className="table-container">
                        <table className="laempl-table">
                            <thead>
                                <tr>
                                    <th>Trait</th>
                                    {cols.map(col => (
                                        <th key={col.key}>{col.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {traits.map(trait => {
                                    const rowData = rows.find(r => r.trait === trait) || {};
                                    console.log(`Row data for ${trait}:`, rowData);
                                    return (
                                        <tr key={trait}>
                                            <td className="trait-cell">{trait}</td>
                                            {cols.map(col => (
                                                <td key={col.key} className="data-cell">
                                                    {rowData[col.originalKey || col.key] || ''}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }
    };

    const renderMPSReport = (fields) => {
        const rows = fields.rows || [];
        
        // Extract dynamic traits and columns from the actual data (like ForApprovalData)
        const actualTraits = rows.map(row => row.trait).filter(Boolean);
        const traits = actualTraits.length > 0 ? actualTraits : ["Masipag", "Matulungin", "Masunurin", "Magalang", "Matapat", "Matiyaga"];
        
        // Use the state variable for MPS columns
        let cols = COLS_MPS;
        
        if (rows.length > 0) {
            const firstRow = rows[0];
            const actualCols = Object.keys(firstRow)
                .filter(key => key !== 'trait')
                .map(key => {
                    const cleanKey = key.replace(/[^a-zA-Z0-9]/g, '_');
                    return {
                        key: cleanKey,
                        originalKey: key,
                        label: getColumnLabel(cleanKey, subjectNames)
                    };
                });
            if (actualCols.length > 0) {
                cols = actualCols;
            }
            
            // Extract subject IDs and fetch subject names
            const subjectIds = Object.keys(firstRow)
                .filter(key => key.startsWith('subject_'))
                .map(key => key.replace('subject_', ''));
            
            if (subjectIds.length > 0) {
                console.log('Found subject IDs:', subjectIds);
                fetchSubjectNames(subjectIds);
            }
        }

        console.log('MPS Report - Fields:', fields);
        console.log('MPS Report - Is Principal View:', isPrincipalView);
        console.log('MPS Report - All Sections:', allSections);
        console.log('MPS Report - Consolidated Data:', consolidatedData);

        if (loadingConsolidated) {
            return (
                <div className="mps-report-display">
                    <h4>MPS Report - Loading Consolidated Data...</h4>
                    <div className="loading-message">Loading data from all sections...</div>
                </div>
            );
        }

        if (isPrincipalView) {
            // Principal view: show the same structure as ForApprovalData (traits as rows)
            return (
                <div className="mps-report-display">
                    <h4>MPS Report</h4>
                    <div className="table-container">
                        <table className="mps-table">
                            <thead>
                                <tr>
                                    <th>Trait</th>
                                    {cols.map(col => (
                                        <th key={col.key}>{col.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {traits.map(trait => {
                                    const rowData = rows.find(r => r.trait === trait) || {};
                                    return (
                                        <tr key={trait}>
                                            <td className="trait-cell">{trait}</td>
                                            {cols.map(col => (
                                                <td key={col.key} className="data-cell">
                                                    {rowData[col.originalKey || col.key] || ''}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        } else {
            // Regular view: show single submission data
            const rows = fields.rows || [];
            console.log('MPS Report - Rows:', rows);

            return (
                <div className="mps-report-display">
                    <h4>MPS Report</h4>
                    <div className="table-container">
                        <table className="mps-table">
                            <thead>
                                <tr>
                                    <th>Trait</th>
                                    {cols.map(col => (
                                        <th key={col.key}>{col.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {traits.map(trait => {
                                    const rowData = rows.find(r => r.trait === trait) || {};
                                    console.log(`MPS Row data for ${trait}:`, rowData);
                                    return (
                                        <tr key={trait}>
                                            <td className="trait-cell">{trait}</td>
                                            {cols.map(col => (
                                                <td key={col.key} className="data-cell">
                                                    {rowData[col.originalKey || col.key] || ''}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }
    };

    const renderGenericContent = (fields) => {
        return (
            <div className="generic-content">
                {fields.narrative && (
                    <div>
                        <h4>Narrative:</h4>
                        <p>{fields.narrative}</p>
                    </div>
                )}
                {fields.images && fields.images.length > 0 && (
                    <div>
                        <h4>Images:</h4>
                        <div className="image-gallery">
                            {fields.images.map((img, index) => (
                                <div key={index} className="image-item">
                                    <img src={img.url || img} alt={`Submission image ${index + 1}`} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
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
                        <div className="page-header">
                            <button 
                                onClick={() => navigate(-1)} 
                                className="back-button"
                                style={{
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    marginBottom: '20px'
                                }}
                            >
                                ← Back
                            </button>
                            <h2>Submitted Report Details</h2>
                        </div>
                        
                        {/* Assignment Navigation */}
                        {assignmentInfo && (
                            <div className="assignment-navigation">
                                <div className="assignment-info">
                                    <h3>{submission.title || submission.value || assignmentInfo.assignment_title}</h3>
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
                                <label>Title:</label>
                                <span>{(() => {
                                    const title = assignmentInfo?.assignment_title || submission.title || submission.value || 'Report';
                                    console.log('Title display debug:', {
                                        assignmentInfo: assignmentInfo,
                                        assignmentInfo_title: assignmentInfo?.assignment_title,
                                        submission_title: submission.title,
                                        submission_value: submission.value,
                                        submission_id: submission.submission_id,
                                        report_assignment_id: submission.report_assignment_id,
                                        final_title: title
                                    });
                                    return title;
                                })()}</span>
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
                                <label>Submitted By:</label>
                                <span>{submission.submitted_by_name || submission.submitted_by || 'Unknown'}</span>
                            </div>
                        </div>
                        
                        {submission.fields && (
                            <div className="submission-content">
                                <div className="content-section">
                                    {renderSubmissionContent(submission)}
                                </div>
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
                        
                    </div>
                </div>
            </div> 

        </>
    )
}

export default AssignedReportData;