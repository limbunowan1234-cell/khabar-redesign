'use client';

import { useState } from 'react';

export default function HeaderSimple({ onSearch, onCategoryChange, isDarkMode, onToggleDarkMode }: any) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div style={{ backgroundColor: '#0F4C5C', color: 'white', padding: '20px' }}>
      <h1 style={{ margin: '10px 0' }}>🗞️ KhabarDarjeeling - TEST</h1>
      <input 
        placeholder="Search..." 
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          onSearch?.(e.target.value);
        }}
        style={{ padding: '10px', width: '300px', borderRadius: '5px', border: 'none', fontSize: '14px' }} 
      />
      <button 
        onClick={onToggleDarkMode} 
        style={{ padding: '10px 20px', marginLeft: '10px', backgroundColor: '#D4AF37', color: '#0F4C5C', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
        {isDarkMode ? '☀️ Light' : '🌙 Dark'}
      </button>
      <button style={{ padding: '10px 20px', marginLeft: '10px', backgroundColor: '#D4AF37', color: '#0F4C5C', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
        🔑 Login
      </button>
    </div>
  );
}