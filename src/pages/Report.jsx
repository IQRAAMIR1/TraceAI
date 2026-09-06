import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, ShieldCheck } from 'lucide-react';
import Navbar from '../components/Navbar';
import PakistanMotif from '../components/PakistanMotif';
import { supabase } from '../lib/supabaseClient';
import { geocodeLocation } from '../lib/geocode';
import { useAuth } from '../context/AuthContext';

export default function Report() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [lastSeenAt, setLastSeenAt] = useState('');
  const [lastSeenLocation, setLastSeenLocation] = useState('');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [reporterName, setReporterName] = useState(profile?.full_name || '');
  const [reporterPhone, setReporterPhone] = useState(profile?.phone || '');
  const [reporterRelation, setReporterRelation] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!photoFile) {
      setError('A clear photo of the missing person is required.');
      return;
    }

    setSubmitting(true);

    const ext = photoFile.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('person-photos')
      .upload(path, photoFile);

    if (uploadError) {
      console.error(`Failed to upload missing-person photo: ${uploadError.message}`);
      setError(`Photo upload failed: ${uploadError.message}`);
      setSubmitting(false);
      return;
    }

    const coords = await geocodeLocation(lastSeenLocation);
    if (!coords) {
      console.error(`Could not geocode last_seen_location "${lastSeenLocation}" — submitting without a map pin.`);
    }

    const { data: inserted, error: insertError } = await supabase
      .from('missing_persons')
      .insert({
        full_name: fullName,
        age: age ? parseInt(age, 10) : null,
        gender: gender || null,
        last_seen_at: lastSeenAt ? new Date(lastSeenAt).toISOString() : null,
        last_seen_location: lastSeenLocation,
        last_seen_lat: coords?.lat ?? null,
        last_seen_lng: coords?.lng ?? null,
        description,
        photo_path: path,
        reporter_id: user.id,
        reporter_name: reporterName,
        reporter_phone: reporterPhone,
        reporter_relation: reporterRelation,
      })
      .select()
      .single();

    setSubmitting(false);

    if (insertError) {
      console.error(`Failed to insert missing_persons row: ${insertError.message}`);
      setError(`Could not submit the report: ${insertError.message}`);
      return;
    }

    navigate(`/case/${inserted.id}`);
  }

  return (
    <div className="page">
      <header className="hero-dark" style={{ paddingBottom: '2.5rem' }}>
        <PakistanMotif />
        <div className="container">
          <Navbar />
          <h1 style={{ fontSize: '1.8rem', margin: '1.5rem 0 0' }}>Report a Missing Person</h1>
        </div>
      </header>

      <div className="container-narrow" style={{ marginTop: '-1.5rem', paddingBottom: '3rem' }}>
        <form onSubmit={handleSubmit}>
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <span className="icon-badge"><ShieldCheck size={20} /></span>
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Missing Person Information</h2>
            </div>

            <div className="field-row field-row-2">
              <div className="field">
                <label>Full name of missing person <span className="required">*</span></label>
                <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="field">
                <label>Age <span className="required">*</span></label>
                <input className="input" type="number" min="0" value={age} onChange={(e) => setAge(e.target.value)} required />
              </div>
            </div>

            <div className="field">
              <label>Gender <span className="required">*</span></label>
              <select className="input" value={gender} onChange={(e) => setGender(e.target.value)} required>
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="field">
              <label>Last seen date and time <span className="required">*</span></label>
              <input className="input" type="datetime-local" value={lastSeenAt} onChange={(e) => setLastSeenAt(e.target.value)} required />
            </div>

            <div className="field">
              <label>Last seen location <span className="required">*</span></label>
              <input className="input" placeholder="Enter last seen location" value={lastSeenLocation} onChange={(e) => setLastSeenLocation(e.target.value)} required />
            </div>

            <div className="field">
              <label>Physical description <span className="required">*</span></label>
              <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 0.4rem' }}>Height, clothing, distinguishing marks, etc.</p>
              <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} required />
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <span className="icon-badge"><UploadCloud size={20} /></span>
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Photo of Missing Person <span className="required">*</span></h2>
            </div>
            <label className="dropzone" style={{ display: 'block' }}>
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="dropzone-preview" />
              ) : (
                <>
                  <UploadCloud size={32} color="var(--color-accent)" />
                  <p>Upload a clear photo</p>
                  <p className="muted" style={{ fontSize: '0.8rem' }}>JPG, PNG up to 10MB</p>
                </>
              )}
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </label>
          </div>

          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <span className="icon-badge"><ShieldCheck size={20} /></span>
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Reporter Information</h2>
            </div>
            <div className="field-row field-row-2">
              <div className="field">
                <label>Your name <span className="required">*</span></label>
                <input className="input" value={reporterName} onChange={(e) => setReporterName(e.target.value)} required />
              </div>
              <div className="field">
                <label>Phone number <span className="required">*</span></label>
                <input className="input" value={reporterPhone} onChange={(e) => setReporterPhone(e.target.value)} required />
              </div>
            </div>
            <div className="field">
              <label>Relationship to missing person <span className="required">*</span></label>
              <select className="input" value={reporterRelation} onChange={(e) => setReporterRelation(e.target.value)} required>
                <option value="">Select relationship</option>
                <option value="parent">Parent</option>
                <option value="sibling">Sibling</option>
                <option value="spouse">Spouse</option>
                <option value="relative">Other Relative</option>
                <option value="friend">Friend</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {error && <p className="error-text" style={{ marginBottom: '1rem' }}>{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>
          <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '1rem' }}>
            <ShieldCheck size={16} color="var(--color-accent)" /> Your information is secure and confidential
          </p>
        </form>
      </div>
    </div>
  );
}
