import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header";
import Sidebar from "../../components/shared/SidebarTeacher";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator";
import "../../components/shared/StatusBadges.css";
import "./ViewSubmission.css";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } from "docx";
import { saveAs } from "file-saver";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

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
    'total_items': 'Total no. of Items',
    // MPS columns
    'total': 'Total no. of Pupils',
    'mean': 'Mean',
    'median': 'Median',
    'pl': 'PL',
    'mps': 'MPS',
    'sd': 'SD',
    'target': 'Target'
  };
  
  // Handle subject IDs (e.g., subject_8, subject_10)
  if (key.startsWith('subject_')) {
    const subjectId = key.replace('subject_', '');
    const subjectName = subjectNames[subjectId];
    return subjectName || `Subject ${subjectId}`;
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
  const [assignmentDetails, setAssignmentDetails] = useState(null);
  const [COLS_MPS, setCOLS_MPS] = useState([
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
  ]);
  

  // Function to fetch assignment details
  const fetchAssignmentDetails = async (assignmentId) => {
    if (!assignmentId) return null;
    try {
      const response = await fetch(`${API_BASE}/reports/${assignmentId}`, {
        credentials: "include"
      });
      if (response.ok) {
        const assignmentData = await response.json();
        console.log('Assignment details fetched:', assignmentData);
        return assignmentData;
      }
    } catch (error) {
      console.error('Failed to fetch assignment details:', error);
    }
    return null;
  };

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
        
        // Fetch assignment details if report_assignment_id is available
        if (data.report_assignment_id) {
          const assignmentData = await fetchAssignmentDetails(data.report_assignment_id);
          if (assignmentData) {
            setAssignmentDetails(assignmentData);
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
      <div className="laempl-report-display">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4>LAEMPL Report</h4>
          <button 
            onClick={() => exportBothReportsToCSV(fields)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff', // Blue color
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

  const renderMPSReport = (fields) => {
    const mpsRows = fields.mps_rows || [];
    
    return (
      <div className="mps-report-display">
        <h4>MPS Report</h4>
        <div className="table-container">
          <table className="mps-table">
            <thead>
              <tr>
                <th>Trait</th>
                {COLS_MPS.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mpsRows.map((row, index) => (
                <tr key={index}>
                  <td className="trait-cell">{row.trait || ""}</td>
                  {COLS_MPS.map((col) => (
                    <td key={col.key} className="data-cell">
                      {row[col.key] || ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Function to export both LAEMPL and MPS reports to CSV
  const exportBothReportsToCSV = (fields) => {
    const lines = [];
    
    // LAEMPL Report section
    if (fields.rows && fields.rows.length > 0) {
      lines.push("=== LAEMPL REPORT ===");
      
      // Extract traits and columns
      const traits = fields.rows.map(row => row.trait).filter(Boolean);
      const cols = fields.rows.length > 0 ? Object.keys(fields.rows[0])
        .filter(key => key !== 'trait')
        .map(key => {
          const cleanKey = sanitizeKey(key);
          return {
            key: cleanKey,
            originalKey: key,
            label: getColumnLabel(cleanKey, subjectNames)
          };
        }) : [];

      // Add header row
      const headerRow = ['Trait', ...cols.map(col => col.label)];
      lines.push(headerRow.join(','));

      // Add data rows
      traits.forEach(trait => {
        const rowData = fields.rows.find(r => r.trait === trait) || {};
        const row = [trait, ...cols.map(col => rowData[col.originalKey] || '')];
        lines.push(row.join(','));
      });
    }

    // MPS Report section
    if (fields.mps_rows && fields.mps_rows.length > 0) {
      lines.push(""); // Empty line separator
      lines.push("=== MPS REPORT ===");
      
      // Add MPS header row
      const mpsHeaderRow = ['Trait', ...COLS_MPS.map(col => col.label)];
      lines.push(mpsHeaderRow.join(','));

      // Add MPS data rows
      fields.mps_rows.forEach(row => {
        const mpsRow = [row.trait || '', ...COLS_MPS.map(col => row[col.key] || '')];
        lines.push(mpsRow.join(','));
      });
    }

    // Create and download CSV
    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Combined_Reports_${submissionId || 'export'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      return (
        <div>
          {renderLAEMPLReport(fields)}
          {fields.mps_rows && fields.mps_rows.length > 0 && renderMPSReport(fields)}
        </div>
      );
    } else {
      return renderGenericContent(fields);
    }
  };

  if (loading) {
    return (
      <>
        <Header userText={user ? user.name : "Guest"} />
        <div className="dashboard-container">
          <div className="dashboard-content">
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
              <h2>Submission Details</h2>
            </div>
            <div className="submission-details">
              <div className="detail-row">
                <label>Title:</label>
                <span>{(() => {
                  const title = assignmentDetails?.title || 
                               assignmentDetails?.assignment_title || 
                               assignmentDetails?.report_title ||
                               assignmentDetails?.name ||
                               submission.value || 
                               "Report";
                  console.log('Title display debug:', {
                    assignmentDetails: assignmentDetails,
                    assignmentDetails_title: assignmentDetails?.title,
                    submission_value: submission.value,
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
                <span>{submission.date_submitted || "Not submitted"}</span>
              </div>
              <div className="detail-row">
                <label>Submitted By:</label>
                <span>{submission.submitted_by_name || submission.submitted_by || "Unknown"}</span>
              </div>
            </div>

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
        </div>
      </div>
    </>
  );
}

export default ViewSubmission;
