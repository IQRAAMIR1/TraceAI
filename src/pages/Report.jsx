import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Calendar, MapPin, Image as ImageIcon, UploadCloud, Phone, ShieldCheck } from 'lucide-react';
import Navbar from '../components/Navbar';
import { supabase } from '../lib/supabaseClient';
import { geocodeLocation } from '../lib/geocode';
import { useAuth } from '../context/AuthContext';

// Returns current local datetime in the format required by <input type="datetime-local">
// so the user cannot pick a "last seen" moment in the future.
function getNowForInput() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

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

  const maxDateTime = getNowForInput();

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Photo must be 10MB or smaller.');
      return;
    }

    setError('');
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!fullName || !age || !gender || !lastSeenAt || !lastSeenLocation || !description || !photoFile || !reporterName || !reporterPhone || !reporterRelation) {
      setError('Please fill in all required fields and upload a photo.');
      return;
    }

    if (lastSeenAt && new Date(lastSeenAt) > new Date()) {
      setError('Last seen date and time cannot be in the future.');
      return;
    }

    setSubmitting(true);

    const ext = photoFile.name.split('.').pop();
    const photoPath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('person-photos')
      .upload(photoPath, photoFile);
    if (uploadError) {
      console.error(`Failed to upload person photo: ${uploadError.message}`);
      setError(`Photo upload failed: ${uploadError.message}`);
      setSubmitting(false);
      return;
    }

    const coords = await geocodeLocation(lastSeenLocation);
    if (!coords) {
      console.error(`Could not geocode last_seen_location "${lastSeenLocation}" — submitting without a map pin.`);
    }

    const { data: caseRow, error: insertError } = await supabase
      .from('missing_persons')
      .insert({
        full_name: fullName,
        age: Number(age),
        gender,
        last_seen_at: new Date(lastSeenAt).toISOString(),
        last_seen_location: lastSeenLocation,
        last_seen_lat: coords?.lat ?? null,
        last_seen_lng: coords?.lng ?? null,
        description,
        photo_path: photoPath,
        status: 'missing',
        reporter_id: user?.id ?? null,
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

    navigate(`/case/${caseRow.id}`);
  }

  return (
    <div className="page">
      <header className="hero-dark" style={{ paddingBottom: '2.5rem' }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="back-link"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              style={{ width: 36, height: 36, flexShrink: 0, background: 'rgba(255,255,255,0.14)', border: 'none' }}
            >
              <ArrowLeft size={17} color="#fff" />
            </button>
            <div style={{ flex: 1 }}>
              <Navbar />
            </div>
          </div>
          <h1 style={{ fontSize: '1.6rem', margin: '1rem 0 0' }}>Report a Missing Person</h1>
        </div>
      </header>

      <div className="container-narrow auth-sheet" style={{ paddingTop: '0.75rem' }}>
        <form onSubmit={handleSubmit} noValidate>

          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.1rem' }}>
              <span className="icon-badge"><User size={20} /></span>
              <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Missing Person Information</h2>
            </div>

            <div className="field">
              <label>
                Full name of missing person <span className="required">*</span>
              </label>
              <input
                className="input"
                placeholder="Enter full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label>
                Age <span className="required">*</span>
              </label>
              <input
                className="input"
                type="number"
                min="0"
                placeholder="Enter age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label>
                Gender <span className="required">*</span>
              </label>
              <select
                className="input"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                required
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="field">
              <label>
                Last seen date and time <span className="required">*</span>
              </label>
              <div className="input-icon-wrap">
                <span className="input-icon"><Calendar size={18} /></span>
                <input
                  className="input"
                  type="datetime-local"
                  value={lastSeenAt}
                  max={maxDateTime}
                  onChange={(e) => setLastSeenAt(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="field">
              <label>
                Last seen location <span className="required">*</span>
              </label>
              <div className="input-icon-wrap">
                <span className="input-icon"><MapPin size={18} /></span>
                <input
                  className="input"
                  placeholder="Enter last seen location"
                  value={lastSeenLocation}
                  onChange={(e) => setLastSeenLocation(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="field">
              <label>
                Physical description <span className="required">*</span>
              </label>
              <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 0.5rem' }}>
                Height, clothing, distinguishing marks, etc.
              </p>
              <textarea
                className="input"
                rows={4}
                placeholder="Enter physical description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.1rem' }}>
              <span className="icon-badge"><ImageIcon size={20} /></span>
              <h2 style={{ fontSize: '1.05rem', margin: 0 }}>
                Photo of Missing Person <span className="required">*</span>
              </h2>
            </div>

            <label className="dropzone" style={{ display: 'block' }}>
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="dropzone-preview" />
              ) : (
                <>
                  <UploadCloud size={28} color="var(--color-accent)" />
                  <p>Upload a clear photo</p>
                  <p className="muted" style={{ fontSize: '0.8rem' }}>JPG, PNG up to 10MB</p>
                </>
              )}
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </label>
          </div>

          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.1rem' }}>
              <span className="icon-badge"><User size={20} /></span>
              <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Reporter Information</h2>
            </div>

            <div className="field-row field-row-2">
              <div className="field">
                <label>
                  Your name <span className="required">*</span>
                </label>
                <input
                  className="input"
                  placeholder="Enter your full name"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>
                  Phone number <span className="required">*</span>
                </label>
                <div className="input-icon-wrap">
                  <span className="input-icon"><Phone size={18} /></span>
                  <input
                    className="input"
                    type="tel"
                    placeholder="Enter phone number"
                    value={reporterPhone}
                    onChange={(e) => setReporterPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="field">
              <label>
                Relationship to missing person <span className="required">*</span>
              </label>
              <select
                className="input"
                value={reporterRelation}
                onChange={(e) => setReporterRelation(e.target.value)}
                required
              >
                <option value="">Select relationship</option>
                <option value="parent">Parent</option>
                <option value="sibling">Sibling</option>
                <option value="spouse">Spouse</option>
                <option value="child">Child</option>
                <option value="relative">Other relative</option>
                <option value="friend">Friend</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {error && <p className="error-text" style={{ textAlign: 'center', marginBottom: '1rem' }}>{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>

          <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '1rem' }}>
            <ShieldCheck size={16} color="var(--color-accent)" /> Your information is secure and confidential
          </p>
        </form>
      </div>
    </div>
  );
}