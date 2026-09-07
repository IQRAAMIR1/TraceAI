import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud } from 'lucide-react';
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
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
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
    <div className="rf-page">
      <header className="hero-dark" style={{ paddingBottom: '2.5rem' }}>
        <div className="container">
          <Navbar />
          <h1 style={{ fontSize: '1.4rem', margin: '1.5rem 0 0' }}>Report a Missing Person</h1>
        </div>
      </header>

      <div className="container-narrow rf-body">
        <form onSubmit={handleSubmit} noValidate>

          <section className="rf-card">
            <div className="rf-card-header">
              <h2 className="rf-card-title">Missing Person Information</h2>
              <p className="rf-card-desc">Basic details about the missing person</p>
            </div>

            <div className="rf-row rf-row-2">
              <div className="rf-field">
                <label className="rf-label">
                  Full name of missing person <span className="rf-required">*</span>
                </label>
                <input
                  className="rf-input"
                  placeholder="e.g. Ayesha Khan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="rf-field">
                <label className="rf-label">
                  Age <span className="rf-required">*</span>
                </label>
                <input
                  className="rf-input"
                  type="number"
                  min="0"
                  placeholder="e.g. 24"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="rf-field">
              <label className="rf-label">
                Gender <span className="rf-required">*</span>
              </label>
              <select
                className="rf-input rf-select"
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

            <div className="rf-field">
              <label className="rf-label">
                Last seen date and time <span className="rf-required">*</span>
              </label>
              <input
                className="rf-input"
                type="datetime-local"
                value={lastSeenAt}
                max={maxDateTime}
                onChange={(e) => setLastSeenAt(e.target.value)}
                required
              />
              <p className="rf-hint">Future dates and times cannot be selected.</p>
            </div>

            <div className="rf-field">
              <label className="rf-label">
                Last seen location <span className="rf-required">*</span>
              </label>
              <input
                className="rf-input"
                placeholder="e.g. Gulshan-e-Iqbal, Karachi"
                value={lastSeenLocation}
                onChange={(e) => setLastSeenLocation(e.target.value)}
                required
              />
            </div>

            <div className="rf-field">
              <label className="rf-label">
                Physical description <span className="rf-required">*</span>
              </label>
              <p className="rf-hint" style={{ marginTop: 0, marginBottom: '0.5rem' }}>
                Height, clothing, distinguishing marks, etc.
              </p>
              <textarea
                className="rf-input rf-textarea"
                rows={4}
                placeholder="Describe height, build, clothing worn, distinguishing marks..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
          </section>

          <section className="rf-card">
            <div className="rf-card-header">
              <h2 className="rf-card-title">
                Photo of Missing Person <span className="rf-required">*</span>
              </h2>
              <p className="rf-card-desc">A clear, recent photo greatly improves recognition</p>
            </div>

            <label className="rf-dropzone">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="rf-dropzone-preview" />
              ) : (
                <div className="rf-dropzone-empty">
                  <UploadCloud size={28} className="rf-dropzone-icon" />
                  <p className="rf-dropzone-text">Click to upload a clear photo</p>
                  <p className="rf-hint">JPG or PNG, up to 10MB</p>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handlePhotoChange} className="rf-file-input" />
            </label>
          </section>

          <section className="rf-card">
            <div className="rf-card-header">
              <h2 className="rf-card-title">Reporter Information</h2>
              <p className="rf-card-desc">So we can contact you with updates</p>
            </div>

            <div className="rf-row rf-row-2">
              <div className="rf-field">
                <label className="rf-label">
                  Your name <span className="rf-required">*</span>
                </label>
                <input
                  className="rf-input"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  required
                />
              </div>
              <div className="rf-field">
                <label className="rf-label">
                  Phone number <span className="rf-required">*</span>
                </label>
                <input
                  className="rf-input"
                  type="tel"
                  placeholder="03xx-xxxxxxx"
                  value={reporterPhone}
                  onChange={(e) => setReporterPhone(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="rf-field">
              <label className="rf-label">
                Relationship to missing person <span className="rf-required">*</span>
              </label>
              <select
                className="rf-input rf-select"
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
          </section>

          {error && <p className="rf-error">{error}</p>}

          <button type="submit" className="rf-submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>

          <p className="rf-trust-note">Your information is secure and confidential</p>
        </form>
      </div>
    </div>
  );
}