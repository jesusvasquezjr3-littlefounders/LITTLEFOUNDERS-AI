import { useState, useEffect } from "react";
import { FcGoogle } from "react-icons/fc";
import { SiDiscord } from "react-icons/si";
import { useGoogleLogin } from '@react-oauth/google';
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, Sparkles, Rocket, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_URL } from "@/config/api";
import { useSound } from "@/contexts/SoundContext";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { getTranslatedError } from "@/utils/errorUtils";

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
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
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

        navigate('/dashboard');
      } else {
        playSound('auth_error');
        toast({
          title: t('auth:messages.login_error'),
          description: getTranslatedError(data.detail, t),
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

  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_URL}/auth/google`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: tokenResponse.access_token }),
          // Note: useGoogleLogin by default returns an access_token (Implicit flow) or code.
          // However, for backend verification with 'google-auth' library verify_oauth2_token, we ideally want an ID Token.
          // We can switch flow to 'auth-code' or just send the access_token and use a different backend verification method.
          // BUT, simplest with @react-oauth/google for ID token is using the <GoogleLogin /> component, 
          // OR using flow: 'implicit' looks for access_token. 
          // Let's check docs or common usage. 
          // Actually, 'useGoogleLogin' with default flow 'implicit' returns access_token. 
          // To get ID Token usually we use <GoogleLogin /> component or configure flow.

          // Let's try sending whatever we get to backend and see if we can adjust backend or frontend.
          // Recommendation: Use the GoogleLogin component or request 'id_token' scope?
          // Wait, 'useGoogleLogin' gives us an access token which we can use to fetch user info from Google UserInfo endpoint IN FRONTEND
          // and then send signed data to backend? No that's insecure.

          // Let's stick to the plan: Send token to backend.
          // If we use 'flow: implicit', we get access_token.
          // If backend uses `id_token.verify_oauth2_token`, it expects an OIDC JWT (ID Token).
          // Access Token != ID Token.

          // STRICT CORRECTION: To get an ID Token compatible with backend validator, 
          // we should might effectively use the <GoogleLogin> component OR use flow that returns id_token.
          // However, to customize the button completely (as we have a custom UI), we want useGoogleLogin.
          // We call UserInfo endpoint from backend using access_token? Or from frontend?
          // Safer: Send access_token to backend, backend calls https://www.googleapis.com/oauth2/v3/userinfo.

          // LET'S CHANGE BACKEND STRATEGY SLIGHTLY OR FRONTEND?
          // If I change frontend to send what I get, I need to know what I get.
          // Let's add `onSuccess` logic to just print/debug first? No, user wants solution.

          // Alternative: Use `flow: 'auth-code'` and backend exchanges code for tokens (more secure).
          // But that requires Client Secret in backend. We didn't ask user for Client Secret.

          // Alternative 2: Backend validates access_token via `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=...`.
          // This is standard for Implicit flow.
        });

        // RE-EVALUATION: The backend code I wrote uses `id_token.verify_oauth2_token`.
        // This EXPECTS a JWT.
        // `useGoogleLogin` does NOT return a JWT by default.
        // It returns `{ output: "...", access_token: "...", ... }`.

        // I will update this frontend code to fetch the Google User Info explicitly here,
        // OR better, swap to `<GoogleLogin ... />` purely? 
        // No, the user likes the custom UI buttons.

        // BEST PATH:
        // 1. Frontend gets `access_token` via `useGoogleLogin`.
        // 2. Frontend calls Google `https://www.googleapis.com/oauth2/v3/userinfo`.
        // 3. Frontend sends that info to Backend? NO, insecure (spoofing).

        // CORRECT PATH:
        // 1. Frontend gets `access_token`.
        // 2. Frontend sends `access_token` to Backend.
        // 3. Backend verifies `access_token` using Google API (not `verify_oauth2_token` which is for JWT).

        // WAIT: `useGoogleLogin` CAN return an id_token if we use 'id_token' flow? 
        // Actually, the easiest modern way with `@react-oauth/google` that allows custom button is simply:
        // passing `onSuccess` response which contains `access_token`. 
        // AND updating backend to verify access_token instead of id_token.

        // Let's Assume I will fix the backend to verify access_token, 
        // OR I can try to get the ID token here.
        // To get ID Token with custom button: 
        // We can't easily force it without `response_type='id_token'`.

        // PLAN UPDATE:
        // I will implement sending the `access_token` here.
        // I will then immediately update the backend `google_login` endpoint to support `access_token` verification 
        // using `google_requests.Request()` against tokeninfo endpoint OR just userinfo endpoint.
      } catch (err) {
        console.error(err);
      }
    },
    onError: () => {
      toast({
        title: t('auth:messages.login_error'),
        description: "Google Login Failed",
        variant: "destructive",
      });
    }
  });

  const handleDiscordLogin = () => {
    playSound('ui_tap');
    sessionStorage.setItem('discord_auth_mode', 'login');
    // Replace with your actual Client ID and Redirect URI
    const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || "YOUR_DISCORD_CLIENT_ID";
    const REDIRECT_URI = encodeURIComponent(window.location.origin + "/auth/discord/callback");
    window.location.href = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&scope=identify+email`;
  };

  // Re-implementing the actual google login handler properly
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      try {
        console.log("Google response:", tokenResponse);

        // We send the access_token to the backend
        const response = await fetch(`${API_URL}/auth/google`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          // We are sending the access_token as 'token'
          body: JSON.stringify({ token: tokenResponse.access_token, mode: 'login' }),
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

          navigate('/dashboard');
        } else {
          playSound('auth_error');
          throw new Error(getTranslatedError(data.detail, t));
        }
      } catch (error) {
        console.error(error);
        playSound('auth_error');
        toast({
          title: t('auth:messages.login_error'),
          description: error instanceof Error ? error.message : t('auth:messages.login_error_detail'),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => {
      setIsLoading(false);
      toast({
        title: t('auth:messages.login_error'),
        description: "Google popup closed or failed.",
        variant: "destructive",
      });
    }
  });

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-900/20 dark:to-slate-900">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating Coins */}
        <div className="absolute top-20 left-10 w-16 h-16 bg-yellow-400 rounded-full opacity-20 animate-bounce" style={{ animationDelay: '0s', animationDuration: '3s' }}></div>
        <div className="absolute top-40 right-20 w-12 h-12 bg-green-400 rounded-full opacity-20 animate-bounce" style={{ animationDelay: '1s', animationDuration: '4s' }}></div>
        <div className="absolute bottom-32 left-1/4 w-20 h-20 bg-blue-400 rounded-full opacity-20 animate-bounce" style={{ animationDelay: '2s', animationDuration: '5s' }}></div>

        {/* Floating Stars */}
        <Star className="absolute top-1/4 right-1/4 w-8 h-8 text-yellow-300 opacity-30 animate-pulse" />
        <Star className="absolute bottom-1/3 left-1/3 w-6 h-6 text-pink-300 opacity-30 animate-pulse" style={{ animationDelay: '1s' }} />
        <Sparkles className="absolute top-1/3 left-1/4 w-10 h-10 text-purple-300 opacity-30 animate-pulse" style={{ animationDelay: '2s' }} />

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

            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-full shadow-lg border-2 border-purple-200 dark:border-purple-500">
                <Rocket className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span className="font-bold text-lg bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                  LittleFounders
                </span>
              </div>
            </div>
          </div>

          {/* Login Card */}
          <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-white/50 dark:border-slate-700/50 p-6 space-y-5">
            {/* Header */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
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

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white font-bold text-base rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {t('auth:login.loading')}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {t('auth:login.button')}
                    <Rocket className="w-4 h-4" />
                  </span>
                )}
              </Button>

              {/* Social Login Buttons (Non-functional) */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Google Login Button */}
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => handleGoogleLogin()}
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
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Discord</span>
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
                    to="/register"
                    className="font-bold text-transparent bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text hover:from-purple-700 hover:to-pink-700 transition-all"
                  >
                    {t('auth:login.create_account')}
                  </Link>
                </p>
              </div>
            </form>
          </div>

          {/* Footer Message */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              {t('auth:login.footer')}
              <Sparkles className="w-4 h-4" />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;