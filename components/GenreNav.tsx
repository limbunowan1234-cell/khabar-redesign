'use client';
import { useState, useRef, useEffect } from 'react';

const NAV_GENRES = ['All', 'Voice of People', 'Politics', 'Culture', 'Tourism', 'Poetry', 'Editorial'];
const MORE_GENRES = ['Health', 'Education', 'Technology', 'Sports'];
const DISTRICTS = ['All Regions', 'Darjeeling', 'Kalimpong', 'Kurseong', 'Mirik', 'Siliguri', 'West Bengal', 'Sikkim'];

export default function GenreNav({ selectedGenre, onSelectGenre, selectedDistrict, onSelectDistrict, isDarkMode }: {
  selectedGenre: string;
  onSelectGenre: (g: string) => void;
  selectedDistrict: string;
  onSelectDistrict: (d: string) => void;
  isDarkMode?: boolean;
}) {
  const [showRegions, setShowRegions] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const regionsRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (regionsRef.current && !regionsRef.current.contains(e.target as Node)) setShowRegions(false);
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const bg = isDarkMode ? '#161616' : '#ffffff';
  const border = isDarkMode ? '#2a2a2a' : '#e8e8e8';
  const textColor = isDarkMode ? '#ddd' : '#2a2a2a';
  const regionActive = selectedDistrict !== 'All Regions';
  const moreActive = MORE_GENRES.includes(selectedGenre);

  const dropdownStyle: any = {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    minWidth: '180px',
    backgroundColor: isDarkMode ? '#1e1e1e' : '#fff',
    borderRadius: '10px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
    border: '1px solid ' + border,
    overflow: 'hidden',
    padding: '6px 0',
    zIndex: 95
  };

  return (
    <nav style={{ backgroundColor: bg, borderBottom: '1px solid ' + border, position: 'relative', zIndex: 90 }}>
      <style>{`
        .genre-nav-scroll { display: flex; align-items: center; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; }
        .genre-nav-scroll::-webkit-scrollbar { display: none; }
        .genre-link { position: relative; padding: 14px 14px; font-size: 13px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; white-space: nowrap; cursor: pointer; background: none; border: none; transition: color 0.15s; font-family: inherit; }
        .genre-link:hover { color: #c41e3a !important; }
        .genre-link.active { color: #c41e3a !important; }
        .genre-link.active::after { content: ''; position: absolute; bottom: 0; left: 14px; right: 14px; height: 3px; background: #c41e3a; border-radius: 2px 2px 0 0; }
        .region-item { display: block; width: 100%; text-align: left; padding: 10px 16px; font-size: 13px; font-weight: 600; background: none; border: none; cursor: pointer; font-family: inherit; transition: background 0.12s; }
      `}</style>
      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', padding: '0 12px' }}>
        <div className="genre-nav-scroll" style={{ flex: '0 1 auto', minWidth: 0 }}>
          {NAV_GENRES.map((g) => (
            <button
              key={g}
              className={'genre-link' + (selectedGenre === g ? ' active' : '')}
              onClick={() => onSelectGenre(g)}
              style={{ color: selectedGenre === g ? '#c41e3a' : textColor }}
            >
              {g === 'All' ? 'Home' : g}
            </button>
          ))}

        </div>
          <div ref={moreRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setShowMore(!showMore)}
              className={'genre-link' + (moreActive ? ' active' : '')}
              style={{ color: moreActive ? '#c41e3a' : textColor, display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              {moreActive ? selectedGenre : 'More'}
              <span style={{ fontSize: '9px', transform: showMore ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>&#9660;</span>
            </button>
            {showMore && (
              <div style={{ ...dropdownStyle, right: 'auto', left: 0 }}>
                {MORE_GENRES.map((g) => (
                  <button
                    key={g}
                    className="region-item"
                    onClick={() => { onSelectGenre(g); setShowMore(false); }}
                    style={{
                      color: selectedGenre === g ? '#c41e3a' : (isDarkMode ? '#ddd' : '#333'),
                      backgroundColor: selectedGenre === g ? (isDarkMode ? '#2a1518' : '#fdf0f2') : 'transparent',
                      fontWeight: selectedGenre === g ? 800 : 600
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
          </div>

        <div ref={regionsRef} style={{ position: 'relative', flexShrink: 0, marginLeft: 'auto' }}>
          <button
            onClick={() => setShowRegions(!showRegions)}
            className="genre-link"
            style={{
              color: regionActive ? '#fff' : textColor,
              backgroundColor: regionActive ? '#c41e3a' : 'transparent',
              borderRadius: '6px',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: regionActive ? 'none' : '1px solid ' + border
            }}
          >
            {regionActive ? selectedDistrict : 'Regions'}
            <span style={{ fontSize: '9px', transform: showRegions ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>&#9660;</span>
          </button>

          {showRegions && (
            <div style={dropdownStyle}>
              {DISTRICTS.map((d) => (
                <button
                  key={d}
                  className="region-item"
                  onClick={() => { onSelectDistrict(d); setShowRegions(false); }}
                  style={{
                    color: selectedDistrict === d ? '#c41e3a' : (isDarkMode ? '#ddd' : '#333'),
                    backgroundColor: selectedDistrict === d ? (isDarkMode ? '#2a1518' : '#fdf0f2') : 'transparent',
                    fontWeight: selectedDistrict === d ? 800 : 600
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
