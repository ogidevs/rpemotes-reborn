import { useRef, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

/**
 * @param {string} storageKey
 * @returns {{position: {x: number, y: number}, handleRef: object, onMouseDown: function, setPosition: function}}
 */
export const useDraggable = (storageKey) => {
    const [position, setPosition] = useLocalStorage(storageKey, { x: 0, y: 0 });
    const dragState = useRef({
        isDragging: false,
        start: { x: 0, y: 0 },
        element: { x: 0, y: 0 }
    }).current;
    const handleRef = useRef(null);

    const onMouseMove = useCallback((e) => {
        if (!dragState.isDragging) return;
        const dx = e.clientX - dragState.start.x;
        const dy = e.clientY - dragState.start.y;
        setPosition({ x: dragState.element.x + dx, y: dragState.element.y + dy });
    }, [dragState, setPosition]);

    const onMouseUp = useCallback(() => {
        dragState.isDragging = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
    }, [onMouseMove, dragState]);

    const onMouseDown = useCallback((e) => {
        if (handleRef.current && handleRef.current.contains(e.target)) {
            dragState.isDragging = true;
            dragState.start = { x: e.clientX, y: e.clientY };
            dragState.element = position;
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        }
    }, [onMouseMove, onMouseUp, dragState, position]);
    
    return { position, handleRef, onMouseDown, setPosition };
};