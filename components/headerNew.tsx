'use client';

export default function Header({ onSearch, onCategoryChange, isDarkMode, onToggleDarkMode }: any) {
  return (
    <div style={{ backgroundColor: '#0F4C5C', padding: '20px', color: 'white' }}>
      <h1>🗞️ KhabarDarjeeling</h1>
      <input placeholder="Search..." style={{ padding: '10px', width: '300px', borderRadius: '5px', border: 'none' }} onChange={(e) => onSearch?.(e.target.value)} />
      <button onClick={onToggleDarkMode} style={{ padding: '10px 20px', margin: '10px', backgroundColor: '#D4AF37', color: '#0F4C5C', border: 'none' }}>Dark Mode</button>
      <button style={{ padding: '10px 20px', margin: '10px', backgroundColor: '#D4AF37', color: '#0F4C5C', border: 'none' }}>Login</button>
    </div>
  );
}