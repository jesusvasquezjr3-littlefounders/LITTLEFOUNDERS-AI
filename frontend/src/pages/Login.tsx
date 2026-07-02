import { useState, useEffect } from "react";
import { SiDiscord } from "react-icons/si";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_URL } from "@/config/api";
import { useSound } from "@/contexts/SoundContext";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { setAccessToken } from "@/lib/apiClient";

const Login = () => {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { playSound } = useSound();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token || user) {
      const userType = JSON.parse(localStorage.getItem('user') || '{}')?.user_type;
      navigate(
        userType === 'admin' ? '/admin' :
        userType === 'tutor' || userType === 'parent' ? '/dashboard' :
        '/learn'
      );
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. Authenticate via Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        playSound('auth_error');
        toast({
          title: t('auth:messages.login_error'),
          description: t('auth:messages.login_error_detail'),
          variant: "destructive",
        });
        return;
      }

      // 2. Sync with backend to get app token + user profile
      // credentials: 'include' — allows the backend to set the httpOnly refresh cookie
      const response = await fetch(`${API_URL}/auth/supabase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: authData.session.access_token }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        setAccessToken(data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.access_token);

        playSound('auth_success');
        toast({
          title: t('auth:messages.login_success', { name: data.user.name }),
          description: t('auth:messages.login_success_subtitle'),
          className: "bg-green-50 border-green-200 text-green-800"
        });

        const userType = JSON.parse(localStorage.getItem('user') || '{}')?.user_type;
        navigate(
          userType === 'admin' ? '/admin' :
          userType === 'tutor' || userType === 'parent' ? '/dashboard' :
          '/learn'
        );
      } else {
        playSound('auth_error');
        toast({
          title: t('auth:messages.login_error'),
          description: data.detail || t('auth:messages.login_error_detail'),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t('auth:messages.connection_error'),
        description: t('auth:messages.connection_error_detail'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
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
        title: t('auth:messages.login_error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDiscordLogin = async () => {
    playSound('ui_tap');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast({
        title: t('auth:messages.login_error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  /* ─── SVG Google icon ─────────────────────────────────────────────────── */
  const GoogleIcon = () => (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );

  return (
    <div className="corp min-h-screen relative overflow-hidden bg-slate-50 dark:bg-[#0a0e1a]">
      {/* Language Selector */}
      <div className="absolute top-6 right-6 z-20">
        <LanguageSelector variant="full" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 py-12">
        {/* Top Brand Logo & Back */}
        <div className="text-center mb-8 space-y-4">
          <Link to="/" className="inline-block">
            <img
              src="/logo-sized.png"
              alt="LittleFounders"
              className="h-10 w-auto object-contain mx-auto dark:brightness-110"
            />
          </Link>
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors duration-200 group"
            >
              <span className="group-hover:-translate-x-1 transition-transform duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] inline-block">←</span>
              {t('auth:login.back_to_home')}
            </Link>
          </div>
        </div>

        <div className="w-full max-w-md px-2">
          {/* Card */}
          <div className="bg-white dark:bg-[#0d1426] rounded-[2.5rem] p-8 sm:p-10 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-white/5 space-y-6">

            {/* Header */}
            <div className="text-center space-y-1.5">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t('auth:login.title')}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('auth:login.subtitle')}
              </p>
            </div>

            {/* Social buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="corp-btn-secondary h-10 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2"
              >
                <GoogleIcon />
                {t('auth:social.google')}
              </button>
              <button
                type="button"
                onClick={handleDiscordLogin}
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
                  {t('auth:login.or')}
                </span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="corp-label">
                  {t('auth:fields.email.label')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    placeholder={t('auth:fields.email.placeholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="corp-input h-10 pl-10"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label htmlFor="login-password" className="corp-label">
                  {t('auth:fields.password.label')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t('auth:fields.password.placeholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
              </div>

              {/* Forgot password */}
              <div className="text-right -mt-1">
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors duration-150"
                >
                  {t('auth:login.forgot_password')}
                </Link>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="corp-btn-primary w-full h-12 rounded-full text-base font-semibold inline-flex items-center justify-center gap-2 shadow-md"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('auth:login.loading')}
                  </>
                ) : (
                  <>
                    {t('auth:login.button')}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Sign up link */}
              <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                {t('auth:login.no_account')}{" "}
                <Link
                  to="/signup"
                  className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors duration-150"
                >
                  {t('auth:login.create_account')}
                </Link>
              </p>
            </form>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {t('auth:login.footer')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;