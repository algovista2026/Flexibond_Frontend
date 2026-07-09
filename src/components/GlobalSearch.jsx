import React, { useState, useEffect, useRef } from 'react';
import { FiSearch, FiUser, FiPackage, FiBox, FiGrid, FiMapPin } from 'react-icons/fi';
import { getFilters } from '../services/api';

const GlobalSearch = ({ onSearchSelect }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState({
    salespersons: [],
    products: [],
    categories: [],
    thickness: [],
    dimensions: [],
    cities: []
  });
  const wrapperRef = useRef(null);

  useEffect(() => {
    const fetchSearchData = async () => {
      try {
        const res = await getFilters();
        if (res.data && res.data.data) {
          setData(res.data.data);
        }
      } catch (error) {
        console.error('Error fetching global search data:', error);
      }
    };
    fetchSearchData();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const results = [];

    // Search Salespersons
    (data.salespersons || []).forEach(name => {
      if (name.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'salesperson', label: name, icon: <FiUser color="var(--primary-500)" /> });
      }
    });

    // Search Products
    (data.products || []).forEach(prod => {
      if (prod.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'product', label: prod, icon: <FiPackage color="#3b82f6" /> });
      }
    });

    // Search Categories
    (data.categories || []).forEach(cat => {
      if (cat.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'category', label: cat, icon: <FiBox color="#f59e0b" /> });
      }
    });

    // Search Thickness ("Type" column, e.g. "3 MM"). Thickness values are numeric (3, 4, 6),
    // so match "3", "3mm" and "3 mm" (any case/spacing) — not just the bare number.
    const qNumeric = lowerQuery.replace(/\s+/g, '').replace(/mm$/, '');  // "3 mm"/"3mm"/"3" -> "3"
    (data.thickness || []).forEach(thick => {
      const t = String(thick).toLowerCase();            // "3"
      // Exact or prefix match on the number so "3" → 3 (and 3.x) but "30" ≠ 3.
      if (qNumeric !== '' && (t === qNumeric || t.startsWith(qNumeric))) {
        results.push({ type: 'thickness', label: `${thick} MM`, raw: thick, icon: <FiGrid color="#8b5cf6" /> });
      }
    });

    // Search Dimensions
    (data.dimensions || []).forEach(dim => {
      if (dim.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'dimensions', label: dim, icon: <FiGrid color="#ec4899" /> });
      }
    });

    // Search Cities
    (data.cities || []).forEach(city => {
      if (city.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'city', label: city, icon: <FiMapPin color="#ef4444" /> });
      }
    });

    setSuggestions(results.slice(0, 15)); // Cap at 15 items
    setIsOpen(true);
  }, [query, data]);

  const handleSelect = (item) => {
    setQuery(item.label);
    setIsOpen(false);

    // Build filter request payload
    const filterPayload = {
      salesperson: item.type === 'salesperson' ? item.label : '',
      product: item.type === 'product' ? item.label : '',
      category: item.type === 'category' ? item.label : '',
      // Send as an array to match the multi-select thickness model (nicer "Thickness: 3 MM"
      // chip + backend $in handling).
      thickness: item.type === 'thickness' ? [item.raw] : '',
      dimensions: item.type === 'dimensions' ? item.label : '',
      city: item.type === 'city' ? item.label : ''
    };

    onSearchSelect(filterPayload);
  };

  return (
    <div ref={wrapperRef} className="global-search-wrapper">
      <div style={{ position: 'relative' }}>
        <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Search salesperson, size, product..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setSuggestions(suggestions.length > 0) && setIsOpen(true)}
          style={{
            width: '100%',
            padding: '10px 16px 10px 38px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            outline: 'none',
            fontSize: '0.9rem',
            boxShadow: 'var(--shadow-sm)',
            transition: 'border-color 0.2s ease'
          }}
        />
      </div>

      {isOpen && suggestions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
          border: '1px solid var(--border-color)',
          zIndex: 9999,
          maxHeight: '300px',
          overflowY: 'auto',
          marginTop: '8px'
        }}>
          {suggestions.map((item, index) => (
            <div
              key={index}
              onClick={() => handleSelect(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 16px',
                cursor: 'pointer',
                borderBottom: index < suggestions.length - 1 ? '1px solid var(--border-color)' : 'none',
                transition: 'background 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-light)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {item.icon}
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>{item.label}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{item.type}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
