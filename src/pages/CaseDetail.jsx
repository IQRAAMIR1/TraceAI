import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { MapPin, Calendar, Phone, Mail, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { supabase, personPhotoUrl } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import 'leaflet/dist/leaflet.css';

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

  return (
    <div className="page">
      <header className="hero-dark" style={{ paddingBottom: '2rem' }}>
        <div className="container">
          <div className="topbar">
            <button className="back-link" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
            <h1 style={{ fontSize: '1.2rem', margin: 0 }}>Case Details</h1>
            <span style={{ width: 40 }} />
          </div>
        </div>
      </header>

      <div className="container-narrow" style={{ marginTop: '-1rem', paddingBottom: '3rem' }}>
        <div className="card" style={{ marginBottom: '1.25rem', display: 'flex', gap: '1rem' }}>
          <img
            src={personPhotoUrl(caseData.photo_path) || undefined}
            alt={caseData.full_name}
            style={{ width: 90, height: 90, borderRadius: 16, objectFit: 'cover', background: 'var(--color-mint)' }}
            onError={(e) => { e.target.style.visibility = 'hidden'; }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h2 style={{ margin: '0 0 0.2rem' }}>{caseData.full_name}</h2>
              <span className={`pill pill-${caseData.status === 'missing' ? 'active' : caseData.status === 'found' ? 'found' : 'closed'}`}>
                {capitalize(caseData.status)}
              </span>
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
            {caseData.description && (
              <div className="card" style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Physical Description</h3>
                <p className="muted" style={{ margin: 0 }}>{caseData.description}</p>
              </div>
            )}

            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Reported by</h3>
              <p style={{ fontWeight: 600, margin: '0 0 0.3rem' }}>
                {caseData.reporter_name} {caseData.reporter_relation && `(${capitalize(caseData.reporter_relation)})`}
              </p>
              {canModerate && (
                <p className="muted" style={{ display: 'flex', gap: '0.9rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                  {caseData.reporter_phone && <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Phone size={14} /> {caseData.reporter_phone}</span>}
                </p>
              )}
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Sightings Timeline</h3>
        </div>

        {sightings.length === 0 && <p className="muted" style={{ marginBottom: '1.5rem' }}>No sightings reported yet.</p>}

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
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>{s.description}
                  {s.current_status && s.current_status !== 'seen_only' && (
                    <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 0.5rem', fontWeight: 600 }}>
                      📍 {s.current_status === 'at_police_station' ? 'Taken to police station:' :
                        s.current_status === 'at_hospital' ? 'Taken to hospital:' :
                          'Currently with reporter at:'} {s.current_location_detail}
                    </p>
                  )}
                </p>
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
            <button className="btn btn-primary" style={{ width: 'auto', flex: 1 }} onClick={() => updateStatus('found')}>Mark as Found</button>
            <button className="btn btn-outline-dark" style={{ width: 'auto', flex: 1 }} onClick={() => updateStatus('closed')}>Close Case</button>
          </div>
        )}

        <Link to={`/sighting/${caseData.id}`} className="btn btn-outline-dark" style={{ marginTop: '1rem', width: '100%' }}>
          Report a Sighting for this case
        </Link>
      </div>
    </div>
  );
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
