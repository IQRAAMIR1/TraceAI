import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error(`Auth callback failed to resolve session: ${error.message}`);
      }
      navigate(data?.session ? '/' : '/auth', { replace: true });
    });
  }, [navigate]);

  return <div className="center-state">Confirming your account...</div>;
}
