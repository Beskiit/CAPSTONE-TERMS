import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header";
import Breadcrumb from "../../components/Breadcrumb";
import Sidebar from "../../components/shared/SidebarTeacher";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator";
import "../../components/shared/StatusBadges.css";
import "./ViewSubmission.css";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } from "docx";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");
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

/* ---------- helpers ---------- */
const normalizeImages = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.map((img) => {
    const obj = typeof img === "string" ? { url: img } : img || {};
    // make relative paths absolute (optional)
    const isAbsolute = /^https?:\/\//i.test(obj.url || "");
    return {
      ...obj,
      url: isAbsolute ? obj.url : `${API_BASE}/${String(obj.url || "").replace(/^\/+/, "")}`,
    };
  });
};

const parseFields = (raw) => {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
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
    'highest_score': 'Highest Score',
    'lowest_score': 'Lowest Score',
    'male_passed': 'Number of Male Learners who Passed (MPL)',
    'male_mpl_percent': '% MPL (MALE)',
    'female_passed': 'Number of Female who Passed (MPL)',
    'female_mpl_percent': '% MPL (FEMALE)',
    'total_passed': 'Number of Learners who Passed (MPL)',
    'total_mpl_percent': '% MPL (TOTAL)',
    'hs': 'Highest Score',
    'ls': 'Lowest Score',
    'total_items': 'Total no. of Items',
    'gmrc': 'GMRC (15 - 25 points)',
    'math': 'Mathematics (15 - 25 points)',
    'lang': 'Language (15 - 25 points)',
    'read': 'Reading and Literacy (15 - 25 points)',
    'makabasa': 'MAKABASA (15 - 25 points)',
    'english': 'English (15 - 25 points)',
    'araling_panlipunan': 'Araling Panlipunan (15 - 25 points)',
  };
  
  // Handle subject IDs (e.g., subject_8, subject_10)
  if (key.startsWith('subject_')) {
    const subjectId = key.replace('subject_', '');
    const subjectName = subjectNames[subjectId];
    return subjectName ? `${subjectName} (15 - 25 points)` : `Subject ${subjectId} (15 - 25 points)`;
  }
  
  return labelMap[key] || key.toUpperCase();
};

/* ---------- export to word ---------- */
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


