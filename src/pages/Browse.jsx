import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShieldCheck, MapPin, FileText, ChevronRight } from 'lucide-react';
import Navbar from '../components/Navbar';
import PakistanMotif from '../components/PakistanMotif';
import { supabase, personPhotoUrl } from '../lib/supabaseClient';

const PAGE_SIZE = 5;

export default function Browse() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('missing_persons')
        .select('*')
        .eq('status', 'missing')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`Failed to load missing persons for Browse page: ${error.message}`);
        setErrorMsg('Could not load cases right now. Please try again shortly.');
      } else {
        setCases(data ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  const cities = useMemo(() => {
    const set = new Set(cases.map((c) => c.last_seen_location).filter(Boolean));
    return Array.from(set);
  }, [cases]);

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (search && !c.full_name?.toLowerCase().includes(search.toLowerCase()) && !c.case_number?.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (gender && c.gender !== gender) return false;
      if (city && c.last_seen_location !== city) return false;
      return true;
    });
  }, [cases, search, gender, city]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="page bp-page">
      <header className="hero-dark" style={{ paddingBottom: '2rem' }}>
       
        <div className="container">
          <Navbar />
          <h1 className="bp-hero-title">Browse Missing Persons</h1>
          <p className="bp-hero-sub">Recognize someone? Every look matters.</p>
        </div>
      </header>

      <div className="section-light" style={{ paddingTop: '1.75rem' }}>
        <div className="container-narrow bp-container">
          <div className="bp-search-wrap">
            <Search size={17} className="bp-search-icon" />
            <input
              className="bp-input bp-search-input"
              placeholder="Search by name, case ID, or last-seen city"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div className="bp-filters-bar">
            <select className="bp-input bp-select" value={gender} onChange={(e) => { setGender(e.target.value); setPage(1); }}>
              <option value="">Any gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            <select className="bp-input bp-select" value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }}>
              <option value="">Any city</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="bp-clear-btn" onClick={() => { setSearch(''); setGender(''); setCity(''); setPage(1); }}>
              <span className="bp-clear-full">Clear filters</span>
              <span className="bp-clear-short">Clear</span>
            </button>
          </div>

          <div className="bp-banner">
            <ShieldCheck size={17} className="bp-banner-icon" />
            <span>Photos are shared only to help reunite families. Please do not share, download, or repost images from this page.</span>
          </div>

          {loading && <div className="bp-center-state">Loading cases...</div>}
          {errorMsg && <p className="bp-error-text">{errorMsg}</p>}
          {!loading && !errorMsg && filtered.length === 0 && (
            <div className="bp-center-state">No matching cases found.</div>
          )}

          {pageItems.map((c) => (
            <div className="bp-card" key={c.id}>
              <Link to={`/case/${c.id}`} className="bp-card-link">
                <img
                  className="bp-photo"
                  src={personPhotoUrl(c.photo_path) || undefined}
                  alt={c.full_name}
                  onError={(e) => { e.target.style.visibility = 'hidden'; }}
                />
                <div className="bp-card-info">
                  <p className="bp-name">{c.full_name}</p>
                  <p className="bp-meta">
                    {c.age ? `${c.age} years` : ''} {c.gender ? `· ${capitalize(c.gender)}` : ''}
                  </p>
                  <p className="bp-meta bp-meta-row">
                    <MapPin size={13} /> {c.last_seen_location || 'Location unknown'}
                  </p>
                  <p className="bp-meta bp-meta-row">
                    <FileText size={12} /> {c.case_number}
                  </p>
                </div>
              </Link>
              <Link to={`/sighting/${c.id}`} className="bp-sighting-btn">
                Report a Sighting <ChevronRight size={14} />
              </Link>
            </div>
          ))}

          {totalPages > 1 && (
            <div className="bp-pagination">
              <button className="bp-page-num" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button key={n} className={`bp-page-num ${n === page ? 'active' : ''}`} onClick={() => setPage(n)}>{n}</button>
              ))}
              <button className="bp-page-num" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .bp-hero-title {
          font-size: 1.7rem;
          margin: 1.5rem 0 0.3rem;
          font-weight: 800;
        }

        .bp-hero-sub {
          color: rgba(255,255,255,0.7);
          font-size: 0.95rem;
          margin: 0;
        }

        .bp-container {
          padding-left: 1rem;
          padding-right: 1rem;
        }

        .bp-search-wrap {
          position: relative;
          margin-bottom: 1rem;
        }

        .bp-search-icon {
          position: absolute;
          left: 0.9rem;
          top: 50%;
          transform: translateY(-50%);
          color: #798073;
          pointer-events: none;
        }

        .bp-input {
          width: 100%;
          box-sizing: border-box;
          padding: 0.75rem 0.95rem;
          font-size: 0.9rem;
          font-family: inherit;
          font-weight: 500;
          color: #16211a;
          background: #ffffff;
          border: 1.5px solid #b9c0b3;
          border-radius: 9px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .bp-input:focus {
          outline: none;
          border-color: #22c55e;
          box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
        }

        .bp-search-input {
          padding-left: 2.5rem;
        }

        .bp-filters-bar {
          display: flex;
          flex-wrap: nowrap;
          gap: 0.6rem;
          margin-bottom: 1.1rem;
        }

        .bp-select {
          flex: 1 1 0;
          min-width: 0;
        }

        .bp-clear-btn {
          flex: 0 0 auto;
          padding: 0.7rem 1rem;
          font-size: 0.85rem;
          font-weight: 600;
          color: #3a453c;
          background: #ffffff;
          border: 1.5px solid #b9c0b3;
          border-radius: 9px;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }

        .bp-clear-btn:hover {
          background: #f6f7f5;
          border-color: #8f9989;
        }

        .bp-clear-short {
          display: none;
        }

        .bp-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #eafaf0;
          border: 1px solid #bfe8ce;
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          font-size: 0.76rem;
          color: #205a37;
          margin-bottom: 1.1rem;
          line-height: 1.3;
        }

        .bp-banner-icon {
          color: #22c55e;
          flex-shrink: 0;
          margin-top: 0.1rem;
        }

        .bp-center-state {
          text-align: center;
          padding: 2rem 1rem;
          color: #798073;
          font-size: 0.9rem;
        }

        .bp-error-text {
          text-align: center;
          color: #a3352a;
          font-size: 0.85rem;
          padding: 1rem;
        }

        .bp-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          background: #ffffff;
          border: 1.5px solid #d7dbd2;
          border-radius: 14px;
          box-shadow: 0 4px 14px rgba(15, 36, 25, 0.06);
          padding: 1rem 1.1rem;
          margin-bottom: 1rem;
        }

        .bp-card-link {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          flex: 1;
          min-width: 0;
          text-decoration: none;
          color: inherit;
        }

        .bp-photo {
          width: 58px;
          height: 58px;
          border-radius: 10px;
          object-fit: cover;
          flex-shrink: 0;
          background: #eef0ec;
        }

        .bp-card-info {
          flex: 1;
          min-width: 0;
        }

        .bp-name {
          font-weight: 700;
          font-size: 0.95rem;
          margin: 0 0 0.15rem;
          color: #16241c;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bp-meta {
          font-size: 0.8rem;
          color: #5f6a5a;
          margin: 0.15rem 0 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bp-meta-row {
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }

        .bp-sighting-btn {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.6rem 0.95rem;
          font-size: 0.82rem;
          font-weight: 600;
          color: #ffffff;
          background: #156030;
          border-radius: 8px;
          text-decoration: none;
          white-space: nowrap;
          transition: background 0.15s ease;
        }

        .bp-sighting-btn:hover {
          background: #3e7552;
        }

        .bp-pagination {
          display: flex;
          justify-content: center;
          gap: 0.4rem;
          margin-top: 1.5rem;
          flex-wrap: wrap;
        }

        .bp-page-num {
          min-width: 34px;
          height: 34px;
          padding: 0 0.4rem;
          font-size: 0.85rem;
          font-weight: 600;
          color: #1a251c;
          background: #ffffff;
          border: 1.5px solid #d7dbd2;
          border-radius: 8px;
          cursor: pointer;
        }

        .bp-page-num.active {
          background: #156030;
          border-color: #156030;
          color: #ffffff;
        }

        .bp-page-num:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* --- Mobile responsive layout --- */
        @media (max-width: 640px) {
          .bp-hero-title {
            font-size: 1.35rem;
          }

          .bp-hero-sub {
            font-size: 0.85rem;
          }

          .bp-container {
            padding-left: 0.85rem;
            padding-right: 0.85rem;
          }

          .bp-filters-bar {
            flex-wrap: nowrap;
            gap: 0.4rem;
          }

          .bp-select {
            flex: 1 1 0;
            font-size: 0.78rem;
            padding: 0.65rem 0.5rem;
            padding-right: 1.6rem;
            background-position: right 0.5rem center;
          }

          .bp-clear-btn {
            flex: 0 0 auto;
            padding: 0.65rem 0.7rem;
            font-size: 0.78rem;
          }

          .bp-clear-full {
            display: none;
          }

          .bp-clear-short {
            display: inline;
          }

          .bp-banner {
            font-size: 0.7rem;
            padding: 0.45rem 0.65rem;
            gap: 0.4rem;
          }

          .bp-card {
            flex-direction: column;
            align-items: stretch;
            gap: 0.85rem;
            padding: 0.9rem;
          }

          .bp-card-link {
            gap: 0.75rem;
          }

          .bp-photo {
            width: 50px;
            height: 50px;
          }

          .bp-name {
            font-size: 0.9rem;
          }

          .bp-meta {
            font-size: 0.75rem;
          }

          .bp-sighting-btn {
            width: 100%;
            justify-content: center;
            padding: 0.65rem 0.9rem;
          }
        }
      `}</style>
    </div>
  );
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}