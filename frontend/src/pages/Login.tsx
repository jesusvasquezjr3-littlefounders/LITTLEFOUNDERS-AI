import { useState, useEffect } from "react";
import { SiDiscord } from "react-icons/si";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, Sparkles, Rocket, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_URL } from "@/config/api";
import { useSound } from "@/contexts/SoundContext";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { GlassPanel } from "@/components/ui/GlassPanel";

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
      const response = await fetch(`${API_URL}/auth/supabase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: authData.session.access_token }),
      });

      const data = await response.json();

      if (response.ok) {
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

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-900/20 dark:to-slate-900">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient Orbs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-400/30 to-pink-400/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-400/30 to-cyan-400/30 rounded-full blur-3xl"></div>
      </div>

      {/* Language Selector - Top Right */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector variant="full" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-sm">
          {/* Logo and Back Link */}
          <div className="text-center mb-8 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors group">
              <span className="group-hover:-translate-x-1 transition-transform">←</span>
              {t('auth:login.back_to_home')}
            </Link>
          </div>

          {/* Login Card */}
          <GlassPanel variant="strong" className="p-6 space-y-5">
            {/* Header */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-violet-500 bg-clip-text text-transparent">
                {t('auth:login.title')}
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-xs">
                {t('auth:login.subtitle')}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Field */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-bold text-gray-700 dark:text-gray-200">
                  {t('auth:fields.email.label')}
                </label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity"></div>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3 w-4 h-4 text-gray-400 z-10" />
                    <Input
                      id="email"
                      type="email"
                      placeholder={t('auth:fields.email.placeholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-10 bg-gray-50 dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-purple-400 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-100 dark:focus:ring-purple-900/30 transition-all text-sm"
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
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity"></div>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3 w-4 h-4 text-gray-400 z-10" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t('auth:fields.password.placeholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-10 bg-gray-50 dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-purple-400 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-100 dark:focus:ring-purple-900/30 transition-all text-sm"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 h-7 w-7 p-0 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg z-10"
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
              </div>

              {/* Forgot Password */}
              <div className="text-right -mt-2">
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
                >
                  {t('auth:login.forgot_password')}
                </Link>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-gradient-to-r from-purple-500 via-pink-500 to-violet-500 hover:from-purple-600 hover:via-pink-600 hover:to-violet-600 text-white font-bold text-base rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {t('auth:login.loading')}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {t('auth:login.button')}
                  </span>
                )}
              </Button>

              {/* Social Login Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Google Login Button */}
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleGoogleLogin}
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
                  onClick={handleDiscordLogin}
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
                    {t('auth:login.or')}
                  </span>
                </div>
              </div>

              {/* Register Link */}
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {t('auth:login.no_account')}{" "}
                  <Link
                    to="/signup"
                    className="font-bold text-transparent bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text hover:from-purple-700 hover:to-pink-700 transition-all"
                  >
                    {t('auth:login.create_account')}
                  </Link>
                </p>
              </div>
            </form>
          </GlassPanel>

          {/* Footer Message */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
              {t('auth:login.footer')}
            </p>
          </div>
        </div>
      </div>
    </div >
  );
};

export default Login;