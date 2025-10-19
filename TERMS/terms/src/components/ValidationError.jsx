import React from 'react';
import './ValidationError.css';

/**
 * ValidationError component for displaying form validation errors
 * @param {Object} props - Component props
 * @param {Array<string>} props.errors - Array of error messages
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.showIcon - Whether to show error icon
 * @param {string} props.title - Error title (default: "Please fix the following errors:")
 */
const ValidationError = ({ 
  errors = [], 
  className = "", 
  showIcon = true, 
  title = "Please fix the following errors:",
  maxDisplay = 5 
}) => {
  if (!errors || errors.length === 0) return null;

  const displayErrors = errors.slice(0, maxDisplay);
  const hasMore = errors.length > maxDisplay;

  return (
    <div className={`validation-error ${className}`}>
      {showIcon && (
        <div className="validation-error-icon">
          ⚠️
        </div>
      )}
      <div className="validation-error-content">
        <div className="validation-error-title">
          {title}
        </div>
        <ul className="validation-error-list">
          {displayErrors.map((error, index) => (
            <li key={index} className="validation-error-item">
              {error}
            </li>
          ))}
          {hasMore && (
            <li className="validation-error-more">
              ... and {errors.length - maxDisplay} more error{errors.length - maxDisplay !== 1 ? 's' : ''}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default ValidationError;
