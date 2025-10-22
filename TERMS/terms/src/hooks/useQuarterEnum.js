// Custom hook for quarter enum functionality
import { useState, useEffect, useCallback } from 'react';
import QuarterEnumService from '../services/quarterEnumService';
import { QuarterEnumHelpers } from '../config/quarterEnumConfig';

export const useQuarterEnum = () => {
  const [quarterEnum, setQuarterEnum] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch quarter enum data
  const fetchQuarterEnum = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await QuarterEnumService.getQuarterEnum();
      setQuarterEnum(data);
    } catch (err) {
      console.error('Error fetching quarter enum:', err);
      setError(err.message);
      
      // Set fallback data
      const fallbackData = QuarterEnumHelpers.formatQuartersForSelect([]);
      setQuarterEnum(fallbackData);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get formatted quarters for dropdowns
  const getFormattedQuarters = useCallback(() => {
    return QuarterEnumHelpers.formatQuartersForSelect(quarterEnum);
  }, [quarterEnum]);

  // Get quarter info by number
  const getQuarterInfo = useCallback((quarterNumber) => {
    return QuarterEnumHelpers.getQuarterInfo(quarterNumber, quarterEnum);
  }, [quarterEnum]);

  // Validate quarter number
  const isValidQuarter = useCallback((quarter) => {
    return QuarterEnumHelpers.isValidQuarter(quarter);
  }, []);

  // Get quarter display name
  const getQuarterDisplayName = useCallback((quarterNumber, useShortName = false) => {
    return QuarterEnumHelpers.getQuarterDisplayName(quarterNumber, useShortName);
  }, []);

  // Clear cache and refetch
  const refresh = useCallback(() => {
    QuarterEnumService.clearCache();
    fetchQuarterEnum();
  }, [fetchQuarterEnum]);

  useEffect(() => {
    fetchQuarterEnum();
  }, [fetchQuarterEnum]);

  return {
    quarterEnum,
    loading,
    error,
    getFormattedQuarters,
    getQuarterInfo,
    isValidQuarter,
    getQuarterDisplayName,
    refresh
  };
};

export const useQuartersForYear = (yearId) => {
  const [quarters, setQuarters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchQuartersForYear = useCallback(async () => {
    if (!yearId) {
      setQuarters([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const data = await QuarterEnumService.getQuartersForYear(yearId);
      setQuarters(data);
    } catch (err) {
      console.error('Error fetching quarters for year:', err);
      setError(err.message);
      setQuarters([]);
    } finally {
      setLoading(false);
    }
  }, [yearId]);

  useEffect(() => {
    fetchQuartersForYear();
  }, [fetchQuartersForYear]);

  return {
    quarters,
    loading,
    error,
    refresh: fetchQuartersForYear
  };
};

export const useActiveYearQuarter = () => {
  const [activeYearQuarter, setActiveYearQuarter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchActiveYearQuarter = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await QuarterEnumService.getActiveYearQuarter();
      setActiveYearQuarter(data);
    } catch (err) {
      console.error('Error fetching active year quarter:', err);
      setError(err.message);
      setActiveYearQuarter(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const setActive = useCallback(async (year, quarter) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await QuarterEnumService.setActiveYearQuarter(year, quarter);
      setActiveYearQuarter(result.active_year_quarter);
      return result;
    } catch (err) {
      console.error('Error setting active year quarter:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveYearQuarter();
  }, [fetchActiveYearQuarter]);

  return {
    activeYearQuarter,
    loading,
    error,
    setActive,
    refresh: fetchActiveYearQuarter
  };
};

export default useQuarterEnum;
