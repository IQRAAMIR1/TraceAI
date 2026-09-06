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
    <div className="page">
      <header className="hero-dark" style={{ paddingBottom: '2rem' }}>
        <PakistanMotif />
        <div className="container">
          <Navbar />
          <h1 style={{ fontSize: '2rem', margin: '1.5rem 0 0.3rem' }}>Browse Missing Persons</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)' }}>Recognize someone? Every look matters.</p>
        </div>
      </header>

      <div className="section-light" style={{ paddingTop: '1.75rem' }}>
        <div className="container-narrow">
          <div className="search-input-wrap">
            <Search size={18} />
            <input
              className="input"
              placeholder="Search by name, case ID, or last-seen city"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div className="filters-bar">
            <select className="input" value={gender} onChange={(e) => { setGender(e.target.value); setPage(1); }}>
              <option value="">Any gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            <select className="input" value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }}>
              <option value="">Any city</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="btn btn-outline-dark btn-sm" onClick={() => { setSearch(''); setGender(''); setCity(''); setPage(1); }}>
              Clear filters
            </button>
          </div>

          <div className="banner" style={{ marginBottom: '1.25rem' }}>
            <ShieldCheck size={18} />
            <span>Photos are shared only to help reunite families. Please do not share, download, or repost images from this page.</span>
          </div>

          {loading && <div className="center-state">Loading cases...</div>}
          {errorMsg && <p className="error-text">{errorMsg}</p>}
          {!loading && !errorMsg && filtered.length === 0 && (
            <div className="center-state">No matching cases found.</div>
          )}

          {pageItems.map((c) => (
            <div className="browse-card" key={c.id}>
              <Link
                to={`/case/${c.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
              >
                <img
                  className="browse-photo"
                  src={personPhotoUrl(c.photo_path) || undefined}
                  alt={c.full_name}
                  onError={(e) => { e.target.style.visibility = 'hidden'; }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, margin: '0 0 0.15rem' }}>{c.full_name}</p>
                  <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                    {c.age ? `${c.age} years` : ''} {c.gender ? `· ${capitalize(c.gender)}` : ''}
                  </p>
                  <p className="muted" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem', margin: '0.2rem 0' }}>
                    <MapPin size={14} /> {c.last_seen_location || 'Location unknown'}
                  </p>
                  <p className="muted" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem', margin: 0 }}>
                    <FileText size={13} /> {c.case_number}
                  </p>
                </div>
              </Link>
              <Link to={`/sighting/${c.id}`} className="btn btn-primary btn-sm">
                Report a Sighting <ChevronRight size={14} />
              </Link>
            </div>
          ))}

          {totalPages > 1 && (
            <div className="pagination">
              <button className="page-num" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button key={n} className={`page-num ${n === page ? 'active' : ''}`} onClick={() => setPage(n)}>{n}</button>
              ))}
              <button className="page-num" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
