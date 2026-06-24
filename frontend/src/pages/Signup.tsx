import { useState, useEffect } from "react";
import { SiDiscord } from "react-icons/si";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, ArrowRight, Send, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_URL } from "@/config/api";
import { savePendingMerge, clearPendingMerge } from "@/lib/guestProfile";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { useSound } from "@/contexts/SoundContext";

/* ─── Shared Google Icon ──────────────────────────────────────────────────── */
const GoogleIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

/* ─── Corp background shell (shared between screens) ─────────────────────── */
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="corp min-h-screen relative overflow-hidden bg-gradient-to-b from-indigo-50/80 via-white to-white dark:from-[#0b1124] dark:via-[#070b14] dark:to-[#070b14]">
      <div className="absolute inset-0 corp-grid-bg pointer-events-none" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-indigo-400/12 dark:bg-indigo-600/12 blur-[120px] pointer-events-none" />
      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector variant="full" />
      </div>
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4 py-12">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  );
}

const Signup = () => {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sentToEmail, setSentToEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { playSound } = useSound();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token || user) navigate('/learn');
  }, [navigate]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password || !formData.confirmPassword) {
      toast({ title: t('auth:validation.incomplete_data'), description: t('auth:validation.complete_all_fields'), variant: "destructive" });
      return;
    }
    if (formData.password.length < 6) {
      toast({ title: t('auth:validation.password_too_short'), description: t('auth:validation.password_min_chars'), variant: "destructive" });
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast({ title: t('auth:validation.passwords_dont_match'), description: t('auth:validation.passwords_verify'), variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      // 1. Register via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });

      if (authError) {
        playSound('auth_error');
        toast({ title: t('auth:validation.registration_error'), description: authError.message, variant: "destructive" });
        return;
      }

      // If email confirmation is required, session will be null
      if (!authData.session) {
        playSound('auth_success');
        setSentToEmail(formData.email);
        setEmailSent(true);
        return;
      }

      // 2. Session exists (auto-confirm enabled) — sync with backend
      const response = await fetch(`${API_URL}/auth/supabase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: authData.session.access_token }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Merge guest profile data into account if it exists
        const guestRaw = localStorage.getItem('lf_guest_profile');
        if (guestRaw) {
          try {
            const guestProfile = JSON.parse(guestRaw);
            // 1. Save backup BEFORE touching the main key
            savePendingMerge(guestProfile);
            // 2. Remove the guest key — user is now registered
            localStorage.removeItem('lf_guest_profile');
            // 3. Attempt the merge
            try {
              const mergeRes = await fetch(`${API_URL}/auth/merge-guest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.access_token}` },
                body: JSON.stringify({
                  name: guestProfile.name,
                  age: guestProfile.age,
                  interests: guestProfile.interests,
                  experience_level: guestProfile.experience_level,
                  preferred_language: guestProfile.preferred_language,
                  xp: guestProfile.xp,
                  current_streak: guestProfile.current_streak ?? 1,
                  steps_completed: 5,
                }),
              });
              if (mergeRes.ok) {
                // 4. Success — clear the backup and apply an optimistic update to the
                //    locally stored user so the dashboard shows the earned XP/streak
                //    immediately without waiting for an API refetch.
                clearPendingMerge();
                const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
                localStorage.setItem('user', JSON.stringify({
                  ...storedUser,
                  points_earned: (storedUser.points_earned || 0) + (guestProfile.xp || 0),
                  current_streak: Math.max(storedUser.current_streak || 0, guestProfile.current_streak || 1),
                  max_streak: Math.max(storedUser.max_streak || 0, guestProfile.max_streak || 1),
                }));
              }
              // If merge returns non-OK: backup key stays, retry on next dashboard load
            } catch { /* network error — backup key stays for retry */ }
          } catch { /* JSON parse failed — skip merge */ }
        }

        playSound('auth_success');
        toast({
          title: t('auth:messages.register_success'),
          description: t('auth:messages.register_success_subtitle'),
          className: "bg-green-50 border-green-200 text-green-800"
        });
        setTimeout(() => navigate('/learn'), 500);
      } else {
        playSound('auth_error');
        toast({ title: t('auth:validation.registration_error'), description: data.detail || t('auth:messages.register_error'), variant: "destructive" });
      }

    } catch (error) {
      console.error('Registration error:', error);
      toast({ title: t('auth:messages.connection_error'), description: t('auth:messages.connection_error_detail'), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    playSound('ui_tap');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: 'select_account' } },
    });
    if (error) toast({ title: t('auth:validation.registration_error'), description: error.message, variant: 'destructive' });
  };

  const handleDiscordRegister = async () => {
    playSound('ui_tap');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) toast({ title: t('auth:validation.registration_error'), description: error.message, variant: 'destructive' });
  };

  const handleResend = async () => {
    if (isResending || resendDone) return;
    setIsResending(true);
    try {
      await supabase.auth.resend({ type: 'signup', email: sentToEmail });
      setResendDone(true);
      playSound('auth_success');
    } catch {
      // resend failures are non-critical — Supabase rate-limits automatically
    } finally {
      setIsResending(false);
    }
  };

  /* ── Email verification screen ───────────────────────────────────────── */
  if (emailSent) {
    return (
      <AuthShell>
        <div className="corp-card p-8 space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg mx-auto">
              <Send className="w-7 h-7 text-white" />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t('auth:verify_email.title')}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('auth:verify_email.subtitle')}
            </p>
            <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 break-all bg-indigo-50 dark:bg-indigo-900/20 rounded-xl px-3 py-2 border border-indigo-100 dark:border-indigo-500/20">
              {sentToEmail}
            </p>
          </div>

          {/* Instruction */}
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {t('auth:verify_email.instruction')}
          </p>

          {/* Spam note */}
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
            {t('auth:verify_email.spam_note')}
          </p>

          {/* Actions */}
          <div className="space-y-3 pt-1">
            <button
              onClick={() => navigate('/login')}
              className="corp-btn-primary w-full h-11 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {t('auth:verify_email.go_to_login')}
            </button>
            <button
              onClick={handleResend}
              disabled={isResending || resendDone}
              className="w-full text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-150 disabled:opacity-50 py-2"
            >
              {resendDone ? t('auth:verify_email.resend_sent') : isResending ? '...' : t('auth:verify_email.resend')}
            </button>
          </div>
        </div>
      </AuthShell>
    );
  }

  /* ── Main signup form ────────────────────────────────────────────────── */
  return (
    <AuthShell>
      {/* Back link */}
      <div className="text-center mb-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors duration-200 group"
        >
          <span className="group-hover:-translate-x-1 transition-transform duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] inline-block">←</span>
          {t('auth:register.back_to_home')}
        </Link>
      </div>

      {/* Card */}
      <div className="corp-card p-7 space-y-6 animate-in fade-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('auth:register.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('auth:register.subtitle')}
          </p>
        </div>

        {/* Social buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleGoogleRegister}
            className="corp-btn-secondary h-10 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2"
          >
            <GoogleIcon />
            {t('auth:social.google')}
          </button>
          <button
            type="button"
            onClick={handleDiscordRegister}
            className="corp-btn-secondary h-10 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2"
          >
            <SiDiscord className="w-4 h-4 text-[#5865F2] shrink-0" />
            {t('auth:social.discord')}
          </button>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-white/10" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 bg-white dark:bg-[#0f1628] text-xs font-medium text-slate-400 dark:text-slate-500">
              {t('auth:register.or')}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleRegister} className="space-y-4">

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="signup-email" className="corp-label">
              {t('auth:fields.email.label')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="signup-email"
                type="email"
                placeholder={t('auth:fields.email.placeholder')}
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="corp-input h-10 pl-10"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="signup-password" className="corp-label">
              {t('auth:fields.password.label')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                placeholder={t('auth:fields.password.placeholder')}
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                className="corp-input h-10 pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-150"
                aria-label={showPassword ? t('auth:fields.password.hide') : t('auth:fields.password.show')}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordStrength password={formData.password} />
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label htmlFor="signup-confirm" className="corp-label">
              {t('auth:fields.confirm_password.label')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="signup-confirm"
                type={showPassword ? "text" : "password"}
                placeholder={t('auth:fields.confirm_password.placeholder')}
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                className="corp-input h-10 pl-10"
                required
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="corp-btn-primary w-full h-11 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('auth:register.loading')}
              </>
            ) : (
              <>
                {t('auth:register.button')}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Login link */}
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            {t('auth:register.have_account')}{" "}
            <Link
              to="/login"
              className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors duration-150"
            >
              {t('auth:register.login_link')}
            </Link>
          </p>
        </form>
      </div>

      {/* Footer */}
      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        {t('auth:register.footer')}
      </p>
    </AuthShell>
  );
};

export default Signup;
