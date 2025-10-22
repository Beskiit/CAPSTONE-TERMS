// Quarter Enum Service
// Handles all quarter enum related API calls and data management

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

class QuarterEnumService {
  // Cache for quarter enum data
  static quarterEnumCache = null;
  static cacheTimestamp = null;
  static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Get quarter enum data with caching
  static async getQuarterEnum() {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.quarterEnumCache && this.cacheTimestamp && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.quarterEnumCache;
    }

    try {
      const response = await fetch(`${API_BASE}/admin/quarter-enum`, {
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error('Failed to fetch quarter enum');
      }

      const data = await response.json();
      
      // Cache the data
      this.quarterEnumCache = data;
      this.cacheTimestamp = now;
      
      return data;
    } catch (error) {
      console.error('Error fetching quarter enum:', error);
      
      // Return fallback data if API fails
      return [
        { quarter_id: 1, quarter_number: 1, quarter_name: 'First Quarter', quarter_short_name: '1st Quarter' },
        { quarter_id: 2, quarter_number: 2, quarter_name: 'Second Quarter', quarter_short_name: '2nd Quarter' },
        { quarter_id: 3, quarter_number: 3, quarter_name: 'Third Quarter', quarter_short_name: '3rd Quarter' },
        { quarter_id: 4, quarter_number: 4, quarter_name: 'Fourth Quarter', quarter_short_name: '4th Quarter' }
      ];
    }
  }

  // Get quarters for a specific year with enum information
  static async getQuartersForYear(yearId) {
    try {
      const response = await fetch(`${API_BASE}/admin/quarters/${yearId}`, {
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error('Failed to fetch quarters for year');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching quarters for year:', error);
      return [];
    }
  }

  // Get comprehensive quarter information
  static async getComprehensiveQuarters() {
    try {
      const response = await fetch(`${API_BASE}/admin/quarters-comprehensive`, {
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error('Failed to fetch comprehensive quarters');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching comprehensive quarters:', error);
      return [];
    }
  }

  // Get active year and quarter with enum information
  static async getActiveYearQuarter() {
    try {
      const response = await fetch(`${API_BASE}/admin/active-year-quarter`, {
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error('Failed to fetch active year and quarter');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching active year and quarter:', error);
      return null;
    }
  }

  // Set active year and quarter
  static async setActiveYearQuarter(year, quarter) {
    try {
      const response = await fetch(`${API_BASE}/admin/set-active-year-quarter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: "include",
        body: JSON.stringify({ year, quarter })
      });

      if (!response.ok) {
        throw new Error('Failed to set active year and quarter');
      }

      return await response.json();
    } catch (error) {
      console.error('Error setting active year and quarter:', error);
      throw error;
    }
  }

  // Create year and quarter with enum validation
  static async createYearQuarter(year, quarter) {
    try {
      const response = await fetch(`${API_BASE}/admin/year-quarter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: "include",
        body: JSON.stringify({ year, quarter })
      });

      if (!response.ok) {
        throw new Error('Failed to create year and quarter');
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating year and quarter:', error);
      throw error;
    }
  }

  // Get quarter name by number
  static async getQuarterName(quarterNumber) {
    const quarterEnum = await this.getQuarterEnum();
    const quarter = quarterEnum.find(q => q.quarter_number === quarterNumber);
    return quarter ? quarter.quarter_name : `Quarter ${quarterNumber}`;
  }

  // Get quarter short name by number
  static async getQuarterShortName(quarterNumber) {
    const quarterEnum = await this.getQuarterEnum();
    const quarter = quarterEnum.find(q => q.quarter_number === quarterNumber);
    return quarter ? quarter.quarter_short_name : `${quarterNumber}st Quarter`;
  }

  // Format quarters for dropdown/select components
  static async getFormattedQuarters() {
    const quarterEnum = await this.getQuarterEnum();
    return quarterEnum.map(quarter => ({
      value: quarter.quarter_number,
      label: quarter.quarter_name,
      quarter: quarter.quarter_number,
      shortName: quarter.quarter_short_name
    }));
  }

  // Validate quarter number
  static isValidQuarter(quarter) {
    return [1, 2, 3, 4].includes(parseInt(quarter));
  }

  // Get quarter display name with fallback
  static getQuarterDisplayName(quarterNumber, useShortName = false) {
    const quarterNames = {
      1: useShortName ? '1st Quarter' : 'First Quarter',
      2: useShortName ? '2nd Quarter' : 'Second Quarter',
      3: useShortName ? '3rd Quarter' : 'Third Quarter',
      4: useShortName ? '4th Quarter' : 'Fourth Quarter'
    };
    
    return quarterNames[quarterNumber] || `Quarter ${quarterNumber}`;
  }

  // Clear cache (useful for testing or when data changes)
  static clearCache() {
    this.quarterEnumCache = null;
    this.cacheTimestamp = null;
  }
}

export default QuarterEnumService;
