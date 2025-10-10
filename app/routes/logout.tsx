import { useEffect } from 'react';
import { supabase } from '~/lib/auth/supabase.client';

export default function Logout() {
  useEffect(() => {
    supabase.auth.signOut().finally(() => {
      window.location.href = '/';
    });
  }, []);

  return <div className="p-4">Signing out...</div>;
}
