import { useState, useCallback } from 'react';

/**
 * @param {string} key
 * @param {*} initialValue
 * @returns {[*, function]}
 */
export const useLocalStorage = (key, initialValue) => {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error("Greška pri čitanju iz localStorage:", error);
            return initialValue;
        }
    });

    const setValue = useCallback((value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error("Greška pri upisu u localStorage:", error);
        }
    }, [key, storedValue]);

    return [storedValue, setValue];
};