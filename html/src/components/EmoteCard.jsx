import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { sendNuiMessage } from '../hooks/useNuiEvent';

const EmoteCard = memo(({ emote, isFavorite, onToggleFavorite, isHovering, onContextMenu }) => {
    const { t } = useTranslation();
    const [frameIndex, setFrameIndex] = useState(0);
    const [frames, setFrames] = useState([]);
    const [status, setStatus] = useState('pending');
    const animationFramesLoaded = useRef(false);
    const maxFrameCount = 8;

    const type = useMemo(() => {
        if (emote.category === 'Walks') return 'walk';
        if (emote.category === 'Expressions') return 'expression';
        return 'emote';
    }, [emote.category]);

    useEffect(() => {
        const baseFrame = `../emotes/${type}_${emote.name}_f1.webp`;
        const img = new Image();
        img.src = baseFrame;
        img.onload = () => { setFrames([baseFrame]); setStatus('loaded'); };
        img.onerror = () => setStatus('error');
    }, [emote.name, type]);

    useEffect(() => {
        if (status === 'loaded' && !animationFramesLoaded.current) {
            animationFramesLoaded.current = true;
            const framePromises = Array.from({ length: maxFrameCount - 1 }, (_, i) => `../emotes/${type}_${emote.name}_f${i + 2}.webp`)
                .map(src => new Promise(resolve => {
                    const img = new Image();
                    img.src = src;
                    img.onload = () => resolve(src);
                    img.onerror = () => resolve(null);
                }));

            Promise.all(framePromises).then(loadedFrames => {
                const successfulFrames = loadedFrames.filter(Boolean);
                if (successfulFrames.length > 0) {
                    setFrames(prev => [...prev, ...successfulFrames]);
                }
            });
        }
    }, [status, emote.name, type]);

    useEffect(() => {
        let interval;
        if (isHovering && frames.length > 1) {
            interval = setInterval(() => {
                setFrameIndex(prev => (prev + 1) % frames.length);
            }, 130);
        } else {
            setFrameIndex(0);
        }
        return () => clearInterval(interval);
    }, [isHovering, frames.length]);

    const handlePlay = (e) => { e.stopPropagation(); sendNuiMessage('playEmote', { name: emote.name, category: emote.category }); };
    const handleFavorite = (e) => { e.stopPropagation(); onToggleFavorite(emote.name); };
    const handleContextMenu = (e) => {
        e.preventDefault();
        if (emote.category === 'Walks' || emote.category === 'Expressions') return;
        onContextMenu(e, emote);
    };
    const handlePlayWithPositioning = (e) => {
        e.preventDefault();
        sendNuiMessage('playEmoteWithPositioning', { name: emote.name, category: emote.category });
    };

    const DefaultPlaceholder = () => (<i className="fa-solid fa-person-running" style={{fontSize: '48px', color: 'var(--text-secondary)', opacity: 0.5}}></i>);

    return (
        <div className="emote-card" onClick={handlePlay} onContextMenu={handleContextMenu}>
            <div className="emote-preview">
                {status === 'loaded' ? (
                    frames.map((src, i) => (
                        <img
                            key={src}
                            src={src}
                            alt={emote.label}
                            className="emote-frame"
                            style={{ opacity: isHovering ? (i === frameIndex ? 1 : 0) : (i === 0 ? 1 : 0) }}
                        />
                    ))
                ) : <DefaultPlaceholder />}
            </div>
            <div className="emote-info">
                <div className="name" title={emote.label}>{emote.label}</div>
                <div className="command">
                    {type === 'walk' ? `/walk ${emote.name}` : type === 'expression' ? `/expression ${emote.name}` : `/e ${emote.name}`}
                </div>
            </div>
            <div className="emote-actions">
                <button className="emote-action-btn" title={t('emoteCard.playTooltip')} onClick={handlePlay}><i className="fa-solid fa-play"></i></button>
                {(emote.category !== 'Walks' && emote.category !== 'Expressions' && emote.category !== 'Shared' && emote.canPosition) && (
                    <button className="emote-action-btn" title={t('emoteCard.positionTooltip')} onClick={handlePlayWithPositioning}><i className="fa-solid fa-arrows-up-down-left-right"></i></button>
                )}
                <button className={`emote-action-btn favorite ${isFavorite ? 'active' : ''}`} title={t('emoteCard.favoriteTooltip')} onClick={handleFavorite}><i className="fa-solid fa-heart"></i></button>
            </div>
        </div>
    );
});

export default EmoteCard;