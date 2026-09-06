import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, role, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const links = [
    { to: '/browse', label: 'Browse' },
    { to: '/report', label: 'Report a Missing Person' },
    { to: '/sighting', label: 'Submit a Sighting' },
    { to: '/map', label: 'Hotspot Map' },
    ...(user && (role === 'police' || role === 'ngo') ? [{ to: '/dashboard', label: 'Dashboard' }] : []),
  ];

  async function handleLogout() {
    await signOut();
    setOpen(false);
  }

  return (
    <div className="topbar">
      <Link to="/" className="brand" onClick={() => setOpen(false)}>
        <span className="brand-icon">
          <ShieldCheck size={22} color="#fff" />
        </span>
        <span>
          <span className="brand-name">
            Trace<span>AI</span>
          </span>
          <br />
          <span className="brand-tagline">AI-Powered Recovery</span>
        </span>
      </Link>

      <nav className="topbar-nav">
        {links.map((l) => (
          <Link key={l.to} to={l.to}>{l.label}</Link>
        ))}
      </nav>

      <div className="topbar-actions">
        {user && <NotificationBell />}

        {user ? (
          <button
            className="topbar-desktop-only"
            onClick={handleLogout}
            style={{
              background: 'transparent',
              border: '1px solid #fff',
              color: '#fff',
              borderRadius: '999px',
              padding: '6px 14px',
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        ) : (
          <Link
            to="/auth"
            className="topbar-desktop-only"
            style={{
              border: '1px solid #fff',
              color: '#fff',
              borderRadius: '999px',
              padding: '6px 14px',
            }}
          >
            Login / Sign Up
          </Link>
        )}

        <button className="hamburger-btn" aria-label="Open menu" onClick={() => setOpen(true)}>
          <Menu size={20} />
        </button>
      </div>

      {open && (
        <>
          <div className="mobile-panel-backdrop" onClick={() => setOpen(false)} />
          <div className="mobile-panel">
            <div className="mobile-panel-header">
              <span className="brand">
                <span className="brand-icon">
                  <ShieldCheck size={20} color="#fff" />
                </span>
                <span className="brand-name">
                  Trace<span>AI</span>
                </span>
              </span>
              <button className="hamburger-btn" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <nav className="mobile-panel-links">
              {links.map((l) => (
                <Link key={l.to} to={l.to} onClick={() => setOpen(false)}>{l.label}</Link>
              ))}
            </nav>

            <div className="mobile-panel-footer">
              {user ? (
                <button className="btn btn-outline" onClick={handleLogout}>
                  Logout
                </button>
              ) : (
                <Link to="/auth" className="btn btn-primary" onClick={() => setOpen(false)}>
                  Login / Sign Up
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}