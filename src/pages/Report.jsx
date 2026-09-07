import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud } from 'lucide-react';
import Navbar from '../components/Navbar';
import PakistanMotif from '../components/PakistanMotif';
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

    if (!photoFile) {
      setError('A clear photo of the missing person is required.');
      return;
    }

    if (lastSeenAt && new Date(lastSeenAt) > new Date()) {
      setError('Last seen date and time cannot be in the future.');
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
    <div className="rf-page">
      <header className="hero-dark" style={{ paddingBottom: '2.5rem' }}>
        <PakistanMotif />
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
                <option value="relative">Other Relative</option>
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

      <style>{`
        .rf-page {
          min-height: 100vh;
          background: #f6f7f5;
        }

        .rf-body {
          margin-top: 2rem;
          padding-bottom: 3rem;
          position: relative;
          z-index: 2;
        }

        .rf-card {
          background: #ffffff;
          border: 1.5px solid #d7dbd2;
          border-radius: 14px;
          box-shadow: 0 4px 18px rgba(15, 36, 25, 0.07);
          padding: 1.75rem;
          margin-bottom: 1.5rem;
        }

        .rf-card-header {
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #eef0ec;
        }

        .rf-card-title {
          font-size: 1rem;
          font-weight: 700;
          color: #16241c;
          margin: 0 0 0.25rem;
        }

        .rf-card-desc {
          font-size: 0.8rem;
          color: #5f6a5a;
          margin: 0;
        }

        .rf-row {
          display: grid;
          gap: 1.1rem;
        }

        .rf-row-2 {
          grid-template-columns: 1fr 1fr;
        }

        .rf-field {
          margin-bottom: 1.1rem;
        }

        .rf-row .rf-field {
          margin-bottom: 0;
        }

        .rf-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 700;
          color: #1a251c;
          margin-bottom: 0.4rem;
        }

        .rf-required {
          color: #c0392b;
        }

        .rf-hint {
          font-size: 0.72rem;
          color: #798073;
          margin: 0.35rem 0 0;
        }

        .rf-input {
          width: 100%;
          box-sizing: border-box;
          padding: 0.7rem 0.85rem;
          font-size: 0.9rem;
          font-family: inherit;
          font-weight: 500;
          color: #16211a;
          background: #ffffff;
          border: 1.5px solid #b9c0b3;
          border-radius: 9px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }

        .rf-input::placeholder {
          color: #97a091;
          font-weight: 400;
        }

        .rf-input:hover {
          border-color: #8f9989;
        }

        .rf-input:focus {
          outline: none;
          border-color: #22c55e;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
        }

        .rf-select {
          appearance: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23697066' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
          background-repeat: no-repeat;
          background-position: right 0.85rem center;
          padding-right: 2.2rem;
        }

        .rf-textarea {
          resize: vertical;
          min-height: 100px;
          line-height: 1.5;
        }

        .rf-input[type="datetime-local"]::-webkit-calendar-picker-indicator {
          filter: opacity(0.55);
          cursor: pointer;
        }

        .rf-dropzone {
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px dashed #b9c0b3;
          border-radius: 12px;
          background: #fbfcfa;
          padding: 2rem 1rem;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
          min-height: 160px;
        }

        .rf-dropzone:hover {
          border-color: #22c55e;
          background: #f4f8f5;
        }

        .rf-dropzone-empty {
          text-align: center;
        }

        .rf-dropzone-icon {
          color: #22c55e;
          margin-bottom: 0.5rem;
        }

        .rf-dropzone-text {
          font-size: 0.85rem;
          font-weight: 600;
          color: #1a251c;
          margin: 0 0 0.2rem;
        }

        .rf-dropzone-preview {
          max-height: 220px;
          max-width: 100%;
          border-radius: 10px;
          object-fit: cover;
        }

        .rf-file-input {
          display: none;
        }

        .rf-error {
          background: #fdecea;
          border: 1px solid #f3c2bc;
          color: #a3352a;
          font-size: 0.78rem;
          padding: 0.7rem 0.9rem;
          border-radius: 8px;
          margin-bottom: 1.1rem;
        }

        .rf-submit {
          width: 100%;
          padding: 0.85rem 1rem;
          font-size: 0.88rem;
          font-weight: 600;
          color: #ffffff;
          background: #156030;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.05s ease;
        }

        .rf-submit:hover:not(:disabled) {
          background: #3e7552;
        }

        .rf-submit:active:not(:disabled) {
          transform: translateY(1px);
        }

        .rf-submit:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .rf-trust-note {
          text-align: center;
          font-size: 0.72rem;
          color: #8a9186;
          margin-top: 1rem;
        }

        @media (max-width: 640px) {
          .rf-card {
            padding: 1.25rem;
            border-radius: 12px;
          }

          .rf-row-2 {
            grid-template-columns: 1fr;
            gap: 1.1rem;
          }

          .rf-body {
            margin-top: 1.5rem;
          }

          .rf-input {
            font-size: 0.85rem;
            padding: 0.65rem 0.8rem;
          }

          .rf-label {
            font-size: 0.8rem;
          }

          .rf-card-title {
            font-size: 0.95rem;
          }

          .rf-card-desc {
            font-size: 0.75rem;
          }

          .rf-hint {
            font-size: 0.7rem;
          }
        }
      `}</style>
    </div>
  );
}