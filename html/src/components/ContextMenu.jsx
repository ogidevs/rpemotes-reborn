import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { sendNuiMessage } from '../hooks/useNuiEvent';

const ContextMenu = ({ x, y, emote, keybinds, onClose }) => {
    const { t } = useTranslation();
    const menuRef = useRef(null);
    const [menuPosition, setMenuPosition] = useState({ top: y, left: x });

    useEffect(() => {
        if (menuRef.current) {
            const menuWidth = menuRef.current.offsetWidth;
            const menuHeight = menuRef.current.offsetHeight;
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;

            const parentRect = menuRef.current.parentElement.getBoundingClientRect();
            let finalX = x - parentRect.left;
            let finalY = y - parentRect.top;

            if (finalX + menuWidth > screenWidth) finalX = screenWidth - menuWidth - 10 - parentRect.left;
            if (finalY + menuHeight > screenHeight) finalY = screenHeight - menuHeight - 10 - parentRect.top;
            
            setMenuPosition({ top: finalY < 0 ? 0 : finalY, left: finalX < 0 ? 0 : finalX });
        }
    }, [x, y]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    const handleBind = (slotNumber) => {
        sendNuiMessage('bindEmote', { key: slotNumber, emote: emote.name });
        onClose();
    };

    const handleDelete = (slotNumber) => {
        sendNuiMessage('deleteEmoteBind', { key: slotNumber });
        onClose();
    };

    return (
        <div ref={menuRef} className="context-menu" style={{ position: 'absolute', top: menuPosition.top, left: menuPosition.left }}>
            <div className="context-menu-header">{t('contextMenu.header', { emoteLabel: emote.label })}</div>
            <ul className="context-menu-list">
                {keybinds.map((keybind, index) => {
                    const slotNumber = index + 1;
                    const boundEmoteName = keybind.emote;
                    const isSlotOccupied = !!boundEmoteName;

                    return (
                        <li key={slotNumber} className="context-menu-item">
                            <div className="slot-info">
                                <span>{t('contextMenu.quickEmote', { slot: slotNumber })}</span>
                                {isSlotOccupied ? (
                                    <span className="bound-emote">{t('contextMenu.boundEmote', { emoteName: boundEmoteName })}</span>
                                ) : (
                                    <span className="bound-emote empty">{t('contextMenu.emptySlot')}</span>
                                )}
                            </div>
                            
                            <div className="item-actions">
                                <button 
                                    className="context-action-btn bind" 
                                    title={t(isSlotOccupied ? 'contextMenu.replaceActionTooltip' : 'contextMenu.bindActionTooltip', {
                                        boundEmote: boundEmoteName,
                                        emoteLabel: emote.label
                                    })}
                                    onClick={() => handleBind(slotNumber)}>
                                    <i className="fa-solid fa-link"></i>
                                </button>
                                
                                {isSlotOccupied && (
                                    <button 
                                        className="context-action-btn delete" 
                                        title={t('contextMenu.deleteActionTooltip', { boundEmote: boundEmoteName })}
                                        onClick={() => handleDelete(slotNumber)}>
                                        <i className="fa-solid fa-trash-can"></i>
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
            <div className="context-menu-footer">{t('contextMenu.footer')}</div>
        </div>
    );
};

export default ContextMenu;