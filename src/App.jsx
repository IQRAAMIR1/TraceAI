import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Landing from './pages/Landing';
import Auth from './pages/Auth';
import AuthCallback from './pages/AuthCallback';
import Browse from './pages/Browse';
import Report from './pages/Report';
import Sighting from './pages/Sighting';
import Dashboard from './pages/Dashboard';
import CaseDetail from './pages/CaseDetail';
import HotspotMap from './pages/HotspotMap';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/browse" element={<Browse />} />
        <Route
          path="/report"
          element={
            <ProtectedRoute allowedRoles={['family']}>
              <Report />
            </ProtectedRoute>
          }
        />
        <Route path="/sighting" element={<Sighting />} />
        <Route path="/sighting/:personId" element={<Sighting />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['police', 'ngo']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/case/:id" element={<CaseDetail />} />
        <Route path="/map" element={<HotspotMap />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