function ViewSubmission() {
  const { submissionId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subjectNames, setSubjectNames] = useState({});
  const [assignmentInfo, setAssignmentInfo] = useState(null);
  

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

  const role = (user?.role || "").toLowerCase();
  const isTeacher = role === "teacher";
  const isCoordinator = role === "coordinator";

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
        if (!res.ok) return;
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
        const res = await fetch(`${API_BASE}/submissions/${submissionId}`, { credentials: "include" });
        if (!res.ok) {
          setError("Failed to load submission");
          return;
        }
        const data = await res.json();
        setSubmission(data);
        
        // Fetch assignment info if report_assignment_id exists
        if (data.report_assignment_id) {
          try {
            const assignmentRes = await fetch(`${API_BASE}/reports/assignment/${data.report_assignment_id}`, {
              credentials: "include"
            });
            if (assignmentRes.ok) {
              const assignmentData = await assignmentRes.json();
              setAssignmentInfo(assignmentData);
            }
          } catch (err) {
            console.warn("Failed to fetch assignment info:", err);
          }
        }
        
        // Extract subject IDs and fetch subject names if this is a LAEMPL report
        if (data.fields && data.fields.rows && Array.isArray(data.fields.rows)) {
          const firstRow = data.fields.rows[0];
          if (firstRow) {
            const subjectIds = Object.keys(firstRow)
              .filter(key => key.startsWith('subject_'))
              .map(key => key.replace('subject_', ''));
            
            if (subjectIds.length > 0) {
              console.log('Found subject IDs:', subjectIds);
              fetchSubjectNames(subjectIds);
            }
          }
        }
      } catch (err) {
        setError("Error loading submission");
        console.error("Error fetching submission:", err);
      } finally {
        setLoading(false);
      }
    };

    if (submissionId) fetchSubmission();
  }, [submissionId]);

  const getStatusText = (status) => {
    switch (status) {
      case 0: return "Draft";
      case 1: return "Pending";
      case 2: return "Submitted";
      case 3: return "Approved";
      case 4: return "Rejected";
      default: return "Unknown";
    }
  };

  /* ---------- renderers ---------- */
   const renderAccomplishmentReport = (fields) => {
     const answersRaw = fields?._answers || {};
     const answers = {
       ...answersRaw,
       images: normalizeImages(answersRaw.images),
     };
     
     // Get the title from the submission data
     const submissionTitle = submission?.value || submission?.title || answers.activityName || "";

     return (
       <div className="accomplishment-report-display" id="content-card">
         <div style={{ marginBottom: '20px' }}>
           <h4>Activity Completion Report</h4>
         </div>

        <div className="form-display">
          {/* Simplified format - only Title, Picture/s, and Narrative */}
          <div className="form-row">
            <label>Title:</label>
            <div className="readonly-field">{submissionTitle}</div>
          </div>

          {answers.images?.length > 0 && (
            <div className="form-row">
              <label>Picture/s:</label>
              <div className="image-gallery">
                {answers.images.map((img, i) => (
                  <div key={i} className="image-item">
                    <img src={img.url} alt={`Activity image ${i + 1}`} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-row">
            <label>Narrative:</label>
            <div className="readonly-field narrative-content">
              {answers.narrative || ""}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const exportBothReportsToExcel = (fields) => {
    const workbook = XLSX.utils.book_new();

    if (fields.rows && fields.rows.length > 0) {
      const rows = fields.rows;
      const traits = rows.map(row => row.trait).filter(Boolean);
      let cols = [];
      if (rows.length > 0) {
        const firstRow = rows[0];
        cols = Object.keys(firstRow)
          .filter(key => key !== 'trait')
          .map(key => {
            const cleanKey = sanitizeKey(key);
            return {
              key: cleanKey,
              originalKey: key,
              label: getColumnLabel(cleanKey, subjectNames)
            };
          });
      }

      const laemplHeader = ["Trait", ...cols.map(c => c.label)];
      const laemplRows = traits.map(trait => {
        const rowData = rows.find(r => r.trait === trait) || {};
        return [
          trait,
          ...cols.map(c => rowData[c.originalKey || c.key] || "")
        ];
      });
      const laemplData = [laemplHeader, ...laemplRows];
      const laemplSheet = XLSX.utils.aoa_to_sheet(laemplData);
      applySheetSizing(laemplSheet, laemplData);
      XLSX.utils.book_append_sheet(workbook, laemplSheet, "LAEMPL");
    }

    const mpsRows = fields.mps_rows || fields.mpsRows || [];
    if (mpsRows && mpsRows.length > 0) {
      const mpsTraits = mpsRows.map(row => row.trait).filter(Boolean);
      const mpsHeader = ["Trait", ...DEFAULT_COLS_MPS.map(c => c.label)];
      const mpsSheetRows = mpsTraits.map(trait => {
        const rowData = mpsRows.find(r => r.trait === trait) || {};
        return [
          trait,
          ...DEFAULT_COLS_MPS.map(c => rowData[c.key] || "")
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

    XLSX.writeFile(workbook, `Combined_Reports_${submissionId || 'export'}.xlsx`);
  };

  const renderMPSReport = (fields) => {
    const mpsRows = fields.mps_rows || fields.mpsRows || [];
    const traits = mpsRows.map(row => row.trait).filter(Boolean);

    // Calculate averages for MPS columns
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

    const averages = calculateMPSAverages(mpsRows, DEFAULT_COLS_MPS);

    return (
      <div className="mps-report-display" style={{ marginTop: '2rem' }}>
        <h4>MPS Report</h4>
        <div className="table-container">
          <table className="mps-table">
            <thead>
              <tr>
                <th>Trait</th>
                {DEFAULT_COLS_MPS.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {traits.map(trait => {
                const rowData = mpsRows.find(r => r.trait === trait) || {};
                return (
                  <tr key={trait}>
                    <td className="trait-cell">{trait}</td>
                    {DEFAULT_COLS_MPS.map(col => (
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
                {DEFAULT_COLS_MPS.map(col => {
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

  const renderLAEMPLReport = (fields) => {
    const rows = fields.rows || [];
    
    // Extract dynamic traits and columns from the actual data
    const traits = rows.map(row => row.trait).filter(Boolean);
    const cols = rows.length > 0 ? Object.keys(rows[0])
      .filter(key => key !== 'trait')
      .map(key => {
        const cleanKey = sanitizeKey(key);
        return {
          key: cleanKey,
          originalKey: key,
          label: getColumnLabel(cleanKey, subjectNames)
        };
      }) : [];

    return (
      <div className="laempl-report-display" style={{ width: '100%', maxWidth: '100%', margin: 0, padding: 0 }}>
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
                {cols.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {traits.map((trait) => {
                const rowData = rows.find((r) => r.trait === trait) || {};
                return (
                  <tr key={trait}>
                    <td className="trait-cell">{trait}</td>
                    {cols.map((col) => (
                      <td key={col.key} className="data-cell">
                        {rowData[col.originalKey] || ""}
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

  const renderGenericContent = (fields) => {
    const f = { ...fields, images: normalizeImages(fields.images) };
    return (
      <div className="generic-content" id="content-card">
        {f.narrative && (
          <div className="form-row">
            <label>Narrative:</label>
            <div className="readonly-field narrative-content">{f.narrative}</div>
          </div>
        )}
        {f.images?.length > 0 && (
          <>
            <h4>Images:</h4>
            <div className="image-gallery">
              {f.images.map((img, index) => (
                <div key={index} className="image-item">
                  <img src={img.url} alt={`Submission image ${index + 1}`} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderSubmissionContent = (submission) => {
    const fields = parseFields(submission.fields);

    if (fields.type === "ACCOMPLISHMENT" || fields._answers) {
      return renderAccomplishmentReport(fields);
    } else if (fields.rows && Array.isArray(fields.rows)) {
      // For LAEMPL reports, show both LAEMPL and MPS tables
      return (
        <div>
          {renderLAEMPLReport(fields)}
          {(fields.mps_rows || fields.mpsRows) && Array.isArray(fields.mps_rows || fields.mpsRows) && (fields.mps_rows || fields.mpsRows).length > 0 && (
            renderMPSReport(fields)
          )}
        </div>
      );
    } else {
      return renderGenericContent(fields);
    }
  };

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

  if (loading) {
    return (
      <>
        <Header userText={user ? user.name : "Guest"} />
        <div className="dashboard-container">
          <div className="dashboard-content">
            <Breadcrumb />
            <div className="dashboard-main">
              <h2>Loading Submission...</h2>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error || !submission) {
    return (
      <>
        <Header userText={user ? user.name : "Guest"} />
        <div className="dashboard-container">
          <div className="dashboard-content">
            <Breadcrumb />
            <div className="dashboard-main">
              <h2>Error</h2>
              <p>{error || "Submission not found"}</p>
              <button onClick={() => navigate(-1)}>Go Back</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        {isTeacher ? (
          <Sidebar activeLink="Submitted Report" />
        ) : (
          <SidebarCoordinator activeLink="Submitted Report" />
        )}
        <div className="dashboard-content">
          <Breadcrumb />
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
                  <h3>{submission.title || submission.value || assignmentInfo.assignment_title || "Report"}</h3>
                  <p style={{ color: '#2a3b5c', fontSize: '16px', marginTop: '2px' }}>
                    Submitted by: <span style={{ fontWeight: '700' }}>{submission.submitted_by_name || submission.submitted_by || 'Unknown'}</span>
                  </p>
                </div>
              </div>
            )}
            
            {/* Two-column layout: main content (left) + details panel (right) */}
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              {/* LEFT: Main content */}
              <div style={{ flex: 1 }}>
                {submission.fields && (
                  <div className="submission-content">
                    <div className="content-section">{renderSubmissionContent(submission)}</div>
                  </div>
                )}

                {isTeacher && submission.status < 2 && (
                  <div className="action-buttons">
                    <button onClick={() => navigate(`/AccomplishmentReport/${submissionId}`)}>
                      Edit Submission
                    </button>
                  </div>
                )}
              </div>

              {/* RIGHT: Details panel */}
              <div style={{ width: '300px', backgroundColor: '#fff', borderRadius: '8px', padding: '16px', border: '1px solid #ccc' }}>
                <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #ccc' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold' }}>Details</h3>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontWeight: '500' }}>Title:</span>{" "}
                    <span>{assignmentInfo?.assignment_title || submission.title || submission.value || 'Report'}</span>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontWeight: '500' }}>Status:</span>{" "}
                    <span className={`status-badge status-${submission.status}`}>
                      {getStatusText(submission.status)}
                    </span>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontWeight: '500' }}>Start Date:</span>{" "}
                    <span>{formatDateOnly(assignmentInfo?.from_date || submission.from_date)}</span>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontWeight: '500' }}>Due Date:</span>{" "}
                    <span>{formatDateOnly(assignmentInfo?.to_date || submission.to_date)}</span>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontWeight: '500' }}>Report Type:</span>{" "}
                    <span>{assignmentInfo?.sub_category_name || assignmentInfo?.category_name || submission.sub_category_name || submission.category_name || 'N/A'}</span>
                  </div>
                </div>
                <div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontWeight: '500' }}>Date Submitted:</span>{" "}
                    <span>{formatDateOnly(submission.date_submitted)}</span>
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

export default ViewSubmission;
