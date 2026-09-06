import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Eye, Bell, ChevronRight, Search } from 'lucide-react';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import PakistanMotif from '../components/PakistanMotif';
import { supabase, personPhotoUrl } from '../lib/supabaseClient';
import { formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const [cases, setCases] = useState([]);
  const [bestScores, setBestScores] = useState({}); // person_id -> { score, confidence_label }
  const [sightingsToday, setSightingsToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: allCases, error: casesError } = await supabase
        .from('missing_persons')
        .select('*')
        .order('created_at', { ascending: false });

      if (casesError) {
        console.error(`Dashboard failed to load missing_persons: ${casesError.message}`);
      }

      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('person_id, score, confidence_label')
        .order('score', { ascending: false });

      if (matchesError) {
        console.error(`Dashboard failed to load matches: ${matchesError.message}`);
      }

      const best = {};
      (matches ?? []).forEach((m) => {
        if (!best[m.person_id] || m.score > best[m.person_id].score) {
          best[m.person_id] = { score: m.score, confidence_label: m.confidence_label };
        }
      });

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const { count, error: sightingsError } = await supabase
        .from('sightings')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfToday.toISOString());

      if (sightingsError) {
        console.error(`Dashboard failed to count today's sightings: ${sightingsError.message}`);
      }

      setCases(allCases ?? []);
      setBestScores(best);
      setSightingsToday(count ?? 0);
      setLoading(false);
    }
    load();
  }, []);

  const activeCases = useMemo(() => cases.filter((c) => c.status === 'missing'), [cases]);
  const highPriorityCount = useMemo(
    () => activeCases.filter((c) => bestScores[c.id]?.confidence_label === 'strong').length,
    [activeCases, bestScores]
  );

  const sortedCases = useMemo(() => {
    const list = [...cases];
    list.sort((a, b) => {
      const scoreA = a.status === 'missing' ? bestScores[a.id]?.score ?? -1 : -2;
      const scoreB = b.status === 'missing' ? bestScores[b.id]?.score ?? -1 : -2;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    if (!search) return list.slice(0, 6);
    const q = search.toLowerCase();
    return list.filter(
      (c) => c.full_name?.toLowerCase().includes(q) || c.last_seen_location?.toLowerCase().includes(q)
    );
  }, [cases, bestScores, search]);

  return (
    <div className="page dash-shell">
      <header className="hero-dark" style={{ paddingBottom: '3.5rem' }}>
        <PakistanMotif />
        <div className="container">
          <Navbar />
        </div>
      </header>

      <div className="container">
        <div className="stat-grid">
          <StatCard icon={<Calendar size={20} />} label="Total Active Cases" value={activeCases.length} linkTo="/dashboard" linkLabel="View all cases" />
          <StatCard icon={<Eye size={20} />} label="New Sightings Today" value={sightingsToday} linkTo="/map" linkLabel="View sightings" />
          <StatCard icon={<Bell size={20} />} label="High Priority Alerts" value={highPriorityCount} linkTo="/dashboard" linkLabel="View alerts" />
        </div>

        <div className="search-input-wrap" style={{ marginTop: '2rem' }}>
          <Search size={18} />
          <input
            className="input"
            placeholder="Search cases by name or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '1.5rem 0 0.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Recent Cases</h2>
          <Link to="/browse" style={{ color: 'var(--color-accent)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            View All <ChevronRight size={14} />
          </Link>
        </div>

        {loading && <div className="center-state">Loading cases...</div>}

        <div className="card" style={{ padding: '0.5rem 1.25rem', marginBottom: '2rem' }}>
          {sortedCases.map((c) => (
            <Link to={`/case/${c.id}`} key={c.id} className="case-row">
              <img
                className="case-photo"
                src={personPhotoUrl(c.photo_path) || undefined}
                alt={c.full_name}
                onError={(e) => { e.target.style.visibility = 'hidden'; }}
              />
              <div className="case-info">
                <p className="case-name">{c.full_name}</p>
                <p className="case-meta">
                  {c.age ? `Age ${c.age}` : ''} {c.gender ? `· ${capitalize(c.gender)}` : ''}
                </p>
                <p className="case-meta">{c.last_seen_location}</p>
                <p className="case-meta">
                  Reported {c.created_at ? formatDistanceToNow(new Date(c.created_at), { addSuffix: true }) : ''}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`pill pill-${statusPillClass(c.status)}`}>{capitalize(c.status)}</span>
                {bestScores[c.id] && (
                  <p className={`muted`} style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>
                    {capitalize(bestScores[c.id].confidence_label)} match
                  </p>
                )}
              </div>
              <ChevronRight size={18} color="var(--color-muted)" />
            </Link>
          ))}
          {!loading && sortedCases.length === 0 && <div className="center-state">No cases found.</div>}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

function StatCard({ icon, label, value, linkTo, linkLabel }) {
  return (
    <div className="stat-card">
      <span className="icon-badge" style={{ margin: '0 auto' }}>{icon}</span>
      <p className="stat-value">{value}</p>
      <p className="stat-label">{label}</p>
      <Link to={linkTo} className="stat-link">{linkLabel} <ChevronRight size={14} /></Link>
    </div>
  );
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function statusPillClass(status) {
  if (status === 'missing') return 'active';
  if (status === 'found') return 'found';
  return 'closed';
}
