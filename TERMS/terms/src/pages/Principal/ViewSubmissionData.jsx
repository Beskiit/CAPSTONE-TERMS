import React, { useState, useEffect, useRef } from "react";
import Header from "../../components/shared/Header.jsx";
import Breadcrumb from "../../components/Breadcrumb.jsx";
import Sidebar from "../../components/shared/SidebarPrincipal.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import "../Teacher/LAEMPLReport.css";
import "./ForApprovalData.css";
import "./ForApproval.css";
import "../Coordinator/AssignedReport.css";
import "../Teacher/ViewSubmission.css";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } from "docx";
import { saveAs } from "file-saver";
import { useAuth } from "../../context/AuthContext.jsx";
import * as XLSX from "xlsx";

const API_BASE = import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com";

// Get submission ID from URL - use multiple methods for reliability
const getSubmissionId = () => {
  // Method 1: URLSearchParams
  const urlParams = new URLSearchParams(window.location.search);
  const idFromParams = urlParams.get("id");
  
  // Method 2: Direct URL parsing
  const urlMatch = window.location.href.match(/[?&]id=(\d+)/);
  const idFromUrl = urlMatch ? urlMatch[1] : null;
  
  // Method 3: Check if we're in a React Router context
  const idFromHash = window.location.hash.match(/[?&]id=(\d+)/);
  const idFromHashMatch = idFromHash ? idFromHash[1] : null;
  
  console.log('URL parsing debug:');
  console.log('- Full URL:', window.location.href);
  console.log('- Search params:', window.location.search);
  console.log('- Hash:', window.location.hash);
  console.log('- ID from URLSearchParams:', idFromParams);
  console.log('- ID from URL regex:', idFromUrl);
  console.log('- ID from hash regex:', idFromHashMatch);
  
  return idFromParams || idFromUrl || idFromHashMatch;
};

const SUBMISSION_ID = getSubmissionId();
const FIXED_COL_WIDTH = 25;
const applySheetSizing = (worksheet, data) => {
  const maxCols = data.reduce((max, row) => Math.max(max, row.length), 0);
  worksheet["!cols"] = Array.from({ length: maxCols }, () => ({
    wch: FIXED_COL_WIDTH,
  }));
  worksheet["!rows"] = data.map((row) => {
    const longest = row.reduce((max, cell) => {
      if (cell == null) return max;
      return Math.max(max, cell.toString().length);
    }, 0);
    const lines = Math.max(1, Math.ceil(longest / FIXED_COL_WIDTH));
    return { hpt: Math.min(18 * lines, 120) };
  });
};

// Helper function to sanitize keys from database (e.g., "English (15 - 25 points)" -> "english")
const sanitizeKey = (rawKey) => {
  // Remove "(XX - YY points)" part and convert to snake_case
  let cleanKey = rawKey.replace(/\s*\(\d+\s*-\s*\d+\s*points\)/g, '').trim();
  cleanKey = cleanKey.toLowerCase().replace(/\s/g, '_');
  return cleanKey;
};

  // Helper function to get column labels
const getColumnLabel = (key, subjectNames = {}) => {
  const labelMap = {
    'm': 'No. of Male',
    'f': 'No. of Female',
    'no_of_cases': 'No. of Cases',
    'no_of_items': 'No. of Items',
    'total_score': 'Total Score',
    'hs': 'Highest Score',
    'ls': 'Lowest Score',
    'highest_score': 'Highest Score',
    'lowest_score': 'Lowest Score',
    'male_passed': 'Number of Male Learners who Passed (MPL)',
    'male_mpl_percent': '% MPL (MALE)',
    'female_passed': 'Number of Female who passed(MPL)',
    'female_mpl_percent': '% MPL(FEMALE)',
    'total_passed': 'Number of Learners who Passed(MPL)',
    'total_mpl_percent': '% MPL(TOTAL)',
    'total_items': 'Total no. of Items',
    'gmrc': 'GMRC (15 - 25 points)',
    'math': 'Mathematics (15 - 25 points)',
    'lang': 'Language (15 - 25 points)',
    'read': 'Reading and Literacy (15 - 25 points)',
    'makabasa': 'MAKABASA (15 - 25 points)',
    'english': 'English (15 - 25 points)',
    'araling_panlipunan': 'Araling Panlipunan (15 - 25 points)',
  };
  
  // Handle subject IDs (e.g., subject_8, subject_10) - but we're removing subject columns
  if (key.startsWith('subject_')) {
    return null; // Don't show subject columns
  }
  
  // Normalize key for matching (handle both lowercase and uppercase)
  const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [mapKey, label] of Object.entries(labelMap)) {
    const normalizedMapKey = mapKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedKey === normalizedMapKey) {
      return label;
    }
  }
  
  // If no match found, try to format common patterns
  if (normalizedKey.includes('highest') || normalizedKey.includes('high')) {
    return 'Highest Score';
  }
  if (normalizedKey.includes('lowest') || normalizedKey.includes('low')) {
    return 'Lowest Score';
  }
  
  return key.toUpperCase();
};

