import { useEffect } from 'react';

/**
 * @param {string} eventName
 * @param {function} handler
 */
export const useNuiEvent = (eventName, handler) => {
    useEffect(() => {
        const listener = (event) => {
            if (event.data.action === eventName) {
                handler(event.data);
            }
        };
        window.addEventListener('message', listener);
        return () => window.removeEventListener('message', listener);
    }, [eventName, handler]);
};

/**
 * @param {string} action
 * @param {object} payload
 * @returns {Promise}
 */
export const sendNuiMessage = (action, payload = {}) => {
    return fetch(`https://${GetParentResourceName()}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(payload),
    }).then(async resp => {
        const text = await resp.text();
        return text ? JSON.parse(text) : {};
    });
};