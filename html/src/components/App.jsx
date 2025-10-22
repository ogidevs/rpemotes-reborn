import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import { useTranslation } from 'react-i18next';

import '../i18n';

import { useLocalStorage } from '../hooks/useLocalStorage';
import { useNuiEvent, sendNuiMessage } from '../hooks/useNuiEvent';
import { useDraggable } from '../hooks/useDraggable';
import { useDebounce } from '../hooks/useDebounce';

// Components
import ContextMenu from './ContextMenu';
import LazyEmoteCard from './LazyEmoteCard';
import Gizmo from './Gizmo';

// Data
import { categoryIcons, categoryOrder } from '../data/staticData';

const GAP_SIZE = 25;

const EmoteCell = ({ columnIndex, rowIndex, style, data }) => {
    const { emotes, favorites, handleToggleFavorite, handleContextMenu, columnCount } = data;
    const index = rowIndex * columnCount + columnIndex;
    if (index >= emotes.length) return null;
    const emote = emotes[index];

    const cellStyle = {
        ...style,
        padding: `${GAP_SIZE / 2}px`,
    };
    return (
        <div style={cellStyle}>
            <LazyEmoteCard
                key={emote.name}
                emote={emote}
                isFavorite={favorites.includes(emote.name)}
                onToggleFavorite={handleToggleFavorite}
                onContextMenu={handleContextMenu}
            />
        </div>
    );
};