// Default traits and columns - will be replaced with dynamic data
const DEFAULT_TRAITS = ["Masipag","Matulungin","Masunurin","Magalang","Matapat","Matiyaga"];

const DEFAULT_COLS = [
  { key: "m",        label: "M" },
  { key: "f",        label: "F" },
  { key: "gmrc",     label: "GMRC (15 - 25 points)" },
  { key: "math",     label: "Mathematics (15 - 25 points)" },
  { key: "lang",     label: "Language (15 - 25 points)" },
  { key: "read",     label: "Reading and Literacy (15 - 25 points)" },
  { key: "makabasa", label: "MAKABASA (15 - 25 points)" },
];

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

const COL_RULES = {
  m: [0, 9999],
  f: [0, 9999],
  gmrc: [15, 25],
  math: [15, 25],
  lang: [15, 25],
  read: [15, 25],
  makabasa: [15, 25],
};

const clampVal = (k, v) => {
  if (v === "" || v == null) return "";
  const n = Number(v);
  if (Number.isNaN(n)) return "";
  const [min, max] =
    COL_RULES[k] || [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
  return Math.max(min, Math.min(max, n)).toString();
};

const LOCK_STATUSES = new Set([1]); // e.g., 1=submitted

function ViewSubmissionData() {
  const { user } = useAuth();
  const [openPopup, setOpenPopup] = useState(false);

  // NEW: submission data state
  const [submissionData, setSubmissionData] = useState(null);
  const [submissionType, setSubmissionType] = useState(null); // 'LAEMPL' or 'ACCOMPLISHMENT'
  const [submissionLoading, setSubmissionLoading] = useState(true);
  const [submissionError, setSubmissionError] = useState(null);
  const [currentSubmissionId, setCurrentSubmissionId] = useState(SUBMISSION_ID);
  const [submittedByName, setSubmittedByName] = useState(undefined);
  const hasAttemptedFetch = useRef(false);

  // Dynamic data structure from database
  const [TRAITS, setTRAITS] = useState(DEFAULT_TRAITS);
  const [COLS, setCOLS] = useState(DEFAULT_COLS);
  const [COLS_MPS, setCOLS_MPS] = useState(DEFAULT_COLS_MPS);
  const [subjectNames, setSubjectNames] = useState({});
  
  // Function to fetch subject names
  const fetchSubjectNames = async (subjectIds) => {
    if (!subjectIds || subjectIds.length === 0) return;
    
    try {
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
      console.error('Error fetching subject names:', error);
    }
  };
  
  // Export format state


  // Re-check URL parameters on component mount
  useEffect(() => {
    const recheckId = getSubmissionId();
    console.log('Re-checking submission ID on mount:', recheckId);
    if (recheckId && recheckId !== currentSubmissionId) {
      setCurrentSubmissionId(recheckId);
    }
  }, []);

  // NEW: Fetch submission data and determine type
  useEffect(() => {
      const fetchSubmissionData = async () => {
        const submissionId = currentSubmissionId || SUBMISSION_ID;
        console.log('Using submission ID:', submissionId);
        
        if (!submissionId) {
          setSubmissionError("No submission ID provided in the URL. Please go back to the View Submission list and try again.");
          setSubmissionLoading(false);
          return;
        }

      // Reset the fetch attempt flag when submission ID changes
      hasAttemptedFetch.current = false;
      setSubmittedByName(undefined);

      try {
        setSubmissionLoading(true);
        setSubmissionError(null);

        // Try to fetch submission data from multiple endpoints
        let data = null;
        let response = null;
        let lastError = null;

        console.log(`URL: ${window.location.href}`);
        console.log(`URL Search Params: ${window.location.search}`);
        console.log(`Attempting to fetch submission with ID: ${submissionId}`);

        // First try submissions endpoint (includes assignment title)
        try {
          console.log(`Trying submissions endpoint: ${API_BASE}/submissions/${submissionId}`);
          response = await fetch(`${API_BASE}/submissions/${submissionId}`, {
            credentials: "include"
          });
          console.log(`Submissions endpoint response status: ${response.status}`);
          
          if (response.ok) {
            data = await response.json();
            console.log('Successfully fetched from submissions endpoint');
            
            // Determine submission type based on fields
            const fields = data.fields || {};
            if (fields.type === 'ACCOMPLISHMENT') {
              setSubmissionType('ACCOMPLISHMENT');
            } else if (fields._form || fields._answers) {
              setSubmissionType('LAEMPL');
            } else {
              // Default to LAEMPL for backward compatibility
              setSubmissionType('LAEMPL');
            }
          } else {
            lastError = `Submissions endpoint returned ${response.status}`;
          }
        } catch (error) {
          console.log("Submissions endpoint failed:", error.message);
          lastError = error.message;
        }

        // If submissions endpoint failed, try accomplishment endpoint as fallback
        if (!data) {
          try {
            console.log(`Trying accomplishment endpoint: ${API_BASE}/reports/accomplishment/${submissionId}`);
            response = await fetch(`${API_BASE}/reports/accomplishment/${submissionId}`, {
              credentials: "include"
            });
            console.log(`Accomplishment endpoint response status: ${response.status}`);
            
            if (response.ok) {
              data = await response.json();
              setSubmissionType('ACCOMPLISHMENT');
              console.log('Successfully fetched from accomplishment endpoint');
            } else {
              lastError = `Accomplishment endpoint returned ${response.status}`;
            }
          } catch (error) {
            console.log("Accomplishment endpoint also failed:", error.message);
            lastError = error.message;
          }
        }

        if (!data) {
          const errorMessage = `Failed to fetch submission with ID ${submissionId}. ${lastError || 'Unknown error'}`;
          console.error(errorMessage);
          throw new Error(errorMessage);
        }

        setSubmissionData(data);
        // Note: User name fetching is handled in the useEffect hook below

        // Extract dynamic table structure from submission data
        const fields = data.fields || {};
        if (fields.rows && Array.isArray(fields.rows) && fields.rows.length > 0) {
          // Extract dynamic traits from the actual data
          const actualTraits = fields.rows.map(row => row.trait).filter(Boolean);
          if (actualTraits.length > 0) {
            setTRAITS(actualTraits);
            console.log('Dynamic traits extracted from database:', actualTraits);
          }
          
          // Extract subject IDs from the first row
          const firstRow = fields.rows[0];
          if (firstRow) {
            const subjectIds = Object.keys(firstRow)
              .filter(key => key.startsWith('subject_'))
              .map(key => key.replace('subject_', ''));
            
            // Fetch subject names if subject IDs are found
            if (subjectIds.length > 0) {
              console.log('Found subject IDs:', subjectIds);
              fetchSubjectNames(subjectIds);
            }
            
            // Extract dynamic columns from the first row, excluding subject columns
            const requiredColumnOrder = [
              'm', 'f', 'no_of_cases', 'no_of_items', 'total_score', 
              'hs', 'ls', 'male_passed', 'male_mpl_percent', 
              'female_passed', 'female_mpl_percent', 'total_passed', 'total_mpl_percent'
            ];
            
            const allCols = Object.keys(firstRow)
              .filter(key => key !== 'trait' && !key.startsWith('subject_'))
              .map(key => ({
                key: sanitizeKey(key),
                originalKey: key,
                label: getColumnLabel(sanitizeKey(key), subjectNames)
              }))
              .filter(col => col.label !== null); // Filter out null labels (subject columns)
            
            // Order columns according to required order
            const orderedCols = [];
            const processedKeys = new Set();
            
            // Add required columns first in order
            requiredColumnOrder.forEach(reqKey => {
              const col = allCols.find(c => {
                const normalized = c.key.toLowerCase().replace(/[^a-z0-9]/g, '');
                return normalized === reqKey.toLowerCase().replace(/[^a-z0-9]/g, '');
              });
              if (col) {
                orderedCols.push(col);
                processedKeys.add(col.key);
              }
            });
            
            // Add any remaining columns that weren't in the required order
            allCols.forEach(col => {
              if (!processedKeys.has(col.key)) {
                orderedCols.push(col);
              }
            });
            
            if (orderedCols.length > 0) {
              setCOLS(orderedCols);
              console.log('Dynamic columns extracted from database:', orderedCols);
            }
          }
        }

      } catch (error) {
        console.error("Error fetching submission data:", error);
        setSubmissionError(error.message);
      } finally {
        setSubmissionLoading(false);
      }
    };

    fetchSubmissionData();
  }, [currentSubmissionId]);

  // Fetch user name when submissionData changes
  useEffect(() => {
    if (!submissionData) return;
    
    // If we already have the name, use it
    if (submissionData.submitted_by_name) {
      if (submittedByName !== submissionData.submitted_by_name) {
        setSubmittedByName(submissionData.submitted_by_name);
        hasAttemptedFetch.current = true;
      }
      return;
    }
    
    // If submitted_by_name is null, the user doesn't exist in the database
    // Don't make an API call - just set to null and display the ID
    if (submissionData.submitted_by_name === null) {
      setSubmittedByName(null);
      hasAttemptedFetch.current = true;
      return;
    }
    
    // Only fetch if submitted_by_name is undefined (missing from response)
    // This handles edge cases where the field wasn't included in the response
    if (submissionData.submitted_by && !hasAttemptedFetch.current && submissionData.submitted_by_name === undefined) {
      hasAttemptedFetch.current = true;
      const fetchUserName = async () => {
        try {
          const userRes = await fetch(`${API_BASE}/users/${submissionData.submitted_by}`, {
            credentials: "include"
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            const userName = userData.name || userData.user_name || null;
            if (userName) {
              setSubmittedByName(userName);
            } else {
              setSubmittedByName(null);
            }
          } else {
            // User doesn't exist or other error - set to null
            setSubmittedByName(null);
          }
        } catch (err) {
          // Network error - set to null
          setSubmittedByName(null);
        }
      };
      fetchUserName();
    }
  }, [submissionData]);

  // Re-extract columns when subjectNames are updated
  useEffect(() => {
    if (submissionData && submissionData.fields && submissionData.fields.rows && Array.isArray(submissionData.fields.rows) && submissionData.fields.rows.length > 0) {
      const firstRow = submissionData.fields.rows[0];
      if (firstRow) {
        const requiredColumnOrder = [
          'm', 'f', 'no_of_cases', 'no_of_items', 'total_score', 
          'hs', 'ls', 'male_passed', 'male_mpl_percent', 
          'female_passed', 'female_mpl_percent', 'total_passed', 'total_mpl_percent'
        ];
        
        const allCols = Object.keys(firstRow)
          .filter(key => key !== 'trait' && !key.startsWith('subject_'))
          .map(key => ({
            key: sanitizeKey(key),
            originalKey: key,
            label: getColumnLabel(sanitizeKey(key), subjectNames)
          }))
          .filter(col => col.label !== null);
        
        // Order columns according to required order
        const orderedCols = [];
        const processedKeys = new Set();
        
        // Add required columns first in order
        requiredColumnOrder.forEach(reqKey => {
          const col = allCols.find(c => {
            const normalized = c.key.toLowerCase().replace(/[^a-z0-9]/g, '');
            return normalized === reqKey.toLowerCase().replace(/[^a-z0-9]/g, '');
          });
          if (col) {
            orderedCols.push(col);
            processedKeys.add(col.key);
          }
        });
        
        // Add any remaining columns that weren't in the required order
        allCols.forEach(col => {
          if (!processedKeys.has(col.key)) {
            orderedCols.push(col);
          }
        });
        
        if (orderedCols.length > 0) {
          setCOLS(orderedCols);
          console.log('Columns updated with subject names:', orderedCols);
        }
      }
    }
  }, [subjectNames, submissionData]);


  // Helper function to get status text
  const getStatusText = (status) => {
    switch (status) {
      case 1: return 'Draft';
      case 2: return 'Submitted';
      case 3: return 'Approved';
      case 4: return 'Rejected';
      default: return 'Unknown';
    }
  };

  const exportBothReportsToExcel = (fields) => {
    const workbook = XLSX.utils.book_new();

    if (fields.rows && fields.rows.length > 0) {
      const rows = fields.rows;
      const traits = rows.map((row) => row.trait).filter(Boolean);
      let cols = [];
      if (rows.length > 0) {
        const firstRow = rows[0];
        cols = Object.keys(firstRow)
          .filter((key) => key !== "trait")
          .map((key) => {
            const cleanKey = key.replace(/[^a-zA-Z0-9]/g, "_");
            return {
              key: cleanKey,
              originalKey: key,
              label: getColumnLabel(cleanKey, subjectNames),
            };
          });
      }

      const laemplHeader = ["Trait", ...cols.map((c) => c.label)];
      const laemplRows = traits.map((trait) => {
        const rowData = rows.find((r) => r.trait === trait) || {};
        return [
          trait,
          ...cols.map((c) => rowData[c.originalKey || c.key] || ""),
        ];
      });
      const laemplData = [laemplHeader, ...laemplRows];
      const laemplSheet = XLSX.utils.aoa_to_sheet(laemplData);
      applySheetSizing(laemplSheet, laemplData);
      XLSX.utils.book_append_sheet(workbook, laemplSheet, "LAEMPL");
    }

    if (fields.mps_rows && fields.mps_rows.length > 0) {
      const mpsRows = fields.mps_rows;
      const mpsTraits = mpsRows.map((row) => row.trait).filter(Boolean);
      const mpsHeader = ["Trait", ...COLS_MPS.map((c) => c.label)];
      const mpsSheetRows = mpsTraits.map((trait) => {
        const rowData = mpsRows.find((r) => r.trait === trait) || {};
        return [
          trait,
          ...COLS_MPS.map((c) => rowData[c.key] || ""),
        ];
      });
      const mpsData = [mpsHeader, ...mpsSheetRows];
      const mpsSheet = XLSX.utils.aoa_to_sheet(mpsData);
      applySheetSizing(mpsSheet, mpsData);
      XLSX.utils.book_append_sheet(workbook, mpsSheet, "MPS");
    }

    if (workbook.SheetNames.length === 0) {
      alert("No report data available to export.");
      return;
    }

    XLSX.writeFile(
      workbook,
      `Combined_Reports_${SUBMISSION_ID || "export"}.xlsx`
    );
  };

  // Export to Word function (exact copy from ForApprovalData)
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
    } else if (fields.rows && Array.isArray(fields.rows)) {
      // For LAEMPL submissions, show both LAEMPL and MPS tables
      return (
        <div>
          {renderLAEMPLReport(fields)}
          {fields.mps_rows && Array.isArray(fields.mps_rows) && fields.mps_rows.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              {renderMPSReport({ rows: fields.mps_rows })}
            </div>
          )}
        </div>
      );
    } else {
      // Fallback to generic display
      return renderGenericContent(fields);
    }
  };

  const renderAccomplishmentReport = (fields) => {
    const answers = fields._answers || {};
    
    return (
      <div className="accomplishment-report-display">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h4>Activity Completion Report</h4>
          <button
            onClick={() => exportToWord({ fields })}
            style={{
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Export to Word
          </button>
        </div>
        <div className="form-display">
          <div className="form-row">
            <label>Program/Activity Title:</label>
            <div className="readonly-field">{answers.activityName || ''}</div>
          </div>
          <div className="form-row">
            <label>Facilitator/s:</label>
            <div className="readonly-field">{answers.facilitators || ''}</div>
          </div>
          <div className="form-row">
            <label>Objectives:</label>
            <div className="readonly-field">{answers.objectives || ''}</div>
          </div>
          
          {/* Program/Activity Design Section */}
          <div className="activity-design-section">
            <div className="form-row">
              <label>Date:</label>
              <div className="readonly-field">{answers.date || ''}</div>
            </div>
            <div className="form-row">
              <label>Time:</label>
              <div className="readonly-field">{answers.time || ''}</div>
            </div>
            <div className="form-row">
              <label>Venue:</label>
              <div className="readonly-field">{answers.venue || ''}</div>
            </div>
            <div className="form-row">
              <label>Key Results:</label>
              <div className="readonly-field">{answers.keyResult || ''}</div>
            </div>
          </div>
          
          <div className="form-row">
            <label>Person/s Involved:</label>
            <div className="readonly-field">{answers.personsInvolved || ''}</div>
          </div>
          <div className="form-row">
            <label>Expenses:</label>
            <div className="readonly-field">{answers.expenses || ''}</div>
          </div>
          <div className="form-row">
            <label>Lesson Learned/Recommendation:</label>
            <div className="readonly-field narrative-content">{answers.lessonLearned || ''}</div>
          </div>
          {answers.images && answers.images.length > 0 && (
            <div className="form-row">
              <label>Picture/s:</label>
              <div className="image-gallery">
                {answers.images.map((img, index) => (
                  <div key={index} className="image-item">
                    <img src={img.url || img} alt={`Activity image ${index + 1}`} />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="form-row">
            <label>Narrative:</label>
            <div className="readonly-field narrative-content">{answers.narrative || ''}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderLAEMPLReport = (fields) => {
    const rows = fields.rows || [];
    // Use dynamic data structure from state
    const traits = TRAITS;
    const cols = COLS;

    return (
      <div className="laempl-report-display" style={{ width: '100%', maxWidth: '100%', margin: '20px 0', marginLeft: 0, marginRight: 0, padding: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 20px' }}>
          <h4>LAEMPL Report</h4>
          <button 
            onClick={() => exportBothReportsToExcel(fields)}
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
        <div className="table-container" style={{ width: '100%', overflowX: 'auto', margin: 0, padding: 0 }}>
          <table className="laempl-table" style={{ width: '100%', tableLayout: 'auto', margin: 0 }}>
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
  };

  // Helper function to calculate averages for MPS columns
  const calculateMPSAverages = (rows, cols) => {
    const avgColumns = ['mean', 'median', 'pl', 'mps', 'sd', 'target'];
    const averages = {};
    
    avgColumns.forEach(colKey => {
      const values = rows
        .map(row => {
          const val = row[colKey];
          const num = typeof val === 'number' ? val : parseFloat(val);
          return Number.isFinite(num) ? num : null;
        })
        .filter(v => v !== null);
      
      if (values.length > 0) {
        const sum = values.reduce((acc, val) => acc + val, 0);
        averages[colKey] = (sum / values.length).toFixed(2);
      } else {
        averages[colKey] = '';
      }
    });
    
    return averages;
  };

  const renderMPSReport = (fields) => {
    const rows = fields.rows || [];
    const traits = TRAITS;
    const cols = COLS_MPS;

    // Calculate averages for the average row
    const averages = calculateMPSAverages(rows, cols);

    return (
      <div className="mps-report-display" style={{ width: '100%', maxWidth: '100%', margin: '20px 0', marginLeft: 0, marginRight: 0, padding: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 20px' }}>
          <h4>MPS Report</h4>
        </div>
        <div className="table-container" style={{ width: '100%', overflowX: 'auto', margin: 0, padding: 0 }}>
          <table className="mps-table" style={{ width: '100%', tableLayout: 'auto', margin: 0 }}>
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
                        {rowData[col.key] || ''}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {/* Average row */}
              <tr style={{ fontWeight: 'bold', backgroundColor: '#f3f4f6' }}>
                <td className="trait-cell">Average</td>
                {cols.map(col => {
                  const avgColumns = ['mean', 'median', 'pl', 'mps', 'sd', 'target'];
                  if (avgColumns.includes(col.key)) {
                    return (
                      <td key={col.key} className="data-cell">
                        {averages[col.key]}
                      </td>
                    );
                  }
                  return <td key={col.key} className="data-cell"></td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
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

  if (submissionLoading) {
    return (
      <>
        <Header userText={user ? user.name : "Guest"} />
        <div className="dashboard-container">
          <Sidebar activeLink="View Report" />
          <div className="dashboard-content">
            <Breadcrumb />
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

  if (submissionError || !submissionData) {
    return (
      <>
        <Header userText={user ? user.name : "Guest"} />
        <div className="dashboard-container">
          <Sidebar activeLink="View Report" />
          <div className="dashboard-content">
            <Breadcrumb />
            <div className="dashboard-main">
              <div className="error-container">
                <h2>Error Loading Submission</h2>
                <p className="error-message">{submissionError || "Submission not found"}</p>
                <div className="action-buttons">
                  <button onClick={() => window.history.back()}>Go Back</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Format date helper
  const formatDateOnly = (val) => {
    if (!val) return 'N/A';
    try {
      const d = new Date(val);
      if (Number.isNaN(d.getTime())) return String(val).split('T')[0] || String(val);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${mm}/${dd}/${yyyy}`;
    } catch { 
      return String(val).split('T')[0] || String(val); 
    }
  };

  // Get assignment info from submission data
  const assignmentInfo = submissionData ? {
    assignment_title: submissionData.assignment_title || submissionData.title || submissionData.value,
    from_date: submissionData.from_date,
    to_date: submissionData.to_date,
    category_name: submissionData.category_name,
    sub_category_name: submissionData.sub_category_name
  } : null;

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        <Sidebar activeLink="View Report" />
        <div className="dashboard-content">
          <Breadcrumb />
          <div className="dashboard-main">
            <div className="page-header">
              <button 
                onClick={() => window.history.back()} 
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
            
            {/* Assignment Info */}
            {assignmentInfo && (
              <div className="assignment-info" style={{ 
                marginBottom: '20px',
                backgroundColor: '#fff',
                borderRadius: '8px',
                padding: '16px',
                border: '1px solid #e0e0e0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
                  {submissionData.assignment_title || submissionData.title || submissionData.value || 'Report'}
                </h3>
                <p style={{ color: '#2a3b5c', fontSize: '16px', marginTop: '2px', margin: 0 }}>
                  Submitted by: <span style={{ fontWeight: '700' }}>
                    {submittedByName || submissionData.submitted_by_name || submissionData.submitted_by || 'Unknown'}
                  </span>
                </p>
              </div>
            )}
            
            {/* Two-column layout: main content (left) + details panel (right) */}
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              {/* LEFT: Main content */}
              <div style={{ flex: 1 }}>
                {submissionData.fields && (
                  <div className="submission-content">
                    {/* Export button for Accomplishment Reports */}
                    {(submissionData.fields.type === 'ACCOMPLISHMENT' || submissionData.fields._answers) && (
                      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => exportToWord(submissionData)}
                          style={{
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <span>📄</span>
                          Export to Word
                        </button>
                      </div>
                    )}
                    <div className="content-section">
                      {renderSubmissionContent(submissionData)}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT: Details panel */}
              <div style={{ width: '300px', backgroundColor: '#fff', borderRadius: '8px', padding: '16px', border: '1px solid #ccc' }}>
                <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #ccc' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold' }}>Details</h3>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontWeight: '500' }}>Title:</span>{" "}
                    <span>{submissionData.assignment_title || submissionData.title || submissionData.value || 'Report'}</span>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontWeight: '500' }}>Status:</span>{" "}
                    <span className={`status-badge status-${submissionData.status}`}>
                      {getStatusText(submissionData.status)}
                    </span>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontWeight: '500' }}>Start Date:</span>{" "}
                    <span>{formatDateOnly(submissionData.from_date)}</span>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontWeight: '500' }}>Due Date:</span>{" "}
                    <span>{formatDateOnly(submissionData.to_date)}</span>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontWeight: '500' }}>Report Type:</span>{" "}
                    <span>{submissionData.sub_category_name || submissionData.category_name || 'N/A'}</span>
                  </div>
                </div>
                <div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontWeight: '500' }}>Date Submitted:</span>{" "}
                    <span>{formatDateOnly(submissionData.date_submitted)}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

export default ViewSubmissionData;