import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header.jsx";
import Breadcrumb from "../../components/Breadcrumb.jsx";
import SidebarPrincipal from "../../components/shared/SidebarPrincipal.jsx";
import "../Teacher/LAEMPLReport.css";
import "../Teacher/ViewSubmission.css";
import { useAuth } from "../../context/AuthContext.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com";

// Default traits and columns
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

function ViewCoordinatorSubmissions() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gradeLevelSections, setGradeLevelSections] = useState({}); // Cache sections by grade level
  
  const coordinatorName = location.state?.coordinatorName || 'Coordinator';
  const coordinatorId = location.state?.coordinatorId;
  const expectedGradeLevel = location.state?.gradeLevel;
  const initialSubmissions = location.state?.submissions || [];

  useEffect(() => {
    if (initialSubmissions.length > 0) {
      try {
        setLoading(true);
        // Parse fields if they're JSON strings, otherwise use as-is
        // Also filter by grade level if a specific grade level is expected
        const parsedSubmissions = initialSubmissions
          .filter(sub => {
            // If a specific grade level is expected, only include submissions that match
            if (expectedGradeLevel != null) {
              return sub.grade_level === expectedGradeLevel || 
                     sub.grade_level === String(expectedGradeLevel) ||
                     sub.grade_level === Number(expectedGradeLevel);
            }
            return true; // If no grade level filter, include all
          })
          .map(sub => {
            const parsed = { ...sub };
            // Parse fields if it's a string
            if (typeof parsed.fields === 'string') {
              try {
                parsed.fields = JSON.parse(parsed.fields);
              } catch (e) {
                console.warn(`Failed to parse fields for submission ${sub.submission_id}:`, e);
                parsed.fields = {};
              }
            }
            // Ensure fields is an object
            if (!parsed.fields || typeof parsed.fields !== 'object') {
              parsed.fields = {};
            }
            console.log(`Submission ${sub.submission_id} - Grade: ${sub.grade_level}, fields:`, parsed.fields);
            return parsed;
          });
        
        console.log(`Filtered submissions: ${parsedSubmissions.length} submissions for grade level ${expectedGradeLevel}`);
        setSubmissions(parsedSubmissions);
      } catch (err) {
        console.error("Failed to process submissions:", err);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [initialSubmissions, expectedGradeLevel]);

  // Helper to extract dynamic columns from fields
  const extractColumns = (rows) => {
    if (!rows || rows.length === 0) return DEFAULT_COLS;
    
    const firstRow = rows[0];
    const cols = Object.keys(firstRow)
      .filter(key => key !== 'trait')
      .map(key => {
        // Normalize key for matching (lowercase, remove special chars)
        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Try to match with default columns by comparing normalized keys
        const defaultCol = DEFAULT_COLS.find(c => {
          const defaultNormalized = c.key.toLowerCase().replace(/[^a-z0-9]/g, '');
          return defaultNormalized === normalizedKey || c.key === normalizedKey;
        });
        
        if (defaultCol) {
          // Return default column but keep originalKey for data access
          return {
            ...defaultCol,
            originalKey: key
          };
        }
        
        // Otherwise create a new column
        return {
          key: normalizedKey,
          originalKey: key,
          label: key
        };
      });
    
    return cols.length > 0 ? cols : DEFAULT_COLS;
  };

  // Fetch sections for a specific grade level from the database
  const fetchSectionsForGrade = useCallback(async (gradeLevel) => {
    if (!gradeLevel) return null;
    
    // Check cache first
    if (gradeLevelSections[gradeLevel]) {
      console.log(`Using cached sections for Grade ${gradeLevel}:`, gradeLevelSections[gradeLevel]);
      return gradeLevelSections[gradeLevel];
    }
    
    try {
      console.log(`Fetching sections for Grade ${gradeLevel} from database...`);
      const sectionsRes = await fetch(`${API_BASE}/sections/grade/${gradeLevel}`, {
        credentials: "include"
      });
      
      if (sectionsRes.ok) {
        const sectionsData = await sectionsRes.json();
        console.log(`Fetched sections for Grade ${gradeLevel}:`, sectionsData);
        
        if (sectionsData && sectionsData.length > 0) {
          // Extract section names
          const sectionNames = sectionsData.map(s => s.section_name || s.section).filter(Boolean);
          
          // Cache the sections
          setGradeLevelSections(prev => ({
            ...prev,
            [gradeLevel]: sectionNames
          }));
          
          console.log(`Using sections for Grade ${gradeLevel}:`, sectionNames);
          return sectionNames;
        } else {
          console.warn(`No sections found for Grade ${gradeLevel} in database`);
          return null;
        }
      } else {
        console.warn(`Failed to fetch sections for Grade ${gradeLevel}, status:`, sectionsRes.status);
        return null;
      }
    } catch (err) {
      console.error(`Error fetching sections for Grade ${gradeLevel}:`, err);
      return null;
    }
  }, [gradeLevelSections]);

  // Helper to extract traits from fields
  // Traits are section names (e.g., "Masipag", "Matulungin") from the actual submission data
  // If submission data is missing, fetch sections for the grade level from database
  const extractTraits = async (rows, gradeLevel) => {
    if (!rows || rows.length === 0) {
      console.warn('No rows found in submission data');
      
      // If we have a grade level, try to fetch sections from database
      if (gradeLevel) {
        const sections = await fetchSectionsForGrade(gradeLevel);
        if (sections && sections.length > 0) {
          console.log('Using sections from database for Grade', gradeLevel, ':', sections);
          return sections;
        }
      }
      
      console.warn('Falling back to default traits');
      return DEFAULT_TRAITS;
    }
    
    const traits = rows.map(row => row.trait).filter(Boolean);
    if (traits.length === 0) {
      console.warn('No traits found in rows');
      
      // If we have a grade level, try to fetch sections from database
      if (gradeLevel) {
        const sections = await fetchSectionsForGrade(gradeLevel);
        if (sections && sections.length > 0) {
          console.log('Using sections from database for Grade', gradeLevel, ':', sections);
          return sections;
        }
      }
      
      console.warn('Falling back to default traits. Rows:', rows);
      return DEFAULT_TRAITS;
    }
    
    console.log('Extracted traits from submission data:', traits);
    return traits;
  };

  // Component to render LAEMPL report with async trait fetching
  const LAEMPLReportDisplay = ({ fields, gradeLevel, submission }) => {
    const rows = fields?.rows || [];
    const [traits, setTraits] = useState(DEFAULT_TRAITS);
    const [loadingTraits, setLoadingTraits] = useState(true);
    const [cols, setCols] = useState([]);

    useEffect(() => {
      const loadData = async () => {
        setLoadingTraits(true);
        try {
          // Extract columns from submission data - only show columns that exist in the data
          let extractedCols = [];
          
          if (rows && rows.length > 0) {
            // Extract columns from actual data
            extractedCols = extractColumns(rows);
            console.log('Using columns from submission data:', extractedCols);
          } else {
            // No rows - try to extract subject from assignment title or fields
            const assignmentTitle = submission?.assignment_title || submission?.title || '';
            const subjectName = fields?.subject_name || 
                               (assignmentTitle.includes(' - ') ? assignmentTitle.split(' - ').pop().trim() : null);
            const subjectId = fields?.subject_id;
            
            if (subjectName || subjectId) {
              // Create columns for the assigned subject only
              extractedCols = [
                { key: "m", label: "M" },
                { key: "f", label: "F" }
              ];
              
              if (subjectId) {
                extractedCols.push({
                  key: `subject_${subjectId}`,
                  originalKey: `subject_${subjectId}`,
                  label: `${subjectName || 'Subject'} (15 - 25 points)`
                });
              } else if (subjectName) {
                // Try to match subject name to a column key
                const normalizedSubject = subjectName.toLowerCase().replace(/[^a-z0-9]/g, '');
                const defaultCol = DEFAULT_COLS.find(c => {
                  const defaultNormalized = c.key.toLowerCase().replace(/[^a-z0-9]/g, '');
                  return defaultNormalized === normalizedSubject || 
                         subjectName.toLowerCase().includes(c.key.toLowerCase()) ||
                         c.key.toLowerCase().includes(normalizedSubject);
                });
                
                if (defaultCol) {
                  extractedCols.push({
                    ...defaultCol,
                    originalKey: defaultCol.key,
                    label: `${subjectName} (15 - 25 points)`
                  });
                } else {
                  extractedCols.push({
                    key: normalizedSubject,
                    originalKey: subjectName,
                    label: `${subjectName} (15 - 25 points)`
                  });
                }
              }
              
              extractedCols.push(
                { key: "total_score", label: "Total Score" },
                { key: "hs", label: "HS" },
                { key: "ls", label: "LS" },
                { key: "total_items", label: "Total no. of Items" }
              );
              
              console.log('Using columns from assigned subject:', extractedCols);
            } else {
              // No subject info available - show empty or minimal columns
              extractedCols = [
                { key: "m", label: "M" },
                { key: "f", label: "F" }
              ];
              console.log('No subject information found, showing minimal columns');
            }
          }
          
          setCols(extractedCols);
          
          // Extract traits from submission data or fetch from database
          let extractedTraits = DEFAULT_TRAITS;
          
          if (rows && rows.length > 0) {
            const traitsFromRows = rows.map(row => row.trait).filter(Boolean);
            if (traitsFromRows.length > 0) {
              extractedTraits = traitsFromRows;
              console.log('Using traits from submission data:', extractedTraits);
            }
          }
          
          // If no traits from submission and we have grade level, fetch from database
          if ((!rows || rows.length === 0 || extractedTraits === DEFAULT_TRAITS) && gradeLevel) {
            const sections = await fetchSectionsForGrade(gradeLevel);
            if (sections && sections.length > 0) {
              extractedTraits = sections;
              console.log('Using sections from database for Grade', gradeLevel, ':', extractedTraits);
            }
          }
          
          setTraits(extractedTraits);
        } catch (err) {
          console.error('Error loading data:', err);
          setTraits(DEFAULT_TRAITS);
          setCols(DEFAULT_COLS);
        } finally {
          setLoadingTraits(false);
        }
      };
      
      loadData();
    }, [rows, gradeLevel, fetchSectionsForGrade, submission, fields]);

    console.log('renderLAEMPLReport - Grade Level:', gradeLevel);
    console.log('renderLAEMPLReport - rows from submission:', rows);
    console.log('renderLAEMPLReport - extracted traits (sections):', traits);
    console.log('renderLAEMPLReport - extracted cols:', cols);
    
    // Check if we're using default traits (which means submission data might be missing)
    const isUsingDefaultTraits = rows.length === 0 || 
                                  traits.length === 0 || 
                                  JSON.stringify(traits) === JSON.stringify(DEFAULT_TRAITS);

    return (
      <div className="laempl-report-display">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h4>LAEMPL Report {gradeLevel && <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666' }}>(Grade {gradeLevel})</span>}</h4>
            {isUsingDefaultTraits && rows.length === 0 && (
              <p style={{ fontSize: '12px', color: '#ff6b6b', marginTop: '4px', fontStyle: 'italic' }}>
                ⚠️ Note: Submission data is missing. Displaying sections from database for this grade level.
              </p>
            )}
          </div>
        </div>
        <div className="table-container">
          <table className="laempl-table">
            {gradeLevel && (
              <caption style={{ captionSide: 'top', textAlign: 'left', padding: '8px 0', fontWeight: 'bold', fontSize: '14px' }}>
                Grade Level: {gradeLevel}
              </caption>
            )}
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
                // Find row data - try exact match first, then case-insensitive
                const rowData = rows.find(r => {
                  if (!r.trait) return false;
                  return r.trait === trait || 
                         r.trait.toLowerCase().trim() === trait.toLowerCase().trim();
                }) || {};
                
                console.log(`Trait "${trait}" - rowData:`, rowData);
                
                return (
                  <tr key={trait}>
                    <td className="trait-cell">{trait}</td>
                    {cols.map(col => {
                      // Use originalKey if available, otherwise use key
                      const dataKey = col.originalKey || col.key;
                      // Try multiple key variations
                      const value = rowData[dataKey] || 
                                   rowData[col.key] || 
                                   rowData[col.originalKey] || 
                                   rowData[dataKey.toLowerCase()] ||
                                   rowData[col.key.toLowerCase()] ||
                                   '';
                      return (
                        <td key={col.key} className="data-cell">
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderLAEMPLReport = (fields, gradeLevel = null, submission = null) => {
    return <LAEMPLReportDisplay fields={fields} gradeLevel={gradeLevel} submission={submission} />;
  };

  // Component to render MPS report with async trait fetching
  const MPSReportDisplay = ({ fields, gradeLevel, submission }) => {
    const rows = fields?.mps_rows || [];
    const [traits, setTraits] = useState(DEFAULT_TRAITS);
    const [loadingTraits, setLoadingTraits] = useState(true);
    const cols = DEFAULT_COLS_MPS;

    useEffect(() => {
      const loadTraits = async () => {
        setLoadingTraits(true);
        try {
          // Extract traits from MPS data or fetch from database
          let extractedTraits = DEFAULT_TRAITS;
          
          if (rows && rows.length > 0) {
            const traitsFromRows = rows.map(row => row.trait).filter(Boolean);
            if (traitsFromRows.length > 0) {
              extractedTraits = traitsFromRows;
              console.log('MPS: Using traits from submission data:', extractedTraits);
            }
          }
          
          // If no traits from submission and we have grade level, fetch from database
          if ((!rows || rows.length === 0 || extractedTraits === DEFAULT_TRAITS) && gradeLevel) {
            const sections = await fetchSectionsForGrade(gradeLevel);
            if (sections && sections.length > 0) {
              extractedTraits = sections;
              console.log('MPS: Using sections from database for Grade', gradeLevel, ':', extractedTraits);
            }
          }
          
          setTraits(extractedTraits);
        } catch (err) {
          console.error('Error extracting MPS traits:', err);
          setTraits(DEFAULT_TRAITS);
        } finally {
          setLoadingTraits(false);
        }
      };
      
      loadTraits();
    }, [rows, gradeLevel, fetchSectionsForGrade]);

    // Show MPS report even if data is missing (similar to LAEMPL)
    const isUsingDefaultTraits = rows.length === 0 || 
                                  traits.length === 0 || 
                                  JSON.stringify(traits) === JSON.stringify(DEFAULT_TRAITS);

    return (
      <div className="mps-report-display" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h4>MPS Report {gradeLevel && <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666' }}>(Grade {gradeLevel})</span>}</h4>
            {isUsingDefaultTraits && rows.length === 0 && (
              <p style={{ fontSize: '12px', color: '#ff6b6b', marginTop: '4px', fontStyle: 'italic' }}>
                ⚠️ Note: Submission data is missing. Displaying sections from database for this grade level.
              </p>
            )}
          </div>
        </div>
        <div className="table-container">
          <table className="mps-table">
            {gradeLevel && (
              <caption style={{ captionSide: 'top', textAlign: 'left', padding: '8px 0', fontWeight: 'bold', fontSize: '14px' }}>
                Grade Level: {gradeLevel}
              </caption>
            )}
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
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderMPSReport = (fields, gradeLevel = null, submission = null) => {
    return <MPSReportDisplay fields={fields} gradeLevel={gradeLevel} submission={submission} />;
  };

  const renderSubmissionContent = (submission) => {
    const fields = submission.fields || {};
    const gradeLevel = submission.grade_level || null;
    
    // Always render both LAEMPL and MPS reports, even if data is missing
    return (
      <div>
        {renderLAEMPLReport(fields, gradeLevel, submission)}
        {renderMPSReport(fields, gradeLevel, submission)}
      </div>
    );
  };

  if (loading) {
    return (
      <>
        <Header userText={user ? user.name : "Guest"} />
        <div className="dashboard-container">
          <SidebarPrincipal activeLink="LAEMPL & MPS" />
          <div className="dashboard-content">
            <Breadcrumb />
            <div className="dashboard-main">
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <h2>Loading Submissions...</h2>
              </div>
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
        <SidebarPrincipal activeLink="LAEMPL & MPS" />
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
              <h2>
                {coordinatorName} - LAEMPL & MPS Submissions
                {expectedGradeLevel && <span style={{ fontSize: '18px', fontWeight: 'normal', color: '#666', marginLeft: '10px' }}>(Grade {expectedGradeLevel})</span>}
              </h2>
            </div>
            
            {submissions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p>No submissions found for this coordinator.</p>
              </div>
            ) : (
              <div className="submissions-list">
                {submissions.map((submission, index) => {
                  const fields = submission.fields || {};
                  const title = submission.assignment_title || submission.value || submission.title || `Submission ${index + 1}`;
                  const gradeLevel = submission.grade_level || 'N/A';
                  
                  return (
                    <div key={submission.submission_id || index} className="submission-item" style={{
                      marginBottom: '2rem',
                      padding: '1.5rem',
                      backgroundColor: '#fff',
                      borderRadius: '8px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{ marginBottom: '1rem' }}>
                        <h3 style={{ marginBottom: '0.5rem', color: '#333' }}>{title}</h3>
                        <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
                          <strong>Grade Level:</strong> {gradeLevel}
                        </p>
                      </div>
                      <div className="submission-content">
                        <div className="content-section">
                          {renderSubmissionContent(submission)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default ViewCoordinatorSubmissions;

