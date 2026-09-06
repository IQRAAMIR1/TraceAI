import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { format } from 'date-fns';
import Navbar from '../components/Navbar';
import PakistanMotif from '../components/PakistanMotif';
import { supabase, personPhotoUrl } from '../lib/supabaseClient';
import 'leaflet/dist/leaflet.css';

// Default view centered on Karachi when no sightings have coordinates yet.
const DEFAULT_CENTER = [24.8607, 67.0011];

export default function HotspotMap() {
  const [sightings, setSightings] = useState([]);
  const [caseId, setCaseId] = useState('');
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: sightingRows, error: sightingsError } = await supabase
        .from('sightings')
        .select('id, person_id, location_text, sighted_at, lat, lng, description')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .order('sighted_at', { ascending: false });

      if (sightingsError) {
        console.error(`Hotspot Map failed to load sightings: ${sightingsError.message}`);
      }
      setSightings(sightingRows ?? []);

      const { data: personRows, error: personsError } = await supabase
        .from('missing_persons')
        .select('id, full_name, photo_path')
        .eq('status', 'missing');

      if (personsError) {
        console.error(`Hotspot Map failed to load case list for lookup: ${personsError.message}`);
      }
      setCases(personRows ?? []);

      setLoading(false);
    }
    load();
  }, []);

  const personById = useMemo(() => {
    const map = {};
    cases.forEach((c) => { map[c.id] = c; });
    return map;
  }, [cases]);

  const filtered = useMemo(() => {
    if (!caseId) return sightings;
    return sightings.filter((s) => s.person_id === caseId);
  }, [sightings, caseId]);

  const center = filtered.length > 0 ? [filtered[0].lat, filtered[0].lng] : DEFAULT_CENTER;

  return (
    <div className="page">
      <header className="hero-dark" style={{ paddingBottom: '2rem' }}>
        <PakistanMotif />
        <div className="container">
          <Navbar />
          <h1 style={{ fontSize: '1.8rem', margin: '1.25rem 0 0' }}>Hotspot Map</h1>
        </div>
      </header>

      <div className="container" style={{ marginTop: '-1rem', paddingBottom: '3rem' }}>
        <div className="leaflet-map-wrap" style={{ height: 460, marginBottom: '1.25rem' }}>
          {!loading && (
            <MapContainer center={center} zoom={filtered.length > 0 ? 12 : 11} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
              {filtered.map((s) => {
                const person = personById[s.person_id];
                return (
                  <Marker key={s.id} position={[s.lat, s.lng]}>
                    <Popup>
                      <div style={{ minWidth: 160 }}>
                        {person ? (
                          <>
                            <strong>{person.full_name}</strong>
                            <br />
                          </>
                        ) : (
                          <strong>General sighting</strong>
                        )}
                        {s.location_text}
                        {s.sighted_at && (
                          <>
                            <br />
                            {format(new Date(s.sighted_at), 'MMM d, yyyy h:mm a')}
                          </>
                        )}
                        {person && (
                          <>
                            <br />
                            <Link to={`/case/${person.id}`} style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                              View Case →
                            </Link>
                          </>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          )}
        </div>

        <div className="card">
          <div className="field-row field-row-2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Case</label>
              <select className="input" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
                <option value="">All Cases</option>
                {cases.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Total sightings shown</label>
              <input className="input" value={filtered.length} disabled />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
