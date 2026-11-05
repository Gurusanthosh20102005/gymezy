import { useState, useEffect } from 'react';

/**
 * useDebounce
 * Single Source of Truth (SSOT) hook for debouncing search queries across User React screens.
 * @param {any} value - The input value to debounce
 * @param {number} delay - Debounce delay in milliseconds (default: 300ms)
 * @returns {any} - The debounced value
 */
export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export default useDebounce;

