import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MapPin, Plus, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, signOut } = useAuth();

  const isActive = (path) => location.pathname === path;

  async function handleProfileClick() {
    await signOut();
    navigate('/');
  }

  return (
    <nav className="bottom-nav">
      <Link to="/dashboard" className={`bottom-nav-item ${isActive('/dashboard') ? 'active' : ''}`}>
        <LayoutDashboard size={20} />
        Dashboard
      </Link>
      <Link to="/map" className={`bottom-nav-item ${isActive('/map') ? 'active' : ''}`}>
        <MapPin size={20} />
        Hotspot Map
      </Link>
      <Link to={role === 'family' ? '/report' : '/sighting'} className="bottom-nav-item">
        <span className="bottom-nav-fab">
          <Plus size={22} />
        </span>
      </Link>
      <button onClick={handleProfileClick} className="bottom-nav-item" style={{ background: 'none', border: 'none' }}>
        <User size={20} />
        Logout
      </button>
    </nav>
  );
}
