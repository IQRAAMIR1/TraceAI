import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapPin, UploadCloud, ShieldCheck } from 'lucide-react';
import Navbar from '../components/Navbar';
import PakistanMotif from '../components/PakistanMotif';
import { supabase } from '../lib/supabaseClient';
import { geocodeLocation } from '../lib/geocode';

export default function Sighting() {
  const { personId } = useParams();
  const navigate = useNavigate();

  const [cases, setCases] = useState([]);
  const [selectedPersonId, setSelectedPersonId] = useState(personId || '');
  const [isGeneral, setIsGeneral] = useState(!personId);
  const [locationText, setLocationText] = useState('');
  const [sightedAt, setSightedAt] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [description, setDescription] = useState('');
  const [currentStatus, setCurrentStatus] = useState('seen_only');
  const [currentLocationDetail, setCurrentLocationDetail] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadCases() {
      const { data, error } = await supabase
        .from('missing_persons')
        .select('id, full_name, case_number')
        .eq('status', 'missing')
        .order('created_at', { ascending: false });
      if (error) {
        console.error(`Failed to load cases for the sighting dropdown: ${error.message}`);
        return;
      }
      setCases(data ?? []);
    }
    loadCases();
  }, []);

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setStatusMsg('');

    if (!isGeneral && !selectedPersonId) {
      setError('Please select a case, or mark this as a general sighting.');
      return;
    }

    if (currentStatus !== 'seen_only' && !currentLocationDetail.trim()) {
      setError('Please tell us the name of the police station or hospital.');
      return;
    }

    setSubmitting(true);

    let photoPath = null;
    if (photoFile) {
      const ext = photoFile.name.split('.').pop();
      photoPath = `sightings/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('sighting-photos')
        .upload(photoPath, photoFile);
      if (uploadError) {
        console.error(`Failed to upload sighting photo: ${uploadError.message}`);
        setError(`Photo upload failed: ${uploadError.message}`);
        setSubmitting(false);
        return;
      }
    }

    const { data: userData } = await supabase.auth.getUser();

    const coords = await geocodeLocation(locationText);
    if (!coords) {
      console.error(`Could not geocode sighting location_text "${locationText}" — submitting without a map pin.`);
    }

    const { data: sightingRow, error: insertError } = await supabase
      .from('sightings')
      .insert({
        person_id: isGeneral ? null : selectedPersonId,
        is_general: isGeneral,
        sighted_at: sightedAt ? new Date(sightedAt).toISOString() : null,
        location_text: locationText,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        description,
        photo_path: photoPath,
        submitted_by: userData?.user?.id ?? null,
        current_status: currentStatus,
        current_location_detail: currentStatus === 'seen_only' ? null : currentLocationDetail,
      })
      .select()
      .single();

    if (insertError) {
      console.error(`Failed to insert sighting: ${insertError.message}`);
      setError(`Could not submit the sighting: ${insertError.message}`);
      setSubmitting(false);
      return;
    }

    if (reporterName || reporterPhone || reporterEmail) {
      const { error: contactError } = await supabase.from('sighting_contacts').insert({
        sighting_id: sightingRow.id,
        reporter_name: reporterName || null,
        reporter_phone: reporterPhone || null,
        reporter_email: reporterEmail || null,
      });
      if (contactError) {
        console.error(`Failed to insert sighting_contacts for sighting ${sightingRow.id}: ${contactError.message}`);
      }
    }

    setStatusMsg('Sighting submitted. Running AI comparison...');

    const { data: matchResult, error: fnError } = await supabase.functions.invoke('match-sighting', {
      body: { sighting_id: sightingRow.id },
    });

    setSubmitting(false);

    if (fnError) {
      console.error(`match-sighting function call failed: ${fnError.message}`);
      setStatusMsg('Sighting saved, but AI matching could not be completed right now.');
      return;
    }

    if (matchResult?.status === 'matched') {
      setStatusMsg(
        `Sighting saved. AI match confidence: ${matchResult.confidence_label} (${Math.round(matchResult.score)}%).`
      );
    } else if (matchResult?.status === 'no_match') {
      setStatusMsg('Sighting saved. No active cases were available to compare against.');
    } else {
      setStatusMsg('Sighting saved, but AI matching ran into an issue.');
    }

    setTimeout(() => navigate(isGeneral ? '/map' : `/case/${selectedPersonId}`), 1800);
  }

  return (
    <div className="page">
      <header className="hero-dark" style={{ paddingBottom: '2.5rem' }}>
        <PakistanMotif />
        <div className="container">
          <Navbar />
          <h1 style={{ fontSize: '1.8rem', margin: '1.5rem 0 0' }}>Submit a Sighting</h1>
        </div>
      </header>

      <div className="container-narrow" style={{ marginTop: '-1.5rem', paddingBottom: '3rem' }}>
        <form onSubmit={handleSubmit}>
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div className="field">
              <label>This sighting is related to <span className="required">*</span></label>
              <select
                className="input"
                value={selectedPersonId}
                disabled={isGeneral}
                onChange={(e) => setSelectedPersonId(e.target.value)}
              >
                <option value="">Search by name or select...</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name} — {c.case_number}</option>
                ))}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={isGeneral}
                onChange={(e) => { setIsGeneral(e.target.checked); if (e.target.checked) setSelectedPersonId(''); }}
              />
              Not sure / general sighting
            </label>

            <div className="field" style={{ marginTop: '1.25rem' }}>
              <label>Location of sighting <span className="required">*</span></label>
              <div className="input-icon-wrap">
                <span className="input-icon"><MapPin size={18} /></span>
                <input className="input" placeholder="Enter location" value={locationText} onChange={(e) => setLocationText(e.target.value)} required />
              </div>
            </div>

            <div className="field">
              <label>Date and time of sighting <span className="required">*</span></label>
              <input className="input" type="datetime-local" value={sightedAt} onChange={(e) => setSightedAt(e.target.value)} required />
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.6rem', display: 'block' }}>
              Where is the person right now? <span className="required">*</span>
            </label>
            <select className="input" value={currentStatus} onChange={(e) => setCurrentStatus(e.target.value)}>
              <option value="seen_only">Just seen — they moved on / I don't know where they are now</option>
              <option value="with_reporter">They are with me right now</option>
              <option value="at_police_station">I took them to a police station</option>
              <option value="at_hospital">I took them to a hospital</option>
            </select>

            {currentStatus !== 'seen_only' && (
              <div className="field" style={{ marginTop: '0.9rem' }}>
                <label>
                  {currentStatus === 'at_police_station' ? 'Which police station?' :
                   currentStatus === 'at_hospital' ? 'Which hospital?' :
                   'Where exactly are you with them?'}
                  <span className="required"> *</span>
                </label>
                <input
                  className="input"
                  placeholder="e.g. Gulshan-e-Iqbal Police Station"
                  value={currentLocationDetail}
                  onChange={(e) => setCurrentLocationDetail(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.6rem', display: 'block' }}>Photo (optional)</label>
            <label className="dropzone" style={{ display: 'block' }}>
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="dropzone-preview" />
              ) : (
                <>
                  <UploadCloud size={32} color="var(--color-accent)" />
                  <p>Upload a photo (optional)</p>
                  <p className="muted" style={{ fontSize: '0.8rem' }}>JPG, PNG up to 10MB</p>
                </>
              )}
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </label>

            <div className="field" style={{ marginTop: '1.25rem' }}>
              <label>Description (what did you see?) <span className="required">*</span></label>
              <textarea
                className="input"
                placeholder="Describe what you saw (clothing, condition, companions, direction, etc.)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
              <span className="icon-badge"><ShieldCheck size={20} /></span>
              <div>
                <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Your Information (optional)</h2>
                <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>You can remain anonymous. Providing contact info may help us follow up.</p>
              </div>
            </div>
            <div className="field-row field-row-2">
              <div className="field">
                <label>Your name</label>
                <input className="input" value={reporterName} onChange={(e) => setReporterName(e.target.value)} />
              </div>
              <div className="field">
                <label>Phone number</label>
                <input className="input" value={reporterPhone} onChange={(e) => setReporterPhone(e.target.value)} />
              </div>
            </div>
          </div>

          {error && <p className="error-text" style={{ marginBottom: '1rem' }}>{error}</p>}
          {statusMsg && <p className="banner" style={{ marginBottom: '1rem' }}>{statusMsg}</p>}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Sighting'}
          </button>
          <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '1rem' }}>
            <ShieldCheck size={16} color="var(--color-accent)" /> Your information is secure and confidential
          </p>
        </form>
      </div>
    </div>
  );
}