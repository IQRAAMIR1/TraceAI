import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { MapPin, Calendar, Phone, Mail, ArrowLeft, User, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { supabase, personPhotoUrl } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import 'leaflet/dist/leaflet.css';

// Status colors are defined here (not in a shared CSS class) so the badge is
// always correct regardless of what `.pill-*` happens to resolve to elsewhere.
// Missing = amber/warning (this person has not been found — it should read
// as unresolved, not "good"). Found = green. Closed = neutral grey.
const STATUS_STYLES = {
  missing: { bg: '#FCEFDD', color: '#9A5B10', dot: '#E08A2C', label: 'Missing' },
  found: { bg: '#E7F1E9', color: '#1F6B3B', dot: '#2E8B4F', label: 'Found' },
  closed: { bg: '#EEEEEC', color: '#5B655C', dot: '#8B948B', label: 'Closed' },
};

// Mobile-only font size overrides. Inline styles win on specificity, so this
// uses !important scoped to .container-narrow inside the media query — it
// only fires under 480px and never touches the desktop layout.
const MOBILE_FONT_STYLES = `
  @media (max-width: 480px) {
    .container-narrow h1 { font-size: 1.05rem !important; }
    .container-narrow h2 { font-size: 1.15rem !important; }
    .container-narrow h3 { font-size: 0.92rem !important; }
    .container-narrow p { font-size: 0.8rem !important; }
    .container-narrow .muted { font-size: 0.76rem !important; }
    .container-narrow .timeline-item p { font-size: 0.8rem !important; }
    .container-narrow .pill { font-size: 0.7rem !important; }
    .container-narrow .btn { font-size: 0.85rem !important; }
  }
`;

function StatusPill({ status }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.closed;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: s.bg,
        color: s.color,
        fontSize: '0.72rem',
        fontWeight: 600,
        padding: '4px 10px 4px 8px',
        borderRadius: 20,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {s.label}
    </span>
  );
}

