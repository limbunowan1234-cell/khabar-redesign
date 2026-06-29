'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/authStore';

interface HeaderProps {
  onSearch?: (query: string) => void;
  onCategoryChange?: (category: string) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

const categories = [
  'All',
  'Darjeeling',
  'Kalimpong',
  'Kurseong',
  'Mirik',
  'Politics',
  'Sports',
  'Business',
];

export default function Header({
  onSearch,
  onCategoryChange,
  isDarkMode,
  onToggleDarkMode,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const { user, logOut } = useAuthStore();
  


  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  const handleCategoryClick = (category: string) => {
    onCategoryChange?.(category);
  };

  const handleLogout = async () => {
    if (logOut) await logOut();
    setShowDropdown(false);
  };

  return (
    <header
      style={{
        backgroundColor: isDarkMode ? '#1a1a1a' : '#0F4C5C',
        color: 'white',
        padding: '20px',
        borderBottom: '3px solid #D4AF37',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Top Row: Logo + Search + Auth + Dark Mode */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '1200px',
          margin: '0 auto',
          marginBottom: '20px',
          gap: '20px',
          flexWrap: 'wrap',
        }}
      >
        {/* Logo */}
        <Link href="/">
          <h1
            style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: '700',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            ðŸ—žï¸ KhabarDarjeeling
          </h1>
        </Link>

        {/* Search Bar */}
        <input
          type="text"
          placeholder="Search articles..."
          value={searchQuery}
          onChange={handleSearch}
          style={{
            flex: 1,
            minWidth: '200px',
            padding: '10px 15px',
            borderRadius: '20px',
            border: 'none',
            fontSize: '14px',
            backgroundColor: isDarkMode ? '#333' : '#fff',
            color: isDarkMode ? '#fff' : '#000',
          }}
        />

        {/* Auth + Dark Mode */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            style={{
              backgroundColor: '#D4AF37',
              color: '#0F4C5C',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              whiteSpace: 'nowrap',
            }}
          >
            {isDarkMode ? 'â˜€ï¸ Light' : 'ðŸŒ™ Dark'}
          </button>

          {/* Auth Buttons */}
          {user ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                style={{
                  backgroundColor: '#D4AF37',
                  color: '#0F4C5C',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                }}
              >
                ðŸ‘¤ {user.name || user.email.split('@')[0]}
              </button>

              {/* Dropdown Menu */}
              {showDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    minWidth: '180px',
                    zIndex: 1000,
                    marginTop: '8px',
                  }}
                >
                  <Link href="/profile">
                    <button
                      onClick={() => setShowDropdown(false)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: isDarkMode ? '#fff' : '#000',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#f0f0f0'}`,
                      }}
                    >
                      ðŸ“‹ My Profile
                    </button>
                  </Link>
                  <Link href="/bookmarks">
                    <button
                      onClick={() => setShowDropdown(false)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: isDarkMode ? '#fff' : '#000',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#f0f0f0'}`,
                      }}
                    >
                      ðŸ”– Bookmarks
                    </button>
                  </Link>
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: '#c41e3a',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                    }}
                  >
                    ðŸšª Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/auth">
              <button
                style={{
                  backgroundColor: '#D4AF37',
                  color: '#0F4C5C',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                }}
              >
                ðŸ”‘ Login
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* Bottom Row: Categories */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          maxWidth: '1200px',
          margin: '0 auto',
          paddingBottom: '10px',
        }}
      >
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => handleCategoryClick(category)}
            style={{
              backgroundColor: 'transparent',
              color: 'white',
              border: '1px solid #D4AF37',
              padding: '8px 16px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              whiteSpace: 'nowrap',
              transition: 'all 0.3s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#D4AF37';
              e.currentTarget.style.color = '#0F4C5C';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'white';
            }}
          >
            {category}
          </button>
        ))}
      </div>
    </header>
  );
}