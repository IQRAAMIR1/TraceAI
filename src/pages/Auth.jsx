import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, Briefcase, Phone, ShieldCheck, KeyRound } from 'lucide-react';
import Navbar from '../components/Navbar';
import PakistanMotif from '../components/PakistanMotif';
import { supabase, ACCESS_CODES } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.92c1.7-1.57 2.68-3.88 2.68-6.64z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33C2.44 15.98 5.48 18 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.7A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.29-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0 5.48 0 2.44 2.02.96 4.97l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export default function Auth() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [role, setRole] = useState('family');
  const [phone, setPhone] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  if (!authLoading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate('/');
  }

  async function handleSignup(e) {
    e.preventDefault();
    setError('');

    if (signupPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if ((role === 'police' || role === 'ngo') && accessCode.trim() !== ACCESS_CODES[role]) {
      setError('Invalid access code for the selected role.');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        data: {
          full_name: fullName,
          phone,
          role,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    setTab('login');
    setError('');
    alert('Account created. Please check your email to confirm your account, then log in.');
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="page">
      <header className="hero-dark" style={{ paddingBottom: '4rem' }}>
        <PakistanMotif />
        <div className="container">
          <Navbar />
          <h1 style={{ fontSize: '2rem', margin: '2rem 0 0.4rem' }}>
            {tab === 'login' ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)' }}>
            {tab === 'login' ? 'Sign in to continue your mission' : 'Join the mission to bring people home'}
          </p>
        </div>
      </header>

      <div className="container-narrow auth-sheet">
        <div className="tabs">
          <button className={`tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError(''); }}>
            Login
          </button>
          <button className={`tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => { setTab('signup'); setError(''); }}>
            Sign Up
          </button>
        </div>

        {error && <p className="error-text" style={{ marginBottom: '1rem' }}>{error}</p>}

        {tab === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Email</label>
              <div className="input-icon-wrap">
                <span className="input-icon"><Mail size={18} /></span>
                <input
                  className="input"
                  type="email"
                  placeholder="Enter your email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label>Password</label>
              <div className="input-icon-wrap">
                <span className="input-icon"><Lock size={18} /></span>
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
                <button type="button" className="input-icon-right" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--color-accent)', marginTop: '0.4rem' }}>
                Forgot password?
              </p>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Logging in...' : 'Login'}
            </button>
            <div className="divider-or">or</div>
            <button type="button" className="btn btn-google" onClick={handleGoogle}>
              <GoogleIcon /> Continue with Google
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup}>
            <div className="field">
              <label>Full Name</label>
              <div className="input-icon-wrap">
                <span className="input-icon"><User size={18} /></span>
                <input className="input" placeholder="Enter your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            </div>
            <div className="field">
              <label>Email</label>
              <div className="input-icon-wrap">
                <span className="input-icon"><Mail size={18} /></span>
                <input className="input" type="email" placeholder="Enter your email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
              </div>
            </div>
            <div className="field">
              <label>Role</label>
              <div className="input-icon-wrap">
                <span className="input-icon"><Briefcase size={18} /></span>
                <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="family">Family</option>
                  <option value="police">Police</option>
                  <option value="ngo">NGO</option>
                </select>
              </div>
            </div>

            {(role === 'police' || role === 'ngo') && (
              <div className="field">
                <label>Access Code <span className="required">*</span></label>
                <div className="input-icon-wrap">
                  <span className="input-icon"><KeyRound size={18} /></span>
                  <input
                    className="input"
                    placeholder="Enter your organization's access code"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    required
                  />
                </div>
                <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>
                  Provided by your Police department or NGO administrator.
                </p>
              </div>
            )}

            <div className="field">
              <label>Phone Number</label>
              <div className="input-icon-wrap">
                <span className="input-icon"><Phone size={18} /></span>
                <input className="input" placeholder="Enter your phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Password</label>
              <div className="input-icon-wrap">
                <span className="input-icon"><Lock size={18} /></span>
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                />
                <button type="button" className="input-icon-right" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="field">
              <label>Confirm Password</label>
              <div className="input-icon-wrap">
                <span className="input-icon"><Lock size={18} /></span>
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating account...' : 'Create Account'}
            </button>
            <div className="divider-or">or</div>
            <button type="button" className="btn btn-google" onClick={handleGoogle}>
              <GoogleIcon /> Continue with Google
            </button>
          </form>
        )}

        <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '1.25rem' }}>
          <ShieldCheck size={16} color="var(--color-accent)" /> Your information is secure and confidential
        </p>
      </div>
    </div>
  );
}