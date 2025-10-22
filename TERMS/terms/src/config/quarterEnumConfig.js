// Quarter Enum Configuration
// Centralized configuration for quarter enum integration

export const QUARTER_ENUM_CONFIG = {
  // API endpoints for quarter enum
  endpoints: {
    quarterEnum: '/admin/quarter-enum',
    quartersForYear: '/admin/quarters',
    comprehensiveQuarters: '/admin/quarters-comprehensive',
    activeYearQuarter: '/admin/active-year-quarter',
    setActiveYearQuarter: '/admin/set-active-year-quarter',
    createYearQuarter: '/admin/year-quarter'
  },
  
  // Quarter validation
  validQuarters: [1, 2, 3, 4],
  
  // Default quarter names (fallback)
  defaultQuarterNames: {
    1: 'First Quarter',
    2: 'Second Quarter', 
    3: 'Third Quarter',
    4: 'Fourth Quarter'
  },
  
  // Default quarter short names (fallback)
  defaultQuarterShortNames: {
    1: '1st Quarter',
    2: '2nd Quarter',
    3: '3rd Quarter', 
    4: '4th Quarter'
  },
  
  // Cache settings
  cache: {
    duration: 5 * 60 * 1000, // 5 minutes
    enabled: true
  },
  
  // Error handling
  errorHandling: {
    showFallbackData: true,
    logErrors: true,
    retryAttempts: 3
  }
};

// Helper functions for quarter enum integration
export const QuarterEnumHelpers = {
  // Validate quarter number
  isValidQuarter: (quarter) => {
    return QUARTER_ENUM_CONFIG.validQuarters.includes(parseInt(quarter));
  },
  
  // Get quarter display name with fallback
  getQuarterDisplayName: (quarterNumber, useShortName = false) => {
    const names = useShortName 
      ? QUARTER_ENUM_CONFIG.defaultQuarterShortNames
      : QUARTER_ENUM_CONFIG.defaultQuarterNames;
    
    return names[quarterNumber] || `Quarter ${quarterNumber}`;
  },
  
  // Format quarters for dropdown/select components
  formatQuartersForSelect: (quarterEnumData) => {
    if (!quarterEnumData || !Array.isArray(quarterEnumData)) {
      // Return fallback data
      return QUARTER_ENUM_CONFIG.validQuarters.map(quarter => ({
        value: quarter,
        label: QuarterEnumHelpers.getQuarterDisplayName(quarter),
        quarter: quarter,
        shortName: QuarterEnumHelpers.getQuarterDisplayName(quarter, true)
      }));
    }
    
    return quarterEnumData.map(quarter => ({
      value: quarter.quarter_number,
      label: quarter.quarter_name,
      quarter: quarter.quarter_number,
      shortName: quarter.quarter_short_name
    }));
  },
  
  // Create year-quarter combinations
  createYearQuarterCombinations: (schoolYears, quarterEnumData) => {
    const combinations = [];
    
    schoolYears.forEach(year => {
      quarterEnumData.forEach(quarter => {
        combinations.push({
          yr_and_qtr_id: `${year.year_id}_${quarter.quarter_number}`,
          year: year.year_id,
          quarter: quarter.quarter_number,
          quarter_name: quarter.quarter_name,
          quarter_short_name: quarter.quarter_short_name,
          school_year: year.school_year,
          start_year: year.start_year,
          end_year: year.end_year
        });
      });
    });
    
    return combinations;
  },
  
  // Get quarter info by number
  getQuarterInfo: (quarterNumber, quarterEnumData) => {
    if (!quarterEnumData || !Array.isArray(quarterEnumData)) {
      return {
        quarter_number: quarterNumber,
        quarter_name: QuarterEnumHelpers.getQuarterDisplayName(quarterNumber),
        quarter_short_name: QuarterEnumHelpers.getQuarterDisplayName(quarterNumber, true)
      };
    }
    
    const quarter = quarterEnumData.find(q => q.quarter_number === quarterNumber);
    return quarter || {
      quarter_number: quarterNumber,
      quarter_name: QuarterEnumHelpers.getQuarterDisplayName(quarterNumber),
      quarter_short_name: QuarterEnumHelpers.getQuarterDisplayName(quarterNumber, true)
    };
  }
};

export default QUARTER_ENUM_CONFIG;
