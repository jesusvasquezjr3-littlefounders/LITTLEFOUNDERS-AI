import { useState, useEffect } from "react";
import { SiDiscord } from "react-icons/si";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, ArrowRight, Sparkles, Star, Zap, Heart, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_URL } from "@/config/api";
import { savePendingMerge, clearPendingMerge } from "@/lib/guestProfile";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { useSound } from "@/contexts/SoundContext";
import { GlassPanel } from "@/components/ui/GlassPanel";

const Register = () => {
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

    if (token || user) {
      navigate('/learn');
    }
  }, [navigate]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password || !formData.confirmPassword) {
      toast({
        title: t('auth:validation.incomplete_data'),
        description: t('auth:validation.complete_all_fields'),
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: t('auth:validation.password_too_short'),
        description: t('auth:validation.password_min_chars'),
        variant: "destructive",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: t('auth:validation.passwords_dont_match'),
        description: t('auth:validation.passwords_verify'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // 1. Register via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        playSound('auth_error');
        toast({
          title: t('auth:validation.registration_error'),
          description: authError.message,
          variant: "destructive",
        });
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
        toast({
          title: t('auth:validation.registration_error'),
          description: data.detail || t('auth:messages.register_error'),
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: t('auth:messages.connection_error'),
        description: t('auth:messages.connection_error_detail'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    playSound('ui_tap');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      toast({
        title: t('auth:validation.registration_error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDiscordRegister = async () => {
    playSound('ui_tap');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast({
        title: t('auth:validation.registration_error'),
        description: error.message,
        variant: 'destructive',
      });
    }
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

  if (emailSent) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-cyan-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-blue-900/20 dark:to-slate-900">
        <div className="absolute top-4 right-4 z-20">
          <LanguageSelector variant="full" />
        </div>
        <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
          <div className="w-full max-w-sm">
            <GlassPanel variant="strong" className="p-8 space-y-6 text-center">
              {/* Icon */}
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/40 dark:to-blue-900/40 flex items-center justify-center shadow-lg">
                  <Send className="w-9 h-9 text-cyan-600 dark:text-cyan-400" />
                </div>
              </div>

              {/* Title */}
              <div className="space-y-3">
                <h1 className="text-2xl font-black bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {t('auth:verify_email.title')}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {t('auth:verify_email.subtitle')}
                </p>
                <p className="text-sm font-bold text-cyan-700 dark:text-cyan-400 break-all bg-cyan-50 dark:bg-cyan-900/20 rounded-lg px-3 py-2">
                  {sentToEmail}
                </p>
              </div>

              {/* Instruction */}
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {t('auth:verify_email.instruction')}
              </p>

              {/* Spam note */}
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                {t('auth:verify_email.spam_note')}
              </p>

              {/* Actions */}
              <div className="space-y-3 pt-2">
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full h-11 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-600 text-white font-bold rounded-xl shadow-lg"
                >
                  {t('auth:verify_email.go_to_login')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleResend}
                  disabled={isResending || resendDone}
                  className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400"
                >
                  {resendDone
                    ? t('auth:verify_email.resend_sent')
                    : isResending
                    ? '...'
                    : t('auth:verify_email.resend')}
                </Button>
              </div>
            </GlassPanel>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-cyan-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-blue-900/20 dark:to-slate-900">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating Shapes */}
        <div className="absolute top-10 right-10 w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full opacity-20 animate-bounce" style={{ animationDelay: '0s', animationDuration: '4s' }}></div>
        <div className="absolute top-1/3 left-10 w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-400 rounded-full opacity-20 animate-bounce" style={{ animationDelay: '1.5s', animationDuration: '5s' }}></div>
        <div className="absolute bottom-20 right-1/4 w-24 h-24 bg-gradient-to-br from-pink-400 to-rose-400 rounded-full opacity-20 animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '3.5s' }}></div>

        {/* Floating Icons */}
        <Zap className="absolute top-1/4 left-1/4 w-10 h-10 text-yellow-400 opacity-30 animate-pulse" style={{ animationDelay: '0s' }} />
        <Heart className="absolute top-1/2 right-1/3 w-8 h-8 text-pink-400 opacity-30 animate-pulse" style={{ animationDelay: '1s' }} />
        <Star className="absolute bottom-1/4 left-1/3 w-12 h-12 text-purple-400 opacity-30 animate-pulse" style={{ animationDelay: '2s' }} />
        <Sparkles className="absolute top-1/3 right-1/4 w-10 h-10 text-cyan-400 opacity-30 animate-pulse" style={{ animationDelay: '1.5s' }} />

        {/* Gradient Orbs */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-cyan-400/30 to-blue-400/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-purple-400/30 to-pink-400/30 rounded-full blur-3xl"></div>
      </div>

      {/* Language Selector - Top Right */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector variant="full" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4 py-12">
        <div className="w-full max-w-sm">
          {/* Logo and Back Link */}
          <div className="text-center mb-8 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors group">
              <span className="group-hover:-translate-x-1 transition-transform">←</span>
              {t('auth:register.back_to_home')}
            </Link>
          </div>

          {/* Register Card */}
          <GlassPanel variant="strong" className="p-6 space-y-5">
            {/* Header */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-black bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                {t('auth:register.title')}
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-xs">
                {t('auth:register.subtitle')}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Email Field */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-bold text-gray-700 dark:text-gray-200">
                  {t('auth:fields.email.label')}
                </label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity"></div>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3 w-4 h-4 text-gray-400 z-10" />
                    <Input
                      id="email"
                      type="email"
                      placeholder={t('auth:fields.email.placeholder')}
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className="pl-10 h-10 bg-gray-50 dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-cyan-400 dark:focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 dark:focus:ring-cyan-900/30 transition-all text-sm"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-bold text-gray-700 dark:text-gray-200">
                  {t('auth:fields.password.label')}
                </label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity"></div>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3 w-4 h-4 text-gray-400 z-10" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t('auth:fields.password.placeholder')}
                      value={formData.password}
                      onChange={(e) => handleChange('password', e.target.value)}
                      className="pl-10 pr-10 h-10 bg-gray-50 dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-cyan-400 dark:focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 dark:focus:ring-cyan-900/30 transition-all text-sm"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 h-7 w-7 p-0 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 rounded-lg z-10"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-3 w-3 text-gray-500" />
                      ) : (
                        <Eye className="h-3 w-3 text-gray-500" />
                      )}
                    </Button>
                  </div>
                </div>
                <PasswordStrength password={formData.password} />
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="text-xs font-bold text-gray-700 dark:text-gray-200">
                  {t('auth:fields.confirm_password.label')}
                </label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity"></div>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3 w-4 h-4 text-gray-400 z-10" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder={t('auth:fields.confirm_password.placeholder')}
                      value={formData.confirmPassword}
                      onChange={(e) => handleChange('confirmPassword', e.target.value)}
                      className="pl-10 h-10 bg-gray-50 dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-cyan-400 dark:focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 dark:focus:ring-cyan-900/30 transition-all text-sm"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-600 text-white font-bold text-base rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {t('auth:register.loading')}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {t('auth:register.button')}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>

              {/* Social Login Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Google Login Button */}
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => handleGoogleRegister()}
                  className="w-full h-10 gap-2 border-2 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{t('auth:social.google')}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 gap-2 border-2 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  onClick={handleDiscordRegister}
                >
                  <SiDiscord className="w-4 h-4 text-[#5865F2]" />
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{t('auth:social.discord')}</span>
                </Button>
              </div>

              {/* Divider */}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t-2 border-gray-200 dark:border-slate-600"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 bg-white dark:bg-slate-800 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {t('auth:register.or')}
                  </span>
                </div>
              </div>

              {/* Login Link */}
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {t('auth:register.have_account')}{" "}
                  <Link
                    to="/login"
                    className="font-bold text-transparent bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text hover:from-cyan-700 hover:to-blue-700 transition-all"
                  >
                    {t('auth:register.login_link')}
                  </Link>
                </p>
              </div>
            </form>
          </GlassPanel>

          {/* Footer Message */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              {t('auth:register.footer')}
              <Sparkles className="w-4 h-4" />
            </p>
          </div>
        </div>
      </div>
    </div >
  );
};

export default Register;
