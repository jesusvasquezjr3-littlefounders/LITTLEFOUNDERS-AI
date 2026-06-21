import { useState } from 'react';
import { supabase } from '@/lib/supabase';
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
      <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
        <span className="font-semibold text-sm">{successMsg}</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-2">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder={placeholder} required
            className="corp-input pl-10 pr-4 py-3 rounded-xl text-sm font-medium"
          />
        </div>
        <button type="submit" disabled={loading}
          className="corp-btn-primary inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-7 py-3.5 sm:w-auto w-full disabled:opacity-60 active:scale-[0.97] transition-[transform,background] duration-200">
          {loading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
          {ctaLabel}
        </button>
      </form>
      {error && <p className="text-xs text-red-500 dark:text-red-400 font-medium pl-1">{error}</p>}
    </div>
  );
}