export default function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightSightingId = searchParams.get('highlight');
  const { user, role } = useAuth();

  const [caseData, setCaseData] = useState(null);
  const [sightings, setSightings] = useState([]);
  const [matchesBySighting, setMatchesBySighting] = useState({});
  const [contactsBySighting, setContactsBySighting] = useState({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: person, error: personError } = await supabase
        .from('missing_persons')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (personError || !person) {
        console.error(`Failed to load case ${id}: ${personError?.message ?? 'not found'}`);
        setErrorMsg('This case could not be found.');
        setLoading(false);
        return;
      }
      setCaseData(person);

      const { data: matchRows, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .eq('person_id', id);

      if (matchesError) {
        console.error(`Failed to load matches for case ${id}: ${matchesError.message}`);
      }
      const bySighting = {};
      (matchRows ?? []).forEach((m) => { bySighting[m.sighting_id] = m; });
      setMatchesBySighting(bySighting);

      // A sighting belongs on this case's timeline either because it was
      // submitted directly against this case (person_id = id), or because
      // it was a general sighting that the AI matched to this case (its
      // person_id stays null — the link only exists in `matches`). Combine
      // both so AI-matched general sightings aren't silently dropped.
      const matchedSightingIds = (matchRows ?? []).map((m) => m.sighting_id).filter(Boolean);
      const orFilter = matchedSightingIds.length > 0
        ? `person_id.eq.${id},id.in.(${matchedSightingIds.join(',')})`
        : `person_id.eq.${id}`;

      const { data: sightingRows, error: sightingsError } = await supabase
        .from('sightings')
        .select('*')
        .or(orFilter)
        .order('sighted_at', { ascending: false });

      if (sightingsError) {
        console.error(`Failed to load sightings for case ${id}: ${sightingsError.message}`);
      }
      setSightings(sightingRows ?? []);

      const sightingIds = (sightingRows ?? []).map((s) => s.id);
      if (sightingIds.length > 0) {
        const { data: contactRows, error: contactsError } = await supabase
          .from('sighting_contacts')
          .select('*')
          .in('sighting_id', sightingIds);

        if (contactsError) {
          console.error(`Failed to load sighting contacts for case ${id}: ${contactsError.message}`);
        }
        const contactMap = {};
        (contactRows ?? []).forEach((c) => { contactMap[c.sighting_id] = c; });
        setContactsBySighting(contactMap);
      }

      setLoading(false);
    }
    load();
  }, [id]);

  const canModerate = user && (role === 'police' || role === 'ngo' || (caseData && caseData.reporter_id === user.id));

  async function updateStatus(newStatus) {
    setActionMsg('');
    const { error } = await supabase
      .from('missing_persons')
      .update({ status: newStatus })
      .eq('id', id);
    if (error) {
      console.error(`Failed to update case ${id} status to ${newStatus}: ${error.message}`);
      setActionMsg(`Could not update the case: ${error.message}`);
      return;
    }
    setCaseData((c) => ({ ...c, status: newStatus }));
    setActionMsg(`Case marked as ${newStatus}.`);
  }

  if (loading) return <div className="center-state">Loading case...</div>;
  if (errorMsg) return <div className="center-state">{errorMsg}</div>;

  const mappable = sightings.filter((s) => s.lat && s.lng);
  const photoUrl = personPhotoUrl(caseData.photo_path);

  return (
    <div className="page">
      <style>{MOBILE_FONT_STYLES}</style>

      <header className="hero-dark" style={{ paddingTop: '1rem', paddingBottom: '1.1rem' }}>
        <div className="container">
          <div
            className="topbar"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', height: 36 }}
          >
            <button
              className="back-link"
              onClick={() => navigate(-1)}
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.14)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={17} color="#fff" />
            </button>
            <h1 style={{ fontSize: '0.92rem', fontWeight: 600, letterSpacing: '0.1px', margin: 0, color: '#fff' }}>
              Case Details
            </h1>
          </div>
        </div>
      </header>

      <div className="container-narrow" style={{ marginTop: '1.25rem', paddingBottom: '3rem' }}>
        <div className="card" style={{ marginBottom: '1.25rem', display: 'flex', gap: '1rem' }}>
          {photoUrl && !photoFailed ? (
            <img
              src={photoUrl}
              alt={caseData.full_name}
              style={{ width: 90, height: 90, borderRadius: 16, objectFit: 'cover', flexShrink: 0 }}
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: 16,
                background: 'linear-gradient(160deg,#DCE7DF,#C7D6CB)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <User size={34} color="#5C6E60" strokeWidth={1.6} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
              <h2 style={{ margin: '0 0 0.2rem' }}>{caseData.full_name}</h2>
              <StatusPill status={caseData.status} />
            </div>
            <p className="muted" style={{ margin: '0 0 0.3rem' }}>
              Age {caseData.age ?? '—'} · {capitalize(caseData.gender)}
            </p>
            <p className="muted" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', margin: '0 0 0.2rem', fontSize: '0.88rem' }}>
              <MapPin size={14} /> {caseData.last_seen_location}
            </p>
            {caseData.last_seen_at && (
              <p className="muted" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', margin: 0, fontSize: '0.88rem' }}>
                <Calendar size={14} /> Last seen: {format(new Date(caseData.last_seen_at), 'MMM d, yyyy \'at\' h:mm a')}
              </p>
            )}
          </div>
        </div>

        {!highlightSightingId && (
          <>
            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Physical Description</h3>
              {caseData.description ? (
                <p className="muted" style={{ margin: 0 }}>{caseData.description}</p>
              ) : (
                <p className="muted" style={{ margin: 0, fontStyle: 'italic' }}>
                  No description added yet.
                </p>
              )}
            </div>

            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Reported by</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontWeight: 600, margin: '0 0 0.2rem' }}>
                    {caseData.reporter_name} {caseData.reporter_relation && `(${capitalize(caseData.reporter_relation)})`}
                  </p>
                </div>
                {canModerate && caseData.reporter_phone && (
                  <a
                    href={`tel:${caseData.reporter_phone}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#14291F',
                      color: '#fff',
                      padding: '8px 14px',
                      borderRadius: 12,
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      flexShrink: 0,
                    }}
                  >
                    <Phone size={14} /> {caseData.reporter_phone}
                  </a>
                )}
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Sightings Timeline</h3>
        </div>

        {sightings.length === 0 && (
          <div
            className="card"
            style={{
              marginBottom: '1.5rem',
              textAlign: 'center',
              padding: '1.75rem 1rem',
              border: '1px dashed var(--color-mint, #E4E1D8)',
              boxShadow: 'none',
            }}
          >
            <Clock size={20} color="var(--color-muted, #8B948B)" style={{ marginBottom: 8 }} />
            <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
              No sightings reported yet.<br />Reported sightings will appear here.
            </p>
          </div>
        )}

        <div className="timeline" style={{ marginBottom: '1.5rem' }}>
          {sightings.map((s) => {
            const match = matchesBySighting[s.id];
            const contact = contactsBySighting[s.id];
            const isHighlighted = s.id === highlightSightingId;
            return (
              <div
                className="timeline-item card"
                key={s.id}
                style={{
                  marginBottom: '0.9rem',
                  ...(isHighlighted
                    ? { border: '2px solid var(--color-accent)', boxShadow: '0 0 0 3px var(--color-mint)' }
                    : {}),
                }}
              >
                <span className="timeline-dot" />
                <p style={{ fontWeight: 700, margin: '0 0 0.2rem' }}>{s.location_text || 'Location not specified'}</p>
                {s.sighted_at && (
                  <p className="muted" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', margin: '0 0 0.4rem' }}>
                    <Calendar size={13} /> {format(new Date(s.sighted_at), 'MMM d, yyyy \'at\' h:mm a')}
                  </p>
                )}
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
                  {s.description}
                </p>
                {s.current_status && s.current_status !== 'seen_only' && (
                  <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 0.5rem', fontWeight: 600 }}>
                    📍 {s.current_status === 'at_police_station' ? 'Taken to police station:' :
                      s.current_status === 'at_hospital' ? 'Taken to hospital:' :
                        'Currently with reporter at:'} {s.current_location_detail}
                  </p>
                )}
                {match && (
                  <span className={`pill pill-${match.confidence_label}`}>
                    {capitalize(match.confidence_label)} match · {Math.round(match.score)}%
                  </span>
                )}
                {canModerate && contact && (contact.reporter_name || contact.reporter_phone || contact.reporter_email) && (
                  <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid var(--color-mint)' }}>
                    <p className="muted" style={{ fontSize: '0.78rem', fontWeight: 600, margin: '0 0 0.3rem' }}>Reported this sighting:</p>
                    {contact.reporter_name && <p style={{ margin: '0 0 0.2rem', fontSize: '0.85rem', fontWeight: 600 }}>{contact.reporter_name}</p>}
                    <p className="muted" style={{ display: 'flex', gap: '0.9rem', fontSize: '0.82rem', flexWrap: 'wrap', margin: 0 }}>
                      {contact.reporter_phone && <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Phone size={13} /> {contact.reporter_phone}</span>}
                      {contact.reporter_email && <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Mail size={13} /> {contact.reporter_email}</span>}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {mappable.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem' }}>Sightings Map</h3>
            <div className="leaflet-map-wrap" style={{ height: 260 }}>
              <MapContainer center={[mappable[0].lat, mappable[0].lng]} zoom={12} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                {mappable.map((s) => (
                  <Marker key={s.id} position={[s.lat, s.lng]}>
                    <Popup>{s.location_text}</Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        )}

        {actionMsg && <p className="banner" style={{ marginBottom: '1rem' }}>{actionMsg}</p>}

        {canModerate && caseData.status === 'missing' && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn"
              style={{ width: 'auto', flex: 1, background: '#14291F', color: '#fff', border: '1px solid #14291F' }}
              onClick={() => updateStatus('found')}
            >
              Mark as Found
            </button>
            <button
              className="btn"
              style={{ width: 'auto', flex: 1, background: 'transparent', color: '#14291F', border: '1px solid #14291F' }}
              onClick={() => updateStatus('closed')}
            >
              Close Case
            </button>
          </div>
        )}

        <Link
          to={`/sighting/${caseData.id}`}
          className="btn"
          style={{ marginTop: '1rem', width: '100%', background: 'transparent', color: '#14291F', border: '1px solid #14291F' }}
        >
          Report a Sighting for this case
        </Link>
      </div>
    </div>
  );
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}