const App = () => {
    const { t, i18n } = useTranslation();
    const [visible, setVisible] = useState(false);
    const [isCompact, setIsCompact] = useLocalStorage('rpemotes_compact_state', false);
    const [allEmotes, setAllEmotes] = useState([]);
    const [categories, setCategories] = useState({});
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [favorites, setFavorites] = useLocalStorage('rpemotes_favorites', []);
    const { position, handleRef, onMouseDown, setPosition } = useDraggable('rpemotes_compact_position');
    
    const [scrollPositions, setScrollPositions] = useLocalStorage('rpemotes_scroll_positions', {});

    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, emote: null });
    const [keybinds, setKeybinds] = useState([]);
    const [welcomeMessage, setWelcomeMessage] = useState("");

    const debouncedSearchTerm = useDebounce(searchTerm, 250);

    const gridContainerRef = useRef(null);
    const [gridSize, setGridSize] = useState({ width: 0, height: 0, columnCount: 6, cardWidth: 160 });

    useNuiEvent('setVisible', ({ status, locale }) => {
        setVisible(status);
        if (locale) {
            i18n.changeLanguage(locale);
        }
    });

    useNuiEvent('loadEmotes', ({ all, categories }) => {
        setAllEmotes(all || []);
        setCategories(categories || {});
    });

    const handleResetSettings = useCallback(() => {
        setIsCompact(false);
        setFavorites([]);
        setPosition({ x: 0, y: 0 });
        sendNuiMessage('resetSettings');
        setScrollPositions({});
    }, [setIsCompact, setFavorites, setPosition, setScrollPositions]);

    useNuiEvent('resetSettings', handleResetSettings);

    const handleClose = useCallback(() => {
      setVisible(false);
      sendNuiMessage('close');
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape') handleClose(); };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown',handleKeyDown);
    }, [handleClose]);

    useEffect(() => {
        if (!gridContainerRef.current) return;
        const resizeObserver = new ResizeObserver(entries => {
            const entry = entries[0];
            const { width, height } = entry.contentRect;
            const minCardWidth = isCompact ? 120 : 160; 
            const gap = 25;
            const newColumnCount = Math.max(1, Math.floor((width - gap) / (minCardWidth + gap)));
            const newCardWidth = (width - (newColumnCount + 1) * gap) / newColumnCount;

            setGridSize({ width, height, columnCount: newColumnCount, cardWidth: newCardWidth });
        });
        resizeObserver.observe(gridContainerRef.current);
        return () => resizeObserver.disconnect();
    }, [isCompact, visible]);


    const handleToggleFavorite = useCallback((emoteName) => {
        setFavorites(prev => prev.includes(emoteName) ? prev.filter(name => name !== emoteName) : [...prev, emoteName]);
    }, [setFavorites]);

    const handleContextMenu = useCallback((event, emote) => {
        sendNuiMessage('getKeybinds').then(fetchedKeybinds => {
            setKeybinds(fetchedKeybinds || []);
            setContextMenu({ visible: true, x: event.clientX, y: event.clientY, emote });
        });
    }, []);

    const scrollTimeoutRef = useRef(null);
    const handleScroll = useCallback(({ scrollTop }) => {
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
            setScrollPositions(prev => ({ ...prev, [selectedCategory]: scrollTop }));
        }, 150);
    }, [selectedCategory, setScrollPositions]);

    useEffect(() => () => { if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current) }, []);

    const closeContextMenu = useCallback(() => setContextMenu(prev => ({ ...prev, visible: false })), []);

    useEffect(() => {
        if (visible) {
            const messages = t('sidebar.welcomeMessages', { returnObjects: true });
            if (Array.isArray(messages)) {
                setWelcomeMessage(messages[Math.floor(Math.random() * messages.length)]);
            }
        }
    }, [visible, t]);

    const favoriteEmotes = useMemo(() => allEmotes.filter(e => favorites.includes(e.name)), [allEmotes, favorites]);
    const filteredEmotes = useMemo(() => {
        let source;
        if (selectedCategory === 'Favorites') source = favoriteEmotes;
        else if (selectedCategory === 'All') source = allEmotes;
        else source = categories[selectedCategory] || [];

        if (!debouncedSearchTerm) return source;
        const lowerSearch = debouncedSearchTerm.toLowerCase();
        return source.filter(e => e.label.toLowerCase().includes(lowerSearch) || e.name.toLowerCase().includes(lowerSearch));
    }, [allEmotes, categories, selectedCategory, debouncedSearchTerm, favoriteEmotes]);

    const sortedCategoryKeys = useMemo(() => Object.keys(categories).sort((a,b) => {
        const iA=categoryOrder.indexOf(a), iB=categoryOrder.indexOf(b);
        if (iA !== -1 && iB !== -1) return iA - iB;
        if (iA !== -1) return -1;
        if (iB !== -1) return 1;
        return a.localeCompare(b);
    }), [categories]);

    const itemData = useMemo(() => ({
        emotes: filteredEmotes,
        favorites,
        handleToggleFavorite,
        handleContextMenu,
        columnCount: gridSize.columnCount
    }), [filteredEmotes, favorites, handleToggleFavorite, handleContextMenu, gridSize.columnCount]);

    const containerClasses = `animation-menu-container ${visible ? 'visible' : ''} ${isCompact ? 'compact' : ''}`;
    const containerStyle = isCompact ? { transform: `translate(${position.x}px, ${position.y}px)` } : {};
    const rowHeight = (isCompact ? 160 : 200) + GAP_SIZE;

    const getCategoryName = (catKey) => t(`categories.${catKey}`, catKey);

    return (
        <>
            <div className={containerClasses} style={containerStyle} onMouseDown={isCompact ? onMouseDown : null}>
                {contextMenu.visible && (
                    <ContextMenu x={contextMenu.x} y={contextMenu.y} emote={contextMenu.emote} keybinds={keybinds} onClose={closeContextMenu} />
                )}
                {visible && (
                    <>
                        {!isCompact && (
                            <aside className="sidebar">
                                <header className="sidebar-header">
                                    <h1>{t('sidebar.title')}</h1>
                                    <p>{welcomeMessage}</p>
                                </header>
                                <ul className="category-list">
                                    <li className={`category-item ${selectedCategory === 'All' ? 'active' : ''}`} onClick={() => setSelectedCategory('All')}>
                                        <i className={`icon ${categoryIcons['All']}`}></i><span>{getCategoryName('All')}</span><span className="count">{allEmotes.length}</span>
                                    </li>
                                    {favoriteEmotes.length > 0 && (
                                        <li className={`category-item ${selectedCategory === 'Favorites' ? 'active' : ''}`} onClick={() => setSelectedCategory('Favorites')}>
                                            <i className={`icon ${categoryIcons['Favorites']}`}></i><span>{getCategoryName('Favorites')}</span><span className="count">{favoriteEmotes.length}</span>
                                        </li>
                                    )}
                                    {sortedCategoryKeys.map(cat => (
                                        categories[cat]?.length > 0 && (
                                            <li key={cat} className={`category-item ${selectedCategory === cat ? 'active' : ''}`} onClick={() => setSelectedCategory(cat)}>
                                                <i className={`icon ${categoryIcons[cat] || 'fa-solid fa-circle'}`}></i><span>{getCategoryName(cat)}</span><span className="count">{categories[cat].length}</span>
                                            </li>
                                        )
                                    ))}
                                </ul>
                            </aside>
                        )}

                        <main className="main-content">
                            <header ref={handleRef} className={`top-bar ${isCompact ? 'draggable' : ''}`}>
                                {!isCompact && (
                                    <div className="search-bar">
                                        <i className="search-icon fa-solid fa-magnifying-glass"></i>
                                        <input type="text" placeholder={t('topbar.searchPlaceholder', { category: getCategoryName(selectedCategory) })} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                        {searchTerm && <i className="clear-search fa-solid fa-xmark" onClick={() => setSearchTerm('')}></i>}
                                    </div>
                                )}
                                <div className="top-bar-controls">
                                    <button className="control-button" title={t(isCompact ? "topbar.expandTooltip" : "topbar.compactTooltip")} onClick={() => setIsCompact(!isCompact)}>
                                        <i className={`fa-solid ${isCompact ? 'fa-expand' : 'fa-compress'}`}></i>
                                    </button>
                                    <button className="exit-button" onClick={handleClose}><i className="fa-solid fa-right-from-bracket"></i> {t('topbar.exitButton')}</button>
                                </div>
                            </header>
                            {isCompact && (
                                <div className="compact-controls">
                                    <div className="search-bar">
                                        <i className="search-icon fa-solid fa-magnifying-glass"></i>
                                        <input type="text" placeholder={t('topbar.searchPlaceholderCompact')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                        {searchTerm && <i className="clear-search fa-solid fa-xmark" onClick={() => setSearchTerm('')}></i>}
                                    </div>
                                    <div className="category-dropdown">
                                        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                                            <option value="All">{getCategoryName('All')} ({allEmotes.length})</option>
                                            {favoriteEmotes.length > 0 && <option value="Favorites">{getCategoryName('Favorites')} ({favoriteEmotes.length})</option>}
                                            {sortedCategoryKeys.map(cat => (
                                                categories[cat]?.length > 0 && <option key={cat} value={cat}>{getCategoryName(cat)} ({categories[cat].length})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}
                            <div ref={gridContainerRef} className="emotes-flex-container">
                                {gridSize.width > 0 && (
                                    <Grid
                                        columnCount={gridSize.columnCount}
                                        columnWidth={gridSize.cardWidth + 25}
                                        height={gridSize.height}
                                        rowCount={Math.ceil(filteredEmotes.length / gridSize.columnCount)}
                                        rowHeight={rowHeight}
                                        width={gridSize.width}
                                        itemData={itemData}
                                        className="grid-scrollbar-override"
                                        overscanRowCount={8}
                                        onScroll={handleScroll}
                                        initialScrollTop={scrollPositions[selectedCategory] || 0}
                                    >
                                        {EmoteCell}
                                    </Grid>
                                )}
                            </div>
                        </main>
                    </>
                )}
            </div>
            <Gizmo />
        </>
    );
};

export default App;