/**
 * Validation utility functions for form validation across the application
 */

/**
 * Validates that a narrative field is not empty and meets minimum length requirements
 * @param {string} narrative - The narrative text to validate
 * @param {number} minLength - Minimum required length (default: 10)
 * @returns {Array<string>} Array of validation error messages
 */
export const validateNarrative = (narrative, minLength = 10) => {
  const errors = [];
  
  if (!narrative || narrative.trim().length === 0) {
    errors.push("Narrative is required");
  } else if (narrative.trim().length < minLength) {
    errors.push(`Narrative must be at least ${minLength} characters long`);
  }
  
  return errors;
};

/**
 * Validates that at least one image is provided
 * @param {Array} existingImages - Array of existing images
 * @param {Array} newFiles - Array of new files to be uploaded
 * @returns {Array<string>} Array of validation error messages
 */
export const validateImages = (existingImages = [], newFiles = []) => {
  const errors = [];
  
  if (existingImages.length === 0 && newFiles.length === 0) {
    errors.push("At least one image is required");
  }
  
  return errors;
};

/**
 * Validates that all required fields in a table/grid are filled
 * @param {Object} data - The data object containing form values
 * @param {Array} traits - Array of trait names to validate
 * @param {Array} columns - Array of column objects with key and label properties
 * @returns {Array<string>} Array of validation error messages
 */
export const validateTableFields = (data, traits, columns) => {
  const errors = [];
  
  traits.forEach(trait => {
    columns.forEach(col => {
      const value = data[trait]?.[col.key];
      if (value === "" || value == null || value === undefined) {
        errors.push(`${trait} - ${col.label} is required`);
      }
    });
  });
  
  return errors;
};

/**
 * Validates accomplishment report form
 * @param {string} narrative - The narrative text
 * @param {Array} existingImages - Array of existing images
 * @param {Array} newFiles - Array of new files
 * @returns {Array<string>} Array of validation error messages
 */
export const validateAccomplishmentReport = (narrative, existingImages = [], newFiles = []) => {
  const errors = [];
  
  errors.push(...validateNarrative(narrative));
  errors.push(...validateImages(existingImages, newFiles));
  
  return errors;
};

/**
 * Validates MPS report form
 * @param {Object} data - The MPS data object
 * @param {Array} traits - Array of trait names
 * @param {Array} columns - Array of column objects
 * @returns {Array<string>} Array of validation error messages
 */
export const validateMPSReport = (data, traits, columns) => {
  return validateTableFields(data, traits, columns);
};

/**
 * Validates LAEMPL report form
 * @param {Object} data - The LAEMPL data object
 * @param {Array} traits - Array of trait names
 * @param {Array} columns - Array of column objects
 * @returns {Array<string>} Array of validation error messages
 */
export const validateLAEMPLReport = (data, traits, columns) => {
  return validateTableFields(data, traits, columns);
};

/**
 * Formats validation errors for display
 * @param {Array<string>} errors - Array of error messages
 * @param {number} maxDisplay - Maximum number of errors to display (default: 3)
 * @returns {string} Formatted error message
 */
export const formatValidationErrors = (errors, maxDisplay = 3) => {
  if (errors.length === 0) return "";
  
  const displayErrors = errors.slice(0, maxDisplay);
  const hasMore = errors.length > maxDisplay;
  
  return `Please fill all required fields: ${displayErrors.join(", ")}${hasMore ? "..." : ""}`;
};

/**
 * Generic form validation that can be used for any form
 * @param {Object} formData - The form data object
 * @param {Object} validationRules - Object containing validation rules for each field
 * @returns {Object} Object containing isValid boolean and errors array
 */
export const validateForm = (formData, validationRules) => {
  const errors = [];
  
  Object.entries(validationRules).forEach(([field, rules]) => {
    const value = formData[field];
    
    if (rules.required && (!value || value.toString().trim() === "")) {
      errors.push(`${rules.label || field} is required`);
    }
    
    if (value && rules.minLength && value.toString().length < rules.minLength) {
      errors.push(`${rules.label || field} must be at least ${rules.minLength} characters long`);
    }
    
    if (value && rules.maxLength && value.toString().length > rules.maxLength) {
      errors.push(`${rules.label || field} must be no more than ${rules.maxLength} characters long`);
    }
    
    if (value && rules.pattern && !rules.pattern.test(value.toString())) {
      errors.push(`${rules.label || field} format is invalid`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

