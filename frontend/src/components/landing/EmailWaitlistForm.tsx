import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Mail, Send } from 'lucide-react';

interface EmailWaitlistFormProps {
  ctaLabel: string;
  placeholder: string;
  successMsg: string;
  language: string;
  source?: string;
}

export function EmailWaitlistForm({
  ctaLabel,
  placeholder,
  successMsg,
  language,
  source = 'families_page',
}: EmailWaitlistFormProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const { error: sbError } = await supabase
      .from('families_waitlist')
      .insert({ email: email.trim().toLowerCase(), language, source });
    setLoading(false);
    if (sbError && sbError.code !== '23505') { setError(sbError.message); return; }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300">
        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
        <span className="font-bold text-sm">{successMsg}</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-2">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder={placeholder} required
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-pink-400 dark:focus:ring-pink-500 transition-all placeholder:text-gray-400"
          />
        </div>
        <Button type="submit" disabled={loading}
          className="btn-press shrink-0 w-72 py-3 rounded-xl font-black bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-400 hover:to-violet-500 text-white border-0 shadow-none inline-flex items-center justify-center gap-2 disabled:opacity-60 mx-auto sm:mx-0">
          {loading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
          {ctaLabel}
        </Button>
      </form>
      {error && <p className="text-xs text-red-500 dark:text-red-400 font-medium pl-1">{error}</p>}
    </div>
  );
}
