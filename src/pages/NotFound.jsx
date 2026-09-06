import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="center-state">
      <h1 style={{ fontSize: '2rem', color: 'var(--color-ink)' }}>Page not found</h1>
      <p className="muted">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn btn-primary" style={{ width: 'auto', display: 'inline-flex', marginTop: '1rem' }}>
        Back to Home
      </Link>
    </div>
  );
}
