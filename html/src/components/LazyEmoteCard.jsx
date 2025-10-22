import React, { useState, useEffect, useRef } from 'react';
import EmoteCard from './EmoteCard';

const LazyEmoteCard = ({ emote, isFavorite, onToggleFavorite, onContextMenu }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const placeholderRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.unobserve(entry.target);
            }
        }, { 
            root: document.querySelector('.emotes-flex-container'), 
            rootMargin: '300px' 
        });
        
        const currentRef = placeholderRef.current;
        if (currentRef) {
            observer.observe(currentRef);
        }
        
        return () => { 
            if (currentRef) {
                observer.unobserve(currentRef);
            }
        };
    }, []);

    return (
        <div ref={placeholderRef} className="emote-card-placeholder" onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>
            {isVisible && <EmoteCard emote={emote} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} isHovering={isHovering} onContextMenu={onContextMenu} />}
        </div>
    );
};

export default LazyEmoteCard;