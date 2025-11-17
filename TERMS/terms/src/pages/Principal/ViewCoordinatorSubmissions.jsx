import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header.jsx";
import Breadcrumb from "../../components/Breadcrumb.jsx";
import SidebarPrincipal from "../../components/shared/SidebarPrincipal.jsx";
import "../Teacher/LAEMPLReport.css";
import "../Teacher/ViewSubmission.css";
import { useAuth } from "../../context/AuthContext.jsx";
import * as XLSX from "xlsx";

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

const COLUMN_SYNONYMS = {
  hs: ["hs", "highest_score"],
  ls: ["ls", "lowest_score"],
};

const NORMALIZED_DUPLICATE_KEYS = new Set(["highestscore", "lowestscore"]);

const normalizeKey = (key = "") =>
  key.toString().toLowerCase().replace(/[^a-z0-9]/g, "");

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
  const [selectedGradeFilter, setSelectedGradeFilter] = useState("all"); // 'all' or specific grade level
  const [subjectFilter, setSubjectFilter] = useState("all");

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
    const normalizedKey = (col.key || "").toLowerCase();
    const synonymKeys = COLUMN_SYNONYMS[normalizedKey];
    if (synonymKeys) {
      for (const key of synonymKeys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
          return row[key];
        }
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

  const FIXED_COL_WIDTH = 25;
  const applySheetSizing = (worksheet, sheetData) => {
    const maxCols = sheetData.reduce((max, row) => Math.max(max, row.length), 0);
    worksheet["!cols"] = Array.from({ length: maxCols }, () => ({
      wch: FIXED_COL_WIDTH,
    }));
    worksheet["!rows"] = sheetData.map((row) => {
      const longest = row.reduce((max, cell) => {
        if (cell == null) return max;
        return Math.max(max, cell.toString().length);
      }, 0);
      const lines = Math.max(1, Math.ceil(longest / FIXED_COL_WIDTH));
      return { hpt: Math.min(18 * lines, 120) };
    });
  };

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

  const subjectOptions = React.useMemo(() => {
    const names = subjectOrganizedData
      .map((subject) => subject.subject_name || "Unknown Subject")
      .filter(Boolean);
    const uniqueNormalized = [];
    const seen = new Set();
    names.forEach((name) => {
      const normalized = normalizeSubjectName(name);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        uniqueNormalized.push(name);
      }
    });
    return uniqueNormalized.sort((a, b) => a.localeCompare(b));
  }, [subjectOrganizedData, normalizeSubjectName]);

  const filteredSubjects = React.useMemo(() => {
    if (subjectFilter === "all") return subjectOrganizedData;
    const normalizedSelected = normalizeSubjectName(subjectFilter);
    return subjectOrganizedData.filter(
      (subject) =>
        normalizeSubjectName(subject.subject_name) === normalizedSelected
    );
  }, [subjectOrganizedData, subjectFilter, normalizeSubjectName]);

  const filteredGradeGroups = React.useMemo(() => {
    if (selectedGradeFilter === "all") return processedGradeGroups;
    return processedGradeGroups.filter(
      (gradeGroup) =>
        String(gradeGroup.grade_level) === String(selectedGradeFilter)
    );
  }, [processedGradeGroups, selectedGradeFilter]);


  // Helper to get column label with subject name
  const getColumnLabel = useCallback((key, originalKey) => {
    // Check originalKey first for subject_ prefix (before normalization)
    const keyToCheck = originalKey || key;
    
    // Handle subject IDs (e.g., subject_34)
    if (keyToCheck && keyToCheck.startsWith('subject_')) {
      const subjectId = keyToCheck.replace('subject_', '');
      return `Subject ${subjectId} (15 - 25 points)`;
    }
    
    // Handle standard columns
    const labelMap = {
      'm': 'No. of Male',
      'f': 'No. of Female',
      'no_of_cases': 'No. of Cases',
      'no_of_items': 'No. of Items',
      'total_score': 'Total Score',
      'hs': 'Highest Score',
      'ls': 'Lowest Score',
      'total_items': 'Total no. of Items',
      'male_passed': 'Number of Male Learners who Passed (MPL)',
      'male_mpl_percent': '% MPL (MALE)',
      'female_passed': 'Number of Female who passed(MPL)',
      'female_mpl_percent': '% MPL(FEMALE)',
      'total_passed': 'Number of Learners who Passed(MPL)',
      'total_mpl_percent': '% MPL(TOTAL)',
      'gmrc': 'GMRC (15 - 25 points)',
      'math': 'Mathematics (15 - 25 points)',
      'lang': 'Language (15 - 25 points)',
      'read': 'Reading and Literacy (15 - 25 points)',
      'makabasa': 'MAKABASA (15 - 25 points)',
    };
    
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const [mapKey, label] of Object.entries(labelMap)) {
      if (normalizedKey === mapKey.toLowerCase().replace(/[^a-z0-9]/g, '')) {
        return label;
      }
    }
    
    return originalKey || key;
  }, []);

  // Helper to extract dynamic columns from fields
  const extractColumns = useCallback((rows, submission = null, fields = null) => {
    // Always include required standard columns in the correct order
    const requiredColumns = [
      { key: "m", label: "No. of Male", originalKey: "m" },
      { key: "f", label: "No. of Female", originalKey: "f" },
      { key: "no_of_cases", label: "No. of Cases", originalKey: "no_of_cases" },
      { key: "no_of_items", label: "No. of Items", originalKey: "no_of_items" },
      { key: "total_score", label: "Total Score", originalKey: "total_score" },
      { key: "hs", label: "Highest Score", originalKey: "highest_score" },
      { key: "ls", label: "Lowest Score", originalKey: "lowest_score" },
      { key: "male_passed", label: "Number of Male Learners who Passed (MPL)", originalKey: "male_passed" },
      { key: "male_mpl_percent", label: "% MPL (MALE)", originalKey: "male_mpl_percent" },
      { key: "female_passed", label: "Number of Female who passed(MPL)", originalKey: "female_passed" },
      { key: "female_mpl_percent", label: "% MPL(FEMALE)", originalKey: "female_mpl_percent" },
      { key: "total_passed", label: "Number of Learners who Passed(MPL)", originalKey: "total_passed" },
      { key: "total_mpl_percent", label: "% MPL(TOTAL)", originalKey: "total_mpl_percent" },
    ];
    
    if (!rows || rows.length === 0) {
      // If no rows, return required columns only (no subject column)
      return requiredColumns;
    }
    
    const firstRow = rows[0];
    const dataKeys = Object.keys(firstRow).filter((key) => {
      if (key === "trait") return false;
      if (key.startsWith("subject_")) return false;
      const normalized = normalizeKey(key);
      return !NORMALIZED_DUPLICATE_KEYS.has(normalized);
    });
    
    const dataCols = dataKeys.map((key) => {
      const normalizedKey = normalizeKey(key);
      return {
        key,
        label: getColumnLabel(key, key),
        originalKey: key,
        normalizedKey,
      };
    });
    
    const cols = [];
    const processedNormalizedKeys = new Set();
    
    requiredColumns.forEach((reqCol) => {
      const normalizedReqKey = normalizeKey(reqCol.key);
      const matchingDataCol = dataCols.find(
        (col) => col.normalizedKey === normalizedReqKey
      );
      
      if (matchingDataCol) {
        cols.push({
          ...reqCol,
          originalKey: matchingDataCol.originalKey,
        });
      } else {
        cols.push(reqCol);
      }
      processedNormalizedKeys.add(normalizedReqKey);
    });
    
    dataCols.forEach((col) => {
      if (processedNormalizedKeys.has(col.normalizedKey)) return;
      cols.push({
        key: col.originalKey,
        label: col.label,
        originalKey: col.originalKey,
      });
      processedNormalizedKeys.add(col.normalizedKey);
    });
    
    return cols;
  }, [getColumnLabel]);

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
  const LAEMPLReportDisplay = React.memo(({ fields, gradeLevel, submission }) => {
    const rows = fields?.rows || [];
    const [traits, setTraits] = useState(DEFAULT_TRAITS);
    const [loadingTraits, setLoadingTraits] = useState(true);
    
    // Create stable string representations for comparison
    const rowsStr = React.useMemo(() => JSON.stringify(rows), [rows]);
    const submissionStr = React.useMemo(() => JSON.stringify(submission), [submission]);
    const fieldsStr = React.useMemo(() => JSON.stringify(fields), [fields]);
    
    // Cache for columns to prevent object recreation
    const colsCacheRef = React.useRef({ key: null, cols: null });
    
    // Memoize columns to prevent unnecessary re-renders
    const cols = React.useMemo(() => {
      const cacheKey = `${rowsStr}|${submissionStr}|${fieldsStr}`;
      
      // Return cached columns if key matches
      if (colsCacheRef.current.key === cacheKey && colsCacheRef.current.cols) {
        return colsCacheRef.current.cols;
      }
      
      // Otherwise compute and cache
      const computed = extractColumns(rows, submission, fields);
      colsCacheRef.current = { key: cacheKey, cols: computed };
      return computed;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rowsStr, submissionStr, fieldsStr]);
    
    // Memoize row data map for efficient lookups
    const rowDataMap = React.useMemo(() => {
      const map = new Map();
      rows.forEach(row => {
        if (row.trait) {
          const traitKey = row.trait.toLowerCase().trim();
          map.set(traitKey, row);
          map.set(row.trait, row); // Also store exact match
        }
      });
      return map;
    }, [rowsStr]);
    
    // Memoize rendered rows to prevent re-rendering
    // Use stringified versions for stable comparison
    const colsStr = React.useMemo(() => {
      return JSON.stringify(cols.map(c => ({ 
        key: c.key, 
        originalKey: c.originalKey, 
        label: c.label 
      })));
    }, [cols]);
    
    const traitsStr = React.useMemo(() => JSON.stringify(traits), [traits]);
    
    // Cache rendered rows to prevent recreation
    const renderedRowsCacheRef = React.useRef({ key: null, rows: null });
    
    const renderedRows = React.useMemo(() => {
      const cacheKey = `${traitsStr}|${rowsStr}|${colsStr}`;
      
      // Return cached rows if key matches
      if (renderedRowsCacheRef.current.key === cacheKey && renderedRowsCacheRef.current.rows) {
        return renderedRowsCacheRef.current.rows;
      }
      
      // Otherwise compute and cache
      const computed = traits.map(trait => {
        const rowData = rowDataMap.get(trait) || rowDataMap.get(trait.toLowerCase().trim()) || {};
        
        return {
          trait,
          cells: cols.map(col => {
            const dataKey = col.originalKey || col.key;
            const value = rowData[dataKey] || 
                         rowData[col.key] || 
                         rowData[col.originalKey] || 
                         rowData[dataKey?.toLowerCase()] ||
                         rowData[col.key?.toLowerCase()] ||
                         '';
            return { colKey: col.key, value };
          })
        };
      });
      
      renderedRowsCacheRef.current = { key: cacheKey, rows: computed };
      return computed;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [traitsStr, rowsStr, colsStr]);
    
    // Use refs to track previous values and prevent unnecessary state updates
    const prevRowsStrRef = React.useRef(null);
    const prevGradeLevelRef = React.useRef(null);
    
    useEffect(() => {
      // Only run if rows or gradeLevel actually changed
      if (rowsStr === prevRowsStrRef.current && gradeLevel === prevGradeLevelRef.current) {
        return;
      }
      
      prevRowsStrRef.current = rowsStr;
      prevGradeLevelRef.current = gradeLevel;
      
      const loadData = async () => {
        // Only set loading if not already loading
        setLoadingTraits(prev => prev ? prev : true);
        try {
          
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
          
          // Only update state if traits actually changed
          setTraits(prevTraits => {
            const prevTraitsStr = JSON.stringify(prevTraits);
            const newTraitsStr = JSON.stringify(extractedTraits);
            if (prevTraitsStr === newTraitsStr) {
              return prevTraits; // Return previous to prevent re-render
            }
            return extractedTraits;
          });
        } catch (err) {
          console.error('Error loading data:', err);
          setTraits(prevTraits => {
            const prevTraitsStr = JSON.stringify(prevTraits);
            const defaultTraitsStr = JSON.stringify(DEFAULT_TRAITS);
            if (prevTraitsStr === defaultTraitsStr) {
              return prevTraits; // Return previous to prevent re-render
            }
            return DEFAULT_TRAITS;
          });
        } finally {
          // Only set loading to false if it was true
          setLoadingTraits(prev => prev ? false : prev);
        }
      };
      
      loadData();
    }, [rowsStr, gradeLevel, fetchSectionsForGrade]);

    
    // Check if we're using default traits (which means submission data might be missing)
    const isUsingDefaultTraits = rows.length === 0 || 
                                  traits.length === 0 || 
                                  JSON.stringify(traits) === JSON.stringify(DEFAULT_TRAITS);

    return (
      <div className="laempl-report-display" style={{ width: '100%', maxWidth: '100%', margin: 0, padding: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 20px' }}>
          <div>
            <h4>LAEMPL Report {gradeLevel && <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666' }}>(Grade {gradeLevel})</span>}</h4>
            {isUsingDefaultTraits && rows.length === 0 && (
              <p style={{ fontSize: '12px', color: '#ff6b6b', marginTop: '4px', fontStyle: 'italic' }}>
                ⚠️ Note: Submission data is missing. Displaying sections from database for this grade level.
              </p>
            )}
          </div>
        </div>
        <div className="table-container" style={{ width: '100%', overflowX: 'auto', margin: 0, padding: 0 }}>
          <table className="laempl-table" style={{ width: '100%', tableLayout: 'auto', margin: 0 }}>
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
              {renderedRows.map(({ trait, cells }) => (
                <tr key={trait}>
                  <td className="trait-cell">{trait}</td>
                  {cells.map(({ colKey, value }, idx) => (
                    <td key={`${trait}-${colKey}-${idx}`} className="data-cell">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }, (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    return (
      prevProps.gradeLevel === nextProps.gradeLevel &&
      JSON.stringify(prevProps.fields) === JSON.stringify(nextProps.fields) &&
      JSON.stringify(prevProps.submission) === JSON.stringify(nextProps.submission)
    );
  });

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
      <div className="mps-report-display" style={{ marginTop: '2rem', width: '100%', maxWidth: '100%', margin: 0, padding: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 20px' }}>
          <div>
            <h4>MPS Report {gradeLevel && <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666' }}>(Grade {gradeLevel})</span>}</h4>
            {isUsingDefaultTraits && rows.length === 0 && (
              <p style={{ fontSize: '12px', color: '#ff6b6b', marginTop: '4px', fontStyle: 'italic' }}>
                ⚠️ Note: Submission data is missing. Displaying sections from database for this grade level.
              </p>
            )}
          </div>
        </div>
        <div className="table-container" style={{ width: '100%', overflowX: 'auto', margin: 0, padding: 0 }}>
          <table className="mps-table" style={{ width: '100%', tableLayout: 'auto', margin: 0 }}>
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

  const exportGradeSortedToExcel = (gradeGroupsOverride) => {
    const gradeGroupsToUse =
      Array.isArray(gradeGroupsOverride) && gradeGroupsOverride.length > 0
        ? gradeGroupsOverride
        : processedGradeGroups;

    const validGroups = gradeGroupsToUse.filter((group) =>
      (group.coordinators || []).some(
        (coord) => (coord.submissions || []).length > 0
      )
    );

    if (validGroups.length === 0) {
      alert('No data to export');
      return;
    }

    const workbook = XLSX.utils.book_new();

    validGroups.forEach((gradeGroup, idx) => {
      const gradeLevel = gradeGroup.grade_level || 'N/A';
      const coordinators = gradeGroup.coordinators || [];
      const sheetData = [];

      sheetData.push([`Grade ${gradeLevel}`]);
      sheetData.push([]);

      coordinators.forEach((coordinator) => {
        const coordinatorName =
          coordinator.coordinator_name || `Coordinator ${coordinator.coordinator_id}`;
        const coordinatorSubmissions = coordinator.submissions || [];

        if (coordinatorSubmissions.length === 0) {
          return;
        }

        sheetData.push([`Coordinator: ${coordinatorName}`]);
        sheetData.push([]);

        coordinatorSubmissions.forEach((submission) => {
          const subjectName = extractSubject(submission);
          const fields = submission.fields || {};
          const laemplRows = fields.rows || [];
          const mpsRows = fields.mps_rows || [];

          sheetData.push([`Subject: ${subjectName}`]);
          sheetData.push([]);

          const laemplCols = extractColumns(laemplRows, submission, fields);
          sheetData.push(['LAEMPL Report']);
          const laemplHeader = ['Trait', ...laemplCols.map((col) => col.label)];
          sheetData.push(laemplHeader);
          if (laemplRows.length === 0) {
            sheetData.push(['No LAEMPL data yet']);
          } else {
            laemplRows.forEach((row) => {
              const rowData = [
                row.trait || '',
                ...laemplCols.map((col) => getValueForColumn(row, col) || ''),
              ];
              sheetData.push(rowData);
            });
          }

          sheetData.push([]);

          sheetData.push(['MPS Report']);
          const mpsHeader = ['Trait', ...DEFAULT_COLS_MPS.map((col) => col.label)];
          sheetData.push(mpsHeader);
          if (mpsRows.length === 0) {
            sheetData.push(['No MPS data yet']);
          } else {
            mpsRows.forEach((row) => {
              const rowData = [
                row.trait || '',
                ...DEFAULT_COLS_MPS.map((col) => row[col.key] || ''),
              ];
              sheetData.push(rowData);
            });
            const averages = calculateMPSAverages(mpsRows, DEFAULT_COLS_MPS);
            sheetData.push([
              'Average',
              ...DEFAULT_COLS_MPS.map((col) =>
                ['mean', 'median', 'pl', 'mps', 'sd', 'target'].includes(col.key)
                  ? averages[col.key] || ''
                  : ''
              ),
            ]);
          }

          sheetData.push([]);
        });

        sheetData.push([]);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      applySheetSizing(worksheet, sheetData);
      const safeSheetName =
        `Grade_${gradeLevel}`.replace(/[\[\]\*\/\\\?\:]/g, '').substring(0, 31) ||
        `Grade${idx + 1}`;
      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
    });

    const timestamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `LAEMPL_MPS_Reports_By_Grade_${timestamp}.xlsx`);
  };

  const exportSubjectSortedToExcel = (subjectsOverride) => {
    const subjects =
      Array.isArray(subjectsOverride) && subjectsOverride.length > 0
        ? subjectsOverride
        : subjectOrganizedData;
    
    if (subjects.length === 0) {
      alert('No data to export');
      return;
    }

    const workbook = XLSX.utils.book_new();

    subjects.forEach((subject, idx) => {
      const subjectName = subject.subject_name || `Subject ${idx + 1}`;
      
      // Find a representative submission to determine columns (same logic as render)
      let sampleSubmission = null;
      let sampleFields = null;
      for (const gradeGroup of processedGradeGroups) {
        for (const coordinator of (gradeGroup.coordinators || [])) {
          for (const submission of (coordinator.submissions || [])) {
            const subSubjectName = extractSubject(submission);
            if (normalizeSubjectName(subSubjectName) === normalizeSubjectName(subjectName)) {
              sampleSubmission = submission;
              sampleFields = submission.fields || {};
              break;
            }
          }
          if (sampleSubmission) break;
        }
        if (sampleSubmission) break;
      }
      if (!sampleFields) {
        sampleFields = {
          subject_name: subjectName,
          subject_id: availableSubjects.find(
            (s) => normalizeSubjectName(s.subject_name) === normalizeSubjectName(subjectName)
          )?.subject_id,
        };
      }

      const laemplCols = extractColumns(
        subject.laemplRows && subject.laemplRows.length > 0 ? subject.laemplRows : [],
        sampleSubmission,
        sampleFields
      );

      const sheetData = [];
      sheetData.push([`Subject: ${subjectName}`]);
      sheetData.push([]);

      // LAEMPL section
      sheetData.push(["LAEMPL Report"]);
      const laemplHeader = ["Grade Level", ...laemplCols.map((col) => col.label)];
      sheetData.push(laemplHeader);
      if (subject.laemplRows.length === 0) {
        sheetData.push(["No LAEMPL data yet"]);
      } else {
        subject.laemplRows.forEach((row) => {
          const rowData = [
            row.trait || "",
            ...laemplCols.map((col) => getValueForColumn(row, col) || ""),
          ];
          sheetData.push(rowData);
        });
      }

      sheetData.push([]);

      // MPS section
      sheetData.push(["MPS Report"]);
      const mpsHeader = ["Grade Level", ...DEFAULT_COLS_MPS.map((col) => col.label)];
      sheetData.push(mpsHeader);
      if (subject.mpsRows.length === 0) {
        sheetData.push(["No MPS data yet"]);
      } else {
        subject.mpsRows.forEach((row) => {
          const rowData = [
            row.trait || "",
            ...DEFAULT_COLS_MPS.map((col) => getValueForColumn(row, col) || ""),
          ];
          sheetData.push(rowData);
        });
        const averages = calculateMPSAverages(subject.mpsRows, DEFAULT_COLS_MPS);
        sheetData.push([
          "Average",
          ...DEFAULT_COLS_MPS.map((col) =>
            ["mean", "median", "pl", "mps", "sd", "target"].includes(col.key)
              ? averages[col.key] || ""
              : ""
          ),
        ]);
      }

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      applySheetSizing(worksheet, sheetData);
      const safeSheetName =
        subjectName.replace(/[\[\]\*\/\\\?\:]/g, "").substring(0, 31) ||
        `Subject${idx + 1}`;
      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
    });

    const timestamp = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `LAEMPL_MPS_Reports_By_Subject_${timestamp}.xlsx`);
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
          marginLeft: coordinatorLabel ? '1rem' : '0',
          width: '100%',
          maxWidth: '100%'
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
        <div className="submission-content" style={{ width: '100%', maxWidth: '100%' }}>
          <div className="content-section" style={{ width: '100%', maxWidth: '100%' }}>
            {renderSubmissionContent({ ...submission, fields })}
          </div>
        </div>
      </div>
    );
  };

  const renderGradeSortedView = () => {
    if (filteredGradeGroups.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>No coordinator submissions found for any grade level.</p>
        </div>
      );
    }

    return filteredGradeGroups.map((gradeGroup, gradeIdx) => {
      const gradeLevel = gradeGroup.grade_level || 'N/A';
      const coordinators = gradeGroup.coordinators || [];

      return (
        <div key={`grade-${gradeLevel}-${gradeIdx}`} style={{ marginBottom: '3rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '1.5rem',
              paddingBottom: '0.5rem',
              borderBottom: '2px solid #e2e8f0',
            }}
          >
            <h3
              style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#1e293b',
                margin: 0,
              }}
            >
              Grade {gradeLevel}
            </h3>
            <select
              value={selectedGradeFilter}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#fff',
                color: '#1e293b',
                fontSize: '14px',
                fontWeight: '500',
                marginLeft: '1rem',
                cursor: 'pointer',
                outline: 'none',
                minWidth: '150px',
              }}
            >
              <option value="all">All Grades</option>
              <option value="1">Grade 1</option>
              <option value="2">Grade 2</option>
              <option value="3">Grade 3</option>
              <option value="4">Grade 4</option>
              <option value="5">Grade 5</option>
              <option value="6">Grade 6</option>
            </select>
          </div>

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
    const subjects = filteredSubjects;

    if (subjects.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>No subject data available yet.</p>
        </div>
      );
    }

    return (
      <>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '1.5rem',
          }}
        >
          <label style={{ fontWeight: 600, color: '#000000' }}>Subject</label>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            style={{
              padding: '10px 16px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#fff',
              color: '#1f2937',
              fontWeight: 500,
              cursor: 'pointer',
              minWidth: '220px',
            }}
          >
            <option value="all">All Subjects</option>
            {subjectOptions.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </div>

        {subjects.map((subject, subjectIdx) => {
      const subjectName = subject.subject_name || "Unknown Subject";
      const laemplHasData = subject.laemplRows.some(hasRowData);
      const mpsHasData = subject.mpsRows.some(hasRowData);

      // Find a submission for this subject to get submission/fields info for column extraction
      // This ensures we use the same column extraction logic as LAEMPLReportDisplay
      let sampleSubmission = null;
      let sampleFields = null;
      
      // Look through processedGradeGroups to find a submission for this subject
      for (const gradeGroup of processedGradeGroups) {
        for (const coordinator of (gradeGroup.coordinators || [])) {
          for (const submission of (coordinator.submissions || [])) {
            const subSubjectName = extractSubject(submission);
            if (normalizeSubjectName(subSubjectName) === normalizeSubjectName(subjectName)) {
              sampleSubmission = submission;
              sampleFields = submission.fields || {};
              break;
            }
          }
          if (sampleSubmission) break;
        }
        if (sampleSubmission) break;
      }
      
      // If no submission found, create a mock fields object with subject info
      if (!sampleFields) {
        sampleFields = {
          subject_name: subjectName,
          subject_id: availableSubjects.find(s => 
            normalizeSubjectName(s.subject_name) === normalizeSubjectName(subjectName)
          )?.subject_id
        };
      }
      
      // Extract columns using the same logic as LAEMPLReportDisplay
      // This ensures columns match exactly between "Sort per Grade Level" and "Sort by Subject"
      const laemplCols = extractColumns(
        subject.laemplRows && subject.laemplRows.length > 0 ? subject.laemplRows : [],
        sampleSubmission,
        sampleFields
      );

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
            <div className="laempl-report-display" style={{ width: '100%', maxWidth: '100%', margin: 0, padding: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 20px' }}>
                <div>
                  <h4>LAEMPL Report</h4>
                </div>
              </div>
              <div className="table-container" style={{ width: '100%', overflowX: 'auto', margin: 0, padding: 0 }}>
                <table className="laempl-table" style={{ width: '100%', tableLayout: 'auto', margin: 0 }}>
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

            <div className="mps-report-display" style={{ marginTop: '2rem', width: '100%', maxWidth: '100%', margin: 0, padding: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 20px' }}>
                <div>
                  <h4>MPS Report</h4>
                </div>
              </div>
              <div className="table-container" style={{ width: '100%', overflowX: 'auto', margin: 0, padding: 0 }}>
                <table className="mps-table" style={{ width: '100%', tableLayout: 'auto', margin: 0 }}>
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
    })}
      </>
    );
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
            onClick={() => {
              setSortMode('grade');
              setSubjectFilter('all');
            }}
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
              onClick={
                sortMode === 'grade'
                  ? () => exportGradeSortedToExcel(filteredGradeGroups)
                  : () => exportSubjectSortedToExcel(filteredSubjects)
              }
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
              title={`Export ${sortMode === 'grade' ? 'Grade Sorted' : 'Subject Sorted'} View to Excel`}
            >
              <span>📥</span>
              <span>Export to Excel</span>
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

