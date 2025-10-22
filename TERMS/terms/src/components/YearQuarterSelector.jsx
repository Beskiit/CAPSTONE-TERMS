import React, { useState, useEffect } from 'react';
import { useQuarterEnum } from '../hooks/useQuarterEnum';
import QuarterSelector from './QuarterSelector';
import './YearQuarterSelector.css';

const YearQuarterSelector = ({ 
  selectedYear, 
  selectedQuarter, 
  onYearChange, 
  onQuarterChange,
  disabled = false,
  showShortNames = false,
  className = ""
}) => {
  const [schoolYears, setSchoolYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { getFormattedQuarters, loading: quartersLoading } = useQuarterEnum();

  // Fetch school years
  useEffect(() => {
    const fetchSchoolYears = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");
        const response = await fetch(`${API_BASE}/admin/school-years`, {
          credentials: "include"
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch school years');
        }
        
        const data = await response.json();
        setSchoolYears(data);
      } catch (err) {
        console.error('Error fetching school years:', err);
        setError(err.message);
        
        // Set fallback data
        setSchoolYears([
          { year_id: 1, school_year: '2025-2026', start_year: 2025, end_year: 2026 }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchSchoolYears();
  }, []);

  const handleYearChange = (e) => {
    const yearId = parseInt(e.target.value);
    if (onYearChange) {
      onYearChange(yearId);
    }
  };

  const handleQuarterChange = (quarter) => {
    if (onQuarterChange) {
      onQuarterChange(quarter);
    }
  };

  const quarters = getFormattedQuarters();

  if (loading || quartersLoading) {
    return (
      <div className={`year-quarter-selector loading ${className}`}>
        <div className="selector-group">
          <label>School Year:</label>
          <select disabled className="dropdown-select">
            <option>Loading years...</option>
          </select>
        </div>
        <div className="selector-group">
          <label>Quarter:</label>
          <QuarterSelector disabled placeholder="Loading quarters..." />
        </div>
      </div>
    );
  }

  return (
    <div className={`year-quarter-selector ${className}`}>
      <div className="selector-group">
        <label htmlFor="year-select">School Year:</label>
        <select 
          id="year-select"
          value={selectedYear || ''} 
          onChange={handleYearChange}
          disabled={disabled}
          className="dropdown-select"
        >
          <option value="">Select Year</option>
          {schoolYears.map(year => (
            <option key={year.year_id} value={year.year_id}>
              {year.school_year}
            </option>
          ))}
        </select>
      </div>
      
      <div className="selector-group">
        <label htmlFor="quarter-select">Quarter:</label>
        <QuarterSelector
          id="quarter-select"
          selectedQuarter={selectedQuarter}
          onQuarterChange={handleQuarterChange}
          disabled={disabled}
          showShortNames={showShortNames}
          placeholder="Select Quarter"
        />
      </div>
      
      {error && (
        <div className="year-quarter-selector-error">
          <small>Using fallback data: {error}</small>
        </div>
      )}
    </div>
  );
};

export default YearQuarterSelector;
