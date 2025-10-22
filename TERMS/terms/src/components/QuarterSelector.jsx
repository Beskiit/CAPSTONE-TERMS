import React, { useState, useEffect } from 'react';
import QuarterEnumService from '../services/quarterEnumService';
import './QuarterSelector.css';

const QuarterSelector = ({ 
  selectedQuarter, 
  onQuarterChange, 
  disabled = false,
  showShortNames = false,
  placeholder = "Select Quarter",
  className = "",
  id = "quarter-select"
}) => {
  const [quarters, setQuarters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchQuarters = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const formattedQuarters = await QuarterEnumService.getFormattedQuarters();
        setQuarters(formattedQuarters);
      } catch (err) {
        console.error('Error fetching quarters:', err);
        setError('Failed to load quarters');
        
        // Fallback to static quarters
        const fallbackQuarters = [
          { value: 1, label: 'First Quarter', quarter: 1, shortName: '1st Quarter' },
          { value: 2, label: 'Second Quarter', quarter: 2, shortName: '2nd Quarter' },
          { value: 3, label: 'Third Quarter', quarter: 3, shortName: '3rd Quarter' },
          { value: 4, label: 'Fourth Quarter', quarter: 4, shortName: '4th Quarter' }
        ];
        setQuarters(fallbackQuarters);
      } finally {
        setLoading(false);
      }
    };

    fetchQuarters();
  }, []);

  const handleQuarterChange = (e) => {
    const quarterValue = parseInt(e.target.value);
    if (onQuarterChange) {
      onQuarterChange(quarterValue);
    }
  };

  if (loading) {
    return (
      <div className={`quarter-selector loading ${className}`}>
        <select disabled className="dropdown-select">
          <option>Loading quarters...</option>
        </select>
      </div>
    );
  }

  if (error) {
    console.warn('Quarter selector using fallback data due to error:', error);
  }

  return (
    <div className={`quarter-selector ${className}`}>
      <select 
        id={id}
        value={selectedQuarter || ''} 
        onChange={handleQuarterChange}
        disabled={disabled}
        className="dropdown-select"
      >
        <option value="">{placeholder}</option>
        {quarters.map(quarter => (
          <option key={quarter.value} value={quarter.value}>
            {showShortNames ? quarter.shortName : quarter.label}
          </option>
        ))}
      </select>
      {error && (
        <div className="quarter-selector-error">
          <small>Using fallback quarter data</small>
        </div>
      )}
    </div>
  );
};

export default QuarterSelector;
