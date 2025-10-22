import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNuiEvent, sendNuiMessage } from '../hooks/useNuiEvent';
import { useDebounce } from '../hooks/useDebounce';

const lerp = (start, end, amt) => (1 - amt) * start + amt * end;
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

const GizmoComponent = () => {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);
    const [camDist, setCamDist] = useState(5.0);
    const [dragging, setDragging] = useState(null);
    const [hovered, setHovered] = useState(null);
    const [targetOffsets, setTargetOffsets] = useState({ x: 0, y: 0, z: 0, rotZ: 0 });
    const [visualOffsets, setVisualOffsets] = useState({ x: 0, y: 0, z: 0, rotZ: 0 });
    
    const gizmoContainerRef = useRef(null);
    const dragStartRef = useRef({ x: 0, y: 0, startAngle: 0, initialOffsets: { ...targetOffsets } });
    const debouncedTargetOffsets = useDebounce(targetOffsets, 10);

    useEffect(() => {
        if (!visible) return;
        let animationFrameId;
        const animate = () => {
            setVisualOffsets(current => ({
                x: lerp(current.x, targetOffsets.x, 0.1),
                y: lerp(current.y, targetOffsets.y, 0.1),
                z: lerp(current.z, targetOffsets.z, 0.1),
                rotZ: lerp(current.rotZ, targetOffsets.rotZ, 0.1),
            }));
            animationFrameId = requestAnimationFrame(animate);
        };
        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [visible, targetOffsets]);

    useNuiEvent('showReactGizmo', ({ status }) => { setVisible(status); if (status) { setTargetOffsets({ x: 0, y: 0, z: 0, rotZ: 0 }); setVisualOffsets({ x: 0, y: 0, z: 0, rotZ: 0 }); } });
    useNuiEvent('updateGizmoPosition', (data) => {
        if (gizmoContainerRef.current) {
            if (data.onScreen) {
                const x = data.screenX * 100;
                const y = data.screenY * 100;
                const scale = Math.max(0.4, 1 - (data.camDist / 30));
                gizmoContainerRef.current.style.transform = `translate(${x}vw, ${y}vh) translate(-50%, -50%) scale(${scale})`;
                gizmoContainerRef.current.style.opacity = '1';
            } else {
                gizmoContainerRef.current.style.opacity = '0';
            }
        }
        setCamDist(data.camDist);
    });

    useEffect(() => { if (visible) sendNuiMessage('updatePedPositionFromUI', debouncedTargetOffsets); }, [debouncedTargetOffsets, visible]);
    
    const handleGizmoMouseDown = useCallback((e, axis) => {
        e.preventDefault(); e.stopPropagation();
        setDragging(axis);
        let startAngle = 0;
        if (axis === 'rotZ' && gizmoContainerRef.current) {
            const rect = gizmoContainerRef.current.getBoundingClientRect();
            const centerX = rect.left + (rect.width / 2);
            const centerY = rect.top + (rect.height / 2);
            startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
        }
        dragStartRef.current = { x: e.clientX, y: e.clientY, startAngle, initialOffsets: { ...targetOffsets } };
    }, [targetOffsets]);

    const handleMouseUp = useCallback(() => {
        if (dragging) setDragging(null);
    }, [dragging]);

    const handleMouseMove = useCallback((e) => {
        if (!dragging) return;
        const initial = dragStartRef.current.initialOffsets;
        let newOffsets = { ...initial };
        if (dragging === 'rotZ') {
            const rect = gizmoContainerRef.current.getBoundingClientRect();
            const centerX = rect.left + (rect.width / 2);
            const centerY = rect.top + (rect.height / 2);
            const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
            const deltaAngle = currentAngle - dragStartRef.current.startAngle;
            newOffsets.rotZ = initial.rotZ + deltaAngle;
        } else {
            const MAX_DELTA = 150;
            let deltaX = clamp(e.clientX - dragStartRef.current.x, -MAX_DELTA, MAX_DELTA);
            let deltaY = clamp(e.clientY - dragStartRef.current.y, -MAX_DELTA, MAX_DELTA);
            const posSensitivity = 0.005; 
            switch (dragging) {
                case 'x': newOffsets.x = initial.x + deltaX * posSensitivity; break;
                case 'y': newOffsets.y = initial.y + deltaY * posSensitivity; break;
                case 'z': newOffsets.z = initial.z - deltaY * posSensitivity; break;
                default: break;
            }
        }
        const MAX_OFFSET = 2.5;
        newOffsets.x = clamp(newOffsets.x, -MAX_OFFSET, MAX_OFFSET);
        newOffsets.y = clamp(newOffsets.y, -MAX_OFFSET, MAX_OFFSET);
        newOffsets.z = clamp(newOffsets.z, 0.0, MAX_OFFSET);
        setTargetOffsets(newOffsets);
    }, [dragging, camDist]);
    
    useEffect(() => {
        if (!visible) return;
        const handleWindowMouseDown = (e) => { if (e.button === 2) sendNuiMessage('setCameraControl', { status: true }); };
        const handleWindowMouseUp = (e) => { if (e.button === 2) sendNuiMessage('setCameraControl', { status: false }); if (dragging) setDragging(null); };
        window.addEventListener('mousedown', handleWindowMouseDown);
        window.addEventListener('mouseup', handleWindowMouseUp);
        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousedown', handleWindowMouseDown);
            window.removeEventListener('mouseup', handleWindowMouseUp);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [visible, dragging, handleMouseMove]);

    const handleSave = () => sendNuiMessage('savePositioning');
    const handleCancel = () => sendNuiMessage('cancelPositioning');

    if (!visible) return null;
    
    const getAxisColor = (axis) => {
        if (dragging === axis || hovered === axis) return "#FFEB3B";
        if (axis === 'x') return "#F44336";
        if (axis === 'y') return "#2196F3";
        if (axis === 'z') return "#4CAF50";
        if (axis === 'rotZ') return "#00BCD4";
        return "grey";
    };

    return (
        <div className="gizmo-overlay" onContextMenu={(e) => e.preventDefault()}>
            <div ref={gizmoContainerRef} className="gizmo-position-container">
                <svg className="gizmo-svg" width="250" height="250" viewBox="-125 -125 250 250">
                    <defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="rgba(0,0,0,0.5)" /></filter></defs>
                    <g filter="url(#glow)">
                        <g onMouseDown={e => handleGizmoMouseDown(e, 'rotZ')} onMouseEnter={() => setHovered('rotZ')} onMouseLeave={() => setHovered(null)} className="gizmo-handle-group"><circle cx="0" cy="0" r="80" stroke={getAxisColor('rotZ')} strokeWidth="5" fill="transparent"/><circle cx="80" cy="0" r="8" fill={getAxisColor('rotZ')} stroke="rgba(0,0,0,0.5)" strokeWidth="1"/></g>
                        <g onMouseDown={e => handleGizmoMouseDown(e, 'y')} onMouseEnter={() => setHovered('y')} onMouseLeave={() => setHovered(null)} className="gizmo-handle-group" transform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="-100" stroke={getAxisColor('y')} strokeWidth="5"/><polygon points="0,-110 -8,-95 8,-95" fill={getAxisColor('y')}/></g>
                        <g onMouseDown={e => handleGizmoMouseDown(e, 'x')} onMouseEnter={() => setHovered('x')} onMouseLeave={() => setHovered(null)} className="gizmo-handle-group"><line x1="0" y1="0" x2="100" y2="0" stroke={getAxisColor('x')} strokeWidth="5"/><polygon points="110,0 95,-8 95,8" fill={getAxisColor('x')}/></g>
                        <g onMouseDown={e => handleGizmoMouseDown(e, 'z')} onMouseEnter={() => setHovered('z')} onMouseLeave={() => setHovered(null)} className="gizmo-handle-group"><line x1="0" y1="0" x2="0" y2="-100" stroke={getAxisColor('z')} strokeWidth="5"/><polygon points="0,-110 -8,-95 8,-95" fill={getAxisColor('z')}/></g>
                        <circle cx="0" cy="0" r="6" fill="#f1f5f9" stroke="rgba(0,0,0,0.5)" strokeWidth="1"/>
                    </g>
                </svg>
            </div>
            <div className="gizmo-controls-panel">
                 <h3>{t('gizmo.title')}</h3>
                 <div className="gizmo-offset-display">
                     <span>X: {visualOffsets.x.toFixed(2)}</span>
                     <span>Y: {visualOffsets.y.toFixed(2)}</span>
                     <span>Z: {visualOffsets.z.toFixed(2)}</span>
                     <span>{t('gizmo.rotation')}: {visualOffsets.rotZ.toFixed(0)}°</span>
                 </div>
                 <div className="gizmo-actions">
                     <button onClick={handleCancel}>{t('gizmo.cancelButton')}</button>
                     <button onClick={handleSave}>{t('gizmo.saveButton')}</button>
                 </div>
                 <div className="gizmo-instruction">
                     <small>{t('gizmo.instructions')}</small>
                 </div>
            </div>
        </div>
    );
};

export default GizmoComponent;