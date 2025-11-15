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
  const [gradeSubjectCache, setGradeSubjectCache] = useState({});
  const [availableSubjects, setAvailableSubjects] = useState([]);
  
  const coordinatorName = location.state?.coordinatorName || 'Coordinator';
  const coordinatorId = location.state?.coordinatorId;
  const expectedGradeLevel = location.state?.gradeLevel;
  const initialSubmissions = location.state?.submissions || [];
  const gradeGroups = Array.isArray(location.state?.gradeGroups) ? location.state.gradeGroups : null;
  const isAllGradesView = Array.isArray(gradeGroups) && gradeGroups.length > 0;
  const [sortMode, setSortMode] = useState("grade"); // 'grade' or 'subject'

  const parseSubmissionFields = useCallback((submission) => {
    if (!submission) return null;
    const parsed = { ...submission };
    if (typeof parsed.fields === "string") {
      try {
        parsed.fields = JSON.parse(parsed.fields);
      } catch (err) {
        console.warn(`Failed to parse fields for submission ${submission.submission_id}:`, err);
        parsed.fields = {};
      }
    }
    if (!parsed.fields || typeof parsed.fields !== "object") {
      parsed.fields = {};
    }
    return parsed;
  }, []);

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
          .map(parseSubmissionFields)
          .filter(Boolean);
        
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

  const processedGradeGroups = React.useMemo(() => {
    if (!isAllGradesView || !Array.isArray(gradeGroups)) return [];
    return gradeGroups
      .map((gradeGroup) => {
        const processedCoordinators = (gradeGroup.coordinators || [])
          .map((coordinator) => ({
            ...coordinator,
            submissions: (coordinator.submissions || [])
              .map(parseSubmissionFields)
              .filter(Boolean),
          }))
          .filter((coordinator) => (coordinator.submissions || []).length > 0);

        return {
          ...gradeGroup,
          coordinators: processedCoordinators,
        };
      })
      .filter((group) => group.coordinators.length > 0);
  }, [isAllGradesView, gradeGroups, parseSubmissionFields]);

  const gradeLevelsFromState = React.useMemo(() => {
    // In "all grades view", always show all grade levels 1-6 for every subject
    if (isAllGradesView) {
      return ["1", "2", "3", "4", "5", "6"];
    }
    
    // For single coordinator view, use grade levels from state
    if (!Array.isArray(gradeGroups)) return [];
    const levels = gradeGroups
      .map((group) => {
        const level = group?.grade_level;
        if (level === null || level === undefined) return "N/A";
        const normalized = String(level).trim();
        return normalized || "N/A";
      })
      .filter(Boolean);
    return Array.from(new Set(levels));
  }, [gradeGroups, isAllGradesView]);

  // Normalize subject names - treat "Math" and "Mathematics" as the same
  const normalizeSubjectName = useCallback((subjectName) => {
    if (!subjectName) return "";
    const normalized = subjectName.toLowerCase().trim();
    // Treat "math" and "mathematics" as the same
    if (normalized === "math" || normalized === "mathematics") {
      return "mathematics"; // Use the full name as canonical
    }
    return normalized;
  }, []);

  const extractSubject = useCallback((submission = {}) => {
    const title = submission.assignment_title || submission.value || submission.title || "";
    if (title.includes(" - ")) {
      return title.split(" - ").pop().trim();
    }
    const subjectName = submission.fields?.subject_name || submission.fields?.subject || submission.fields?.subjectTitle;
    return subjectName || "Unknown Subject";
  }, []);

  const shouldOverrideValue = (key = "") => {
    const normalized = key.toLowerCase().trim();
    return ["hs", "ls", "total_no._of_items", "total_no_of_items", "total_items", "target"].includes(normalized);
  };

  const aggregateSubjectRows = useCallback((gradeLabel, submissionsList, rowKey) => {
    const row = { trait: `Grade ${gradeLabel}` };
    submissionsList.forEach((submission) => {
      const rows = rowKey === "mps_rows" ? submission.fields?.mps_rows || [] : submission.fields?.rows || [];
      rows.forEach((dataRow) => {
        Object.entries(dataRow || {}).forEach(([key, value]) => {
          if (key === "trait") return;
          const numericValue = typeof value === "number" ? value : parseFloat(value);
          if (!Number.isFinite(numericValue)) return;
          if (shouldOverrideValue(key)) {
            const current = Number(row[key]) || 0;
            row[key] = Math.max(current, numericValue);
          } else {
            const current = Number(row[key]) || 0;
            row[key] = current + numericValue;
          }
        });
      });
    });
    return row;
  }, []);

  const hasRowData = (row) => {
    if (!row) return false;
    return Object.entries(row).some(([key, val]) => {
      if (key === "trait") return false;
      const numericValue = typeof val === "number" ? val : parseFloat(val);
      return Number.isFinite(numericValue) && numericValue !== 0;
    });
  };

  const getValueForColumn = (row, col) => {
    if (!row || !col) return "";
    const dataKey = col.originalKey || col.key;
    const fallbackKeys = [
      dataKey,
      col.key,
      dataKey?.toLowerCase(),
      col.key?.toLowerCase(),
    ].filter(Boolean);
    for (const key of fallbackKeys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
        return row[key];
      }
    }
    return "";
  };

  // Build a map of subject name -> array of grade levels where it exists
  const subjectToGradeLevelsMap = React.useMemo(() => {
    const map = new Map();
    
    // Iterate through gradeSubjectCache to build the mapping
    Object.entries(gradeSubjectCache).forEach(([gradeLevel, subjects]) => {
      if (!Array.isArray(subjects)) return;
      
      subjects.forEach((subject) => {
        const subjectName = subject?.subject_name?.trim();
        if (!subjectName) return;
        
        // Normalize subject name (Math -> Mathematics)
        const normalizedName = normalizeSubjectName(subjectName);
        if (!map.has(normalizedName)) {
          map.set(normalizedName, new Set());
        }
        map.get(normalizedName).add(String(gradeLevel));
      });
    });
    
    // Convert Sets to sorted arrays
    const result = new Map();
    map.forEach((gradeSet, subjectName) => {
      result.set(subjectName, Array.from(gradeSet).sort((a, b) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (Number.isFinite(numA) && Number.isFinite(numB)) {
          return numA - numB;
        }
        return a.localeCompare(b);
      }));
    });
    
    return result;
  }, [gradeSubjectCache, normalizeSubjectName]);

  const subjectOrganizedData = React.useMemo(() => {
    if (!isAllGradesView) return [];
    const subjectMap = new Map();

    processedGradeGroups.forEach((gradeGroup) => {
      const gradeLevel = gradeGroup.grade_level || "N/A";
      (gradeGroup.coordinators || []).forEach((coordinator) => {
        (coordinator.submissions || []).forEach((submission) => {
          const subjectName = extractSubject(submission);
          if (!subjectMap.has(subjectName)) {
            subjectMap.set(subjectName, new Map());
          }
          const gradeMap = subjectMap.get(subjectName);
          if (!gradeMap.has(gradeLevel)) {
            gradeMap.set(gradeLevel, []);
          }
          gradeMap.get(gradeLevel).push(submission);
        });
      });
    });

    // Helper to get valid grade levels for a subject (only where it exists in database)
    const getValidGradeLevelsForSubject = (subjectName) => {
      const normalizedName = normalizeSubjectName(subjectName);
      const validGrades = subjectToGradeLevelsMap.get(normalizedName) || [];
      
      // If we have submissions for this subject (check both original and normalized), also include those grade levels
      const normalizedKey = normalizeSubjectName(subjectName);
      let submissionGrades = [];
      
      // Check both the original name and normalized name in subjectMap
      if (subjectMap.has(subjectName)) {
        submissionGrades = Array.from(subjectMap.get(subjectName).keys());
      } else {
        // Try to find by normalized name
        for (const [key, value] of subjectMap.entries()) {
          if (normalizeSubjectName(key) === normalizedKey) {
            submissionGrades = Array.from(value.keys());
            break;
          }
        }
      }
      
      // Combine and deduplicate
      const allGrades = new Set([...validGrades, ...submissionGrades]);
      return Array.from(allGrades).sort((a, b) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (Number.isFinite(numA) && Number.isFinite(numB)) {
          return numA - numB;
        }
        return a.localeCompare(b);
      });
    };

    // Group subjects by normalized name to combine "Math" and "Mathematics"
    const normalizedSubjectMap = new Map();
    subjectMap.forEach((gradeMap, subjectName) => {
      const normalizedKey = normalizeSubjectName(subjectName);
      if (!normalizedSubjectMap.has(normalizedKey)) {
        normalizedSubjectMap.set(normalizedKey, { originalName: subjectName, gradeMap: new Map() });
      }
      const entry = normalizedSubjectMap.get(normalizedKey);
      // Use the longer/more complete name as the display name
      if (subjectName.length > entry.originalName.length || 
          (subjectName.toLowerCase() === "mathematics" && entry.originalName.toLowerCase() === "math")) {
        entry.originalName = subjectName;
      }
      // Merge grade maps
      gradeMap.forEach((submissions, gradeLevel) => {
        if (!entry.gradeMap.has(gradeLevel)) {
          entry.gradeMap.set(gradeLevel, []);
        }
        entry.gradeMap.get(gradeLevel).push(...submissions);
      });
    });

    const subjectsArray = Array.from(normalizedSubjectMap.entries()).map(([normalizedKey, entry]) => {
      const subjectName = entry.originalName;
      const gradeMap = entry.gradeMap;
      const laemplRows = [];
      const mpsRows = [];
      
      // Get valid grade levels for this subject (only where it exists in database)
      const validGradeLevels = getValidGradeLevelsForSubject(subjectName);
      
      // Process submissions for grade levels that have data AND exist in database
      gradeMap.forEach((submissionsList, gradeLevel) => {
        // Only include if this grade level has this subject in the database
        if (validGradeLevels.includes(String(gradeLevel))) {
          laemplRows.push(aggregateSubjectRows(gradeLevel, submissionsList, "rows"));
          mpsRows.push(aggregateSubjectRows(gradeLevel, submissionsList, "mps_rows"));
        }
      });
      
      // Add empty rows for valid grade levels that don't have submissions yet
      validGradeLevels.forEach(gradeLevel => {
        const gradeTrait = `Grade ${gradeLevel}`;
        const hasRow = laemplRows.some(row => row.trait === gradeTrait);
        if (!hasRow) {
          laemplRows.push({ trait: gradeTrait });
          mpsRows.push({ trait: gradeTrait });
        }
      });
      
      // Sort rows by grade level
      const sortRows = (rows) => {
        return rows.sort((a, b) => {
          const numA = parseInt(a.trait?.replace('Grade ', '') || '0', 10);
          const numB = parseInt(b.trait?.replace('Grade ', '') || '0', 10);
          if (Number.isFinite(numA) && Number.isFinite(numB)) {
            return numA - numB;
          }
          return (a.trait || '').localeCompare(b.trait || '');
        });
      };
      
      return {
        subject_name: subjectName,
        laemplRows: sortRows(laemplRows),
        mpsRows: sortRows(mpsRows),
      };
    });

    const existingSubjects = new Set(
      subjectsArray.map((subject) => normalizeSubjectName(subject.subject_name)).filter(Boolean)
    );

    // Add subjects from database that don't have submissions yet
    availableSubjects.forEach((subject) => {
      const name = subject.subject_name || "Unknown Subject";
      const normalizedKey = normalizeSubjectName(name);
      if (existingSubjects.has(normalizedKey)) return;

      // Get valid grade levels for this subject
      const validGradeLevels = getValidGradeLevelsForSubject(name);
      
      subjectsArray.push({
        subject_name: name,
        laemplRows: validGradeLevels.map((gradeLevel) => ({ trait: `Grade ${gradeLevel}` })),
        mpsRows: validGradeLevels.map((gradeLevel) => ({ trait: `Grade ${gradeLevel}` })),
      });
    });

    return subjectsArray.sort((a, b) =>
      (a.subject_name || "").localeCompare(b.subject_name || "")
    );
  }, [
    isAllGradesView,
    processedGradeGroups,
    aggregateSubjectRows,
    extractSubject,
    availableSubjects,
    subjectToGradeLevelsMap,
    normalizeSubjectName,
  ]);

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

  const fetchSubjectsForGrade = useCallback(
    async (gradeLevel) => {
      if (!gradeLevel) return [];

      if (gradeSubjectCache[gradeLevel]) {
        return gradeSubjectCache[gradeLevel];
      }

      try {
        const response = await fetch(`${API_BASE}/admin/subjects/${gradeLevel}`, {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          const normalizedData = Array.isArray(data) ? data : [];
          setGradeSubjectCache((prev) => ({
            ...prev,
            [gradeLevel]: normalizedData,
          }));
          return normalizedData;
        }

        console.warn(`Failed to fetch subjects for Grade ${gradeLevel}:`, response.status);
      } catch (err) {
        console.error(`Error fetching subjects for Grade ${gradeLevel}:`, err);
      }

      setGradeSubjectCache((prev) => ({
        ...prev,
        [gradeLevel]: [],
      }));
      return [];
    },
    [gradeSubjectCache]
  );

  useEffect(() => {
    if (!isAllGradesView) {
      setAvailableSubjects([]);
      return;
    }

    let isMounted = true;

    const loadSubjects = async () => {
      try {
        // In "all grades view", always load subjects for all grade levels 1-6
        const allGradeLevels = [1, 2, 3, 4, 5, 6];
        
        // Also include any grade levels from state that might not be 1-6
        const stateGrades = gradeLevelsFromState
          .map((level) => {
            const parsed = parseInt(level, 10);
            return Number.isFinite(parsed) ? parsed : null;
          })
          .filter((grade) => grade !== null && !allGradeLevels.includes(grade));
        
        const numericGrades = [...allGradeLevels, ...stateGrades];

        if (numericGrades.length === 0) {
          if (isMounted) setAvailableSubjects([]);
          return;
        }

        const subjectsPerGrade = await Promise.all(
          numericGrades.map((grade) => fetchSubjectsForGrade(grade))
        );

        if (!isMounted) return;

        const flattened = subjectsPerGrade.flat().filter(Boolean);
        const deduped = [];
        const seen = new Set();

        flattened.forEach((subject) => {
          const name = subject?.subject_name?.trim();
          if (!name) return;
          // Use normalized name for deduplication (Math and Mathematics are the same)
          const normalizedKey = normalizeSubjectName(name);
          // Prefer "Mathematics" over "Math" if both exist
          const existing = deduped.find(s => normalizeSubjectName(s.subject_name) === normalizedKey);
          if (existing) {
            // If we found an existing subject with the same normalized name, prefer the longer/more complete name
            if (name.toLowerCase() === "mathematics" && existing.subject_name.toLowerCase() === "math") {
              existing.subject_name = name;
            }
          } else {
            seen.add(normalizedKey);
            deduped.push({
              subject_id: subject.subject_id,
              subject_name: name,
            });
          }
        });

        setAvailableSubjects(deduped);
      } catch (err) {
        if (isMounted) {
          console.error("Failed to load subjects list:", err);
          setAvailableSubjects([]);
        }
      }
    };

    loadSubjects();

    return () => {
      isMounted = false;
    };
  }, [isAllGradesView, gradeLevelsFromState, fetchSubjectsForGrade, normalizeSubjectName]);

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

    // Calculate averages for the average row
    const averages = calculateMPSAverages(rows, cols);

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

  // CSV Export Helper Functions
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const downloadCSV = (csvContent, filename) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportGradeSortedToCSV = () => {
    if (processedGradeGroups.length === 0) {
      alert('No data to export');
      return;
    }

    const csvRows = [];
    
    processedGradeGroups.forEach((gradeGroup) => {
      const gradeLevel = gradeGroup.grade_level || 'N/A';
      const coordinators = gradeGroup.coordinators || [];
      
      // Add grade level header
      csvRows.push(`Grade ${gradeLevel}`);
      csvRows.push('');
      
      coordinators.forEach((coordinator) => {
        const coordinatorName = coordinator.coordinator_name || `Coordinator ${coordinator.coordinator_id}`;
        const coordinatorSubmissions = coordinator.submissions || [];
        
        coordinatorSubmissions.forEach((submission) => {
          const subjectName = extractSubject(submission);
          const fields = submission.fields || {};
          const laemplRows = fields.rows || [];
          const mpsRows = fields.mps_rows || [];
          
          // Add coordinator and subject info
          csvRows.push(`Coordinator: ${coordinatorName}`);
          csvRows.push(`Subject: ${subjectName}`);
          csvRows.push('');
          
          // Helper to get LAEMPL columns (same logic as LAEMPLReportDisplay)
          const getLAEMPLColumns = () => {
            if (laemplRows && laemplRows.length > 0) {
              const extractedCols = extractColumns(laemplRows);
              return extractedCols;
            } else {
              // No rows - try to extract subject from assignment title or fields
              const assignmentTitle = submission?.assignment_title || submission?.title || '';
              const subjectNameFromFields = fields?.subject_name || 
                                           (assignmentTitle.includes(' - ') ? assignmentTitle.split(' - ').pop().trim() : null);
              const subjectId = fields?.subject_id;
              
              const cols = [
                { key: "m", label: "M" },
                { key: "f", label: "F" }
              ];
              
              if (subjectId) {
                cols.push({
                  key: `subject_${subjectId}`,
                  originalKey: `subject_${subjectId}`,
                  label: `${subjectNameFromFields || 'Subject'} (15 - 25 points)`
                });
              } else if (subjectNameFromFields) {
                const normalizedSubject = subjectNameFromFields.toLowerCase().replace(/[^a-z0-9]/g, '');
                const defaultCol = DEFAULT_COLS.find(c => {
                  const defaultNormalized = c.key.toLowerCase().replace(/[^a-z0-9]/g, '');
                  return defaultNormalized === normalizedSubject || 
                         subjectNameFromFields.toLowerCase().includes(c.key.toLowerCase()) ||
                         c.key.toLowerCase().includes(normalizedSubject);
                });
                
                if (defaultCol) {
                  cols.push({
                    ...defaultCol,
                    originalKey: defaultCol.key,
                    label: `${subjectNameFromFields} (15 - 25 points)`
                  });
                } else {
                  cols.push({
                    key: normalizedSubject,
                    originalKey: subjectNameFromFields,
                    label: `${subjectNameFromFields} (15 - 25 points)`
                  });
                }
              }
              
              cols.push(
                { key: "total_score", label: "Total Score" },
                { key: "hs", label: "HS" },
                { key: "ls", label: "LS" },
                { key: "total_items", label: "Total no. of Items" }
              );
              
              return cols;
            }
          };
          
          // Get traits for LAEMPL (use sections from database if no data)
          const getLAEMPLTraits = () => {
            if (laemplRows && laemplRows.length > 0) {
              const traitsFromRows = laemplRows.map(row => row.trait).filter(Boolean);
              if (traitsFromRows.length > 0) {
                return traitsFromRows;
              }
            }
            // If no traits, we'll use DEFAULT_TRAITS (in real display, it fetches from DB)
            return DEFAULT_TRAITS;
          };
          
          // Export LAEMPL Report
          csvRows.push('LAEMPL Report (Grade ' + gradeLevel + ')');
          const laemplCols = getLAEMPLColumns();
          const laemplTraits = getLAEMPLTraits();
          const laemplHeader = ['Trait', ...laemplCols.map(col => col.label)].map(escapeCSV).join(',');
          csvRows.push(laemplHeader);
          
          laemplTraits.forEach((trait) => {
            const rowData = laemplRows.find(r => {
              if (!r.trait) return false;
              return r.trait === trait || 
                     r.trait.toLowerCase().trim() === trait.toLowerCase().trim();
            }) || {};
            
            const csvRow = [
              trait,
              ...laemplCols.map(col => {
                const dataKey = col.originalKey || col.key;
                const value = rowData[dataKey] || 
                             rowData[col.key] || 
                             rowData[col.originalKey] || 
                             rowData[dataKey.toLowerCase()] ||
                             rowData[col.key.toLowerCase()] ||
                             '';
                return value;
              })
            ];
            csvRows.push(csvRow.map(escapeCSV).join(','));
          });
          
          csvRows.push(''); // Empty row separator
          
          // Export MPS Report
          csvRows.push('MPS Report (Grade ' + gradeLevel + ')');
          const mpsTraits = (mpsRows && mpsRows.length > 0) 
            ? mpsRows.map(row => row.trait).filter(Boolean)
            : DEFAULT_TRAITS;
          const mpsHeader = ['Trait', ...DEFAULT_COLS_MPS.map(col => col.label)].map(escapeCSV).join(',');
          csvRows.push(mpsHeader);
          
          mpsTraits.forEach((trait) => {
            const rowData = mpsRows.find(r => r.trait === trait) || {};
            const csvRow = [
              trait,
              ...DEFAULT_COLS_MPS.map(col => {
                const value = rowData[col.key] || '';
                return value;
              })
            ];
            csvRows.push(csvRow.map(escapeCSV).join(','));
          });
          
          csvRows.push(''); // Empty row separator between submissions
          csvRows.push(''); // Extra separator
        });
      });
      
      csvRows.push(''); // Extra separator between grade levels
    });
    
    const csvContent = csvRows.join('\n');
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csvContent, `LAEMPL_MPS_Reports_By_Grade_${timestamp}.csv`);
  };

  const exportSubjectSortedToCSV = () => {
    const subjects = subjectOrganizedData;
    
    if (subjects.length === 0) {
      alert('No data to export');
      return;
    }

    const csvRows = [];
    
    subjects.forEach((subject) => {
      const subjectName = subject.subject_name || 'Unknown Subject';
      
      // Helper to get columns for this subject (same logic as render)
      const getSubjectColumn = () => {
        const normalizedSubject = normalizeSubjectName(subjectName);
        const subjectKey = `subject_${normalizedSubject.replace(/[^a-z0-9]/g, '')}`;
        const defaultCol = DEFAULT_COLS.find(c => {
          const defaultNormalized = normalizeSubjectName(c.key).replace(/[^a-z0-9]/g, '');
          const subjectNormalized = normalizedSubject.replace(/[^a-z0-9]/g, '');
          return defaultNormalized === subjectNormalized || 
                 normalizedSubject.includes(normalizeSubjectName(c.key)) ||
                 normalizeSubjectName(c.key).includes(normalizedSubject);
        });
        return {
          key: subjectKey,
          originalKey: defaultCol ? defaultCol.key : subjectName,
          label: `${subjectName} (15 - 25 points)`
        };
      };
      
      const laemplHasData = subject.laemplRows.some(hasRowData);
      let laemplCols = [];
      
      if (subject.laemplRows && subject.laemplRows.length > 0 && laemplHasData) {
        laemplCols = extractColumns(subject.laemplRows);
        const mCol = laemplCols.find(col => col.key === 'm');
        const fCol = laemplCols.find(col => col.key === 'f');
        const subjectCol = getSubjectColumn();
        const normalizedSubject = normalizeSubjectName(subjectName);
        const normalizedKey = normalizedSubject.replace(/[^a-z0-9]/g, '');
        const subjectKeyPrefix = `subject_${normalizedKey}`;
        
        const hasSubjectCol = laemplCols.some(col => {
          const colKey = (col.key || '').toLowerCase();
          if (colKey === 'm' || colKey === 'f') return false;
          const colNormalized = normalizeSubjectName(col.originalKey || col.key || '').replace(/[^a-z0-9]/g, '');
          const colLabel = normalizeSubjectName(col.label || '');
          return colKey.startsWith(subjectKeyPrefix) ||
                 (colNormalized.length > 2 && colNormalized === normalizedKey) ||
                 (colLabel.length > 2 && (colLabel === normalizedSubject || 
                                         colLabel.includes(normalizedSubject) ||
                                         normalizedSubject.includes(colLabel)));
        });
        
        const existingSubjectCol = hasSubjectCol ? laemplCols.find(col => {
          const colKey = (col.key || '').toLowerCase();
          if (colKey === 'm' || colKey === 'f') return false;
          const colNormalized = normalizeSubjectName(col.originalKey || col.key || '').replace(/[^a-z0-9]/g, '');
          const colLabel = normalizeSubjectName(col.label || '');
          return colKey.startsWith(subjectKeyPrefix) ||
                 (colNormalized.length > 2 && colNormalized === normalizedKey) ||
                 (colLabel.length > 2 && (colLabel === normalizedSubject || 
                                          colLabel.includes(normalizedSubject) ||
                                          normalizedSubject.includes(colLabel)));
        }) : null;
        
        const otherCols = laemplCols.filter(col => {
          const colKey = (col.key || '').toLowerCase();
          if (colKey === 'm' || colKey === 'f') return false;
          const colNormalized = normalizeSubjectName(col.originalKey || col.key || '').replace(/[^a-z0-9]/g, '');
          const colLabel = normalizeSubjectName(col.label || '');
          if (colKey.startsWith(subjectKeyPrefix) ||
              (colNormalized.length > 2 && colNormalized === normalizedKey) ||
              (colLabel.length > 2 && (colLabel === normalizedSubject || 
                                      colLabel.includes(normalizedSubject) ||
                                      normalizedSubject.includes(colLabel)))) {
            return false;
          }
          return true;
        });
        
        laemplCols = [];
        if (mCol) laemplCols.push(mCol);
        if (fCol) laemplCols.push(fCol);
        if (existingSubjectCol) {
          laemplCols.push({
            ...existingSubjectCol,
            label: `${subjectName} (15 - 25 points)`
          });
        } else {
          laemplCols.push(subjectCol);
        }
        laemplCols.push(...otherCols);
      } else {
        laemplCols = [
          { key: "m", label: "M" },
          { key: "f", label: "F" },
          getSubjectColumn(),
          { key: "total_score", label: "Total Score" },
          { key: "hs", label: "HS" },
          { key: "ls", label: "LS" },
          { key: "total_items", label: "Total no. of Items" }
        ];
      }
      
      // LAEMPL Report
      csvRows.push(`Subject: ${subjectName}`);
      csvRows.push('LAEMPL Report');
      const laemplHeader = ['Grade Level', ...laemplCols.map(col => col.label)].map(escapeCSV).join(',');
      csvRows.push(laemplHeader);
      
      subject.laemplRows.forEach((row) => {
        const csvRow = [
          row.trait || '',
          ...laemplCols.map(col => {
            const value = getValueForColumn(row, col);
            return value || '';
          })
        ];
        csvRows.push(csvRow.map(escapeCSV).join(','));
      });
      
      csvRows.push(''); // Empty row separator
      
      // MPS Report
      csvRows.push('MPS Report');
      const mpsHeader = ['Grade Level', ...DEFAULT_COLS_MPS.map(col => col.label)].map(escapeCSV).join(',');
      csvRows.push(mpsHeader);
      
      subject.mpsRows.forEach((row) => {
        const csvRow = [
          row.trait || '',
          ...DEFAULT_COLS_MPS.map(col => {
            const value = getValueForColumn(row, col);
            return value || '';
          })
        ];
        csvRows.push(csvRow.map(escapeCSV).join(','));
      });
      
      csvRows.push(''); // Empty row separator between subjects
      csvRows.push(''); // Extra separator
    });
    
    const csvContent = csvRows.join('\n');
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csvContent, `LAEMPL_MPS_Reports_By_Subject_${timestamp}.csv`);
  };

  const renderSubmissionCard = (submission, index, coordinatorLabel = null) => {
    const fields = submission.fields || {};
    const title = submission.assignment_title || submission.value || submission.title || `Submission ${index + 1}`;
    const gradeLevel = submission.grade_level || 'N/A';

    return (
      <div
        key={submission.submission_id || `${title}-${index}`}
        className="submission-item"
        style={{
          marginBottom: '1.5rem',
          padding: '1.5rem',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginLeft: coordinatorLabel ? '1rem' : '0'
        }}
      >
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginBottom: '0.5rem', color: '#333' }}>
            {title}
            {coordinatorLabel && (
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 'normal', color: '#6b7280' }}>
                Coordinator: {coordinatorLabel}
              </span>
            )}
          </h3>
          <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
            <strong>Grade Level:</strong> {gradeLevel}
          </p>
        </div>
        <div className="submission-content">
          <div className="content-section">
            {renderSubmissionContent({ ...submission, fields })}
          </div>
        </div>
      </div>
    );
  };

  const renderGradeSortedView = () => {
    if (processedGradeGroups.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>No coordinator submissions found for any grade level.</p>
        </div>
      );
    }

    return processedGradeGroups.map((gradeGroup, gradeIdx) => {
      const gradeLevel = gradeGroup.grade_level || 'N/A';
      const coordinators = gradeGroup.coordinators || [];

      return (
        <div key={`grade-${gradeLevel}-${gradeIdx}`} style={{ marginBottom: '3rem' }}>
          <h3
            style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#1e293b',
              marginBottom: '1.5rem',
              paddingBottom: '0.5rem',
              borderBottom: '2px solid #e2e8f0',
            }}
          >
            Grade {gradeLevel}
          </h3>

          {coordinators.map((coordinator, coordIdx) => {
            const coordinatorSubmissions = coordinator.submissions || [];
            if (coordinatorSubmissions.length === 0) return null;
            const coordinatorLabel = coordinator.coordinator_name || `Coordinator ${coordinator.coordinator_id}`;

            return (
              <div key={`coord-${coordinator.coordinator_id}-${coordIdx}`} style={{ marginBottom: '2rem' }}>
                <h4
                  style={{
                    fontSize: '16px',
                    fontWeight: '500',
                    color: '#475569',
                    marginBottom: '1rem',
                    paddingLeft: '0.5rem',
                  }}
                >
                  {coordinatorLabel}
                </h4>

                {coordinatorSubmissions.map((submission, subIdx) =>
                  renderSubmissionCard(submission, subIdx, coordinatorLabel)
                )}
              </div>
            );
          })}
        </div>
      );
    });
  };

  const renderSubjectSortedView = () => {
    const subjects = subjectOrganizedData;

    if (subjects.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>No subject data available yet.</p>
        </div>
      );
    }

    return subjects.map((subject, subjectIdx) => {
      const subjectName = subject.subject_name || "Unknown Subject";
      const laemplHasData = subject.laemplRows.some(hasRowData);
      const mpsHasData = subject.mpsRows.some(hasRowData);

      // Extract columns dynamically from the subject's data
      // Always ensure the subject-specific column is included
      let laemplCols = [];
      
      // Helper to find or create subject column
      const getSubjectColumn = () => {
        // Always create a subject-specific column with a unique key
        // Use the subject name as the key (normalized) to avoid conflicts
        const normalizedSubject = normalizeSubjectName(subjectName);
        const subjectKey = `subject_${normalizedSubject.replace(/[^a-z0-9]/g, '')}`;
        
        // Try to find matching default column for the originalKey (for data lookup)
        const defaultCol = DEFAULT_COLS.find(c => {
          const defaultNormalized = normalizeSubjectName(c.key).replace(/[^a-z0-9]/g, '');
          const subjectNormalized = normalizedSubject.replace(/[^a-z0-9]/g, '');
          return defaultNormalized === subjectNormalized || 
                 normalizedSubject.includes(normalizeSubjectName(c.key)) ||
                 normalizeSubjectName(c.key).includes(normalizedSubject);
        });
        
        return {
          key: subjectKey, // Unique key for React
          originalKey: defaultCol ? defaultCol.key : subjectName, // Use for data lookup
          label: `${subjectName} (15 - 25 points)`
        };
      };
      
      // Check if there's actual data in the rows
      const hasActualData = laemplHasData;
      
      if (subject.laemplRows && subject.laemplRows.length > 0 && hasActualData) {
        // Extract columns from actual data (only if there's real data)
        laemplCols = extractColumns(subject.laemplRows);
        
        // Always ensure M and F are first, then subject column, then other columns
        const mCol = laemplCols.find(col => col.key === 'm');
        const fCol = laemplCols.find(col => col.key === 'f');
        const subjectCol = getSubjectColumn();
        
        // Check if subject column already exists in extracted columns
        // Be more strict - don't match single letters like "M" or "F"
        const normalizedSubject = normalizeSubjectName(subjectName);
        const normalizedKey = normalizedSubject.replace(/[^a-z0-9]/g, '');
        const subjectKeyPrefix = `subject_${normalizedKey}`;
        
        const hasSubjectCol = laemplCols.some(col => {
          // Don't match single letter columns
          const colKey = (col.key || '').toLowerCase();
          if (colKey === 'm' || colKey === 'f') return false;
          
          const colNormalized = normalizeSubjectName(col.originalKey || col.key || '').replace(/[^a-z0-9]/g, '');
          const colLabel = normalizeSubjectName(col.label || '');
          
          // Match if key starts with subject_ prefix, or if normalized keys match exactly
          return colKey.startsWith(subjectKeyPrefix) ||
                 (colNormalized.length > 2 && colNormalized === normalizedKey) ||
                 (colLabel.length > 2 && (colLabel === normalizedSubject || 
                                         colLabel.includes(normalizedSubject) ||
                                         normalizedSubject.includes(colLabel)));
        });
        
        // Find the existing subject column if it exists
        const existingSubjectCol = hasSubjectCol ? laemplCols.find(col => {
          const colKey = (col.key || '').toLowerCase();
          if (colKey === 'm' || colKey === 'f') return false;
          
          const colNormalized = normalizeSubjectName(col.originalKey || col.key || '').replace(/[^a-z0-9]/g, '');
          const colLabel = normalizeSubjectName(col.label || '');
          
          return colKey.startsWith(subjectKeyPrefix) ||
                 (colNormalized.length > 2 && colNormalized === normalizedKey) ||
                 (colLabel.length > 2 && (colLabel === normalizedSubject || 
                                          colLabel.includes(normalizedSubject) ||
                                          normalizedSubject.includes(colLabel)));
        }) : null;
        
        // Remove M, F, and subject column from extracted cols to reorder them
        const otherCols = laemplCols.filter(col => {
          const colKey = (col.key || '').toLowerCase();
          if (colKey === 'm' || colKey === 'f') return false;
          
          const colNormalized = normalizeSubjectName(col.originalKey || col.key || '').replace(/[^a-z0-9]/g, '');
          const colLabel = normalizeSubjectName(col.label || '');
          
          // Exclude if this is the subject column (use strict matching)
          if (colKey.startsWith(subjectKeyPrefix) ||
              (colNormalized.length > 2 && colNormalized === normalizedKey) ||
              (colLabel.length > 2 && (colLabel === normalizedSubject || 
                                      colLabel.includes(normalizedSubject) ||
                                      normalizedSubject.includes(colLabel)))) {
            return false;
          }
          return true;
        });
        
        // Build final column array: M, F, Subject (always include), then other columns
        laemplCols = [];
        if (mCol) laemplCols.push(mCol);
        if (fCol) laemplCols.push(fCol);
        // Always include subject column - use existing one if found (with updated label), otherwise create new
        if (existingSubjectCol) {
          // Update the label to ensure it shows the subject name
          laemplCols.push({
            ...existingSubjectCol,
            label: `${subjectName} (15 - 25 points)`
          });
        } else {
          laemplCols.push(subjectCol);
        }
        laemplCols.push(...otherCols);
        
        // Debug: log columns to verify subject column is included
        console.log(`Subject: ${subjectName}, Columns:`, laemplCols.map(c => ({ key: c.key, label: c.label })));
      } else {
        // No data - create columns for this specific subject
        laemplCols = [
          { key: "m", label: "M" },
          { key: "f", label: "F" },
          getSubjectColumn(),
          { key: "total_score", label: "Total Score" },
          { key: "hs", label: "HS" },
          { key: "ls", label: "LS" },
          { key: "total_items", label: "Total no. of Items" }
        ];
      }

      return (
        <div key={`subject-${subjectName}-${subjectIdx}`} style={{ marginBottom: '3rem' }}>
          <h3
            style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#1e293b',
              marginBottom: '1.5rem',
              paddingBottom: '0.5rem',
              borderBottom: '2px solid #e2e8f0',
            }}
          >
            {subjectName}
          </h3>

          <div
            className="submission-item"
            style={{
              padding: '1.5rem',
              backgroundColor: '#fff',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              marginBottom: '2rem',
            }}
          >
            <div className="laempl-report-display">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h4>LAEMPL Report</h4>
                </div>
              </div>
              <div className="table-container">
                <table className="laempl-table">
                  <thead>
                    <tr>
                      <th>Grade Level</th>
                      {laemplCols.map((col) => (
                        <th key={`${subjectName}-la-${col.key}`}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subject.laemplRows.map((row) => (
                      <tr key={`la-${subjectName}-${row.trait}`}>
                        <td className="trait-cell">{row.trait}</td>
                        {laemplCols.map((col) => (
                          <td key={`${subjectName}-la-${row.trait}-${col.key}`} className="data-cell">
                            {getValueForColumn(row, col)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!laemplHasData && (
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px', fontStyle: 'italic' }}>
                  No LAEMPL data yet for this subject.
                </p>
              )}
            </div>

            <div className="mps-report-display" style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h4>MPS Report</h4>
                </div>
              </div>
              <div className="table-container">
                <table className="mps-table">
                  <thead>
                    <tr>
                      <th>Grade Level</th>
                      {DEFAULT_COLS_MPS.map((col) => (
                        <th key={`${subjectName}-mps-${col.key}`}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subject.mpsRows.map((row) => (
                      <tr key={`mps-${subjectName}-${row.trait}`}>
                        <td className="trait-cell">{row.trait}</td>
                        {DEFAULT_COLS_MPS.map((col) => (
                          <td key={`${subjectName}-mps-${row.trait}-${col.key}`} className="data-cell">
                            {getValueForColumn(row, col)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {/* Average row */}
                    {(() => {
                      const averages = calculateMPSAverages(subject.mpsRows, DEFAULT_COLS_MPS);
                      return (
                        <tr style={{ fontWeight: 'bold', backgroundColor: '#f3f4f6' }}>
                          <td className="trait-cell">Average</td>
                          {DEFAULT_COLS_MPS.map((col) => {
                            const avgColumns = ['mean', 'median', 'pl', 'mps', 'sd', 'target'];
                            if (avgColumns.includes(col.key)) {
                              return (
                                <td key={`${subjectName}-mps-avg-${col.key}`} className="data-cell">
                                  {averages[col.key]}
                                </td>
                              );
                            }
                            return <td key={`${subjectName}-mps-avg-${col.key}`} className="data-cell"></td>;
                          })}
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
              {!mpsHasData && (
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px', fontStyle: 'italic' }}>
                  No MPS data yet for this subject.
                </p>
              )}
            </div>
          </div>
        </div>
      );
    });
  };

  const renderSingleCoordinatorContent = () => {
    if (submissions.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>No submissions found for this coordinator.</p>
        </div>
      );
    }

    return (
      <div className="submissions-list">
        {submissions.map((submission, index) => renderSubmissionCard(submission, index))}
      </div>
    );
  };

  const renderAllGradesContent = () => {
    if (processedGradeGroups.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>No coordinator submissions found for any grade level.</p>
        </div>
      );
    }

    return (
      <>
        <div
          style={{
            display: 'flex',
            gap: '12px',
            margin: '16px 0 24px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => setSortMode('grade')}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: '2px solid',
              borderColor: sortMode === 'grade' ? '#2563eb' : '#cbd5e1',
              backgroundColor: sortMode === 'grade' ? '#2563eb' : '#fff',
              color: sortMode === 'grade' ? '#fff' : '#1f2937',
              fontWeight: 600,
              cursor: 'pointer',
              minWidth: '170px',
            }}
          >
            Sort per Grade Level
          </button>
          <button
            type="button"
            onClick={() => setSortMode('subject')}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: '2px solid',
              borderColor: sortMode === 'subject' ? '#2563eb' : '#cbd5e1',
              backgroundColor: sortMode === 'subject' ? '#2563eb' : '#fff',
              color: sortMode === 'subject' ? '#fff' : '#1f2937',
              fontWeight: 600,
              cursor: 'pointer',
              minWidth: '170px',
            }}
          >
            Sort by Subject
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={sortMode === 'grade' ? exportGradeSortedToCSV : exportSubjectSortedToCSV}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                border: '2px solid #10b981',
                backgroundColor: '#10b981',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              title={`Export ${sortMode === 'grade' ? 'Grade Sorted' : 'Subject Sorted'} View to CSV`}
            >
              <span>📥</span>
              <span>Export to CSV</span>
            </button>
          </div>
        </div>

        <div className="submissions-list">
          {sortMode === 'subject' ? renderSubjectSortedView() : renderGradeSortedView()}
        </div>
      </>
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
                {isAllGradesView ? "LAEMPL & MPS Submissions (All Grades)" : `${coordinatorName} - LAEMPL & MPS Submissions`}
                {!isAllGradesView && expectedGradeLevel && (
                  <span style={{ fontSize: '18px', fontWeight: 'normal', color: '#666', marginLeft: '10px' }}>
                    (Grade {expectedGradeLevel})
                  </span>
                )}
              </h2>
            </div>
            
            {isAllGradesView ? renderAllGradesContent() : renderSingleCoordinatorContent()}
          </div>
        </div>
      </div>
    </>
  );
}

export default ViewCoordinatorSubmissions;

