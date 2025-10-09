import { useEffect } from 'react';
import { supabase } from '~/lib/auth/supabase.client';

export default function Login() {
  useEffect(() => {
    // no-op
  }, []);

  const signInWithProvider = async (provider: 'github' | 'google') => {
    await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
  };

  const signInWithEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email') || '');
    const password = String(formData.get('password') || '');
    await supabase.auth.signInWithPassword({ email, password });
  };

  return (
    <div className="max-w-sm mx-auto mt-16 space-y-4">
      <h1 className="text-xl font-semibold">Login</h1>
      <button className="btn btn-primary w-full" onClick={() => signInWithProvider('github')}>Sign in with GitHub</button>
      <button className="btn w-full" onClick={() => signInWithProvider('google')}>Sign in with Google</button>
      <form onSubmit={signInWithEmail} className="space-y-2">
        <input name="email" type="email" placeholder="Email" className="w-full border px-3 py-2 rounded" required />
        <input name="password" type="password" placeholder="Password" className="w-full border px-3 py-2 rounded" required />
        <button type="submit" className="btn w-full">Sign in with Email</button>
      </form>
    </div>
  );
}
