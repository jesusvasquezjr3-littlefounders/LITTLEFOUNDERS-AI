import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Sparkles, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { GlassPanel } from "@/components/ui/GlassPanel";

const ResetPassword = () => {
  const { t } = useTranslation(['auth']);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: t('auth:validation.password_too_short'),
        description: t('auth:validation.password_min_chars'),
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: t('auth:validation.passwords_dont_match'),
        description: t('auth:validation.passwords_verify'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast({
          title: t('auth:reset_password.error_title'),
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setIsSuccess(true);
      toast({
        title: t('auth:reset_password.success_title'),
        description: t('auth:reset_password.success_description'),
        className: "bg-green-50 border-green-200 text-green-800",
      });
      setTimeout(() => navigate('/login'), 3000);
    } catch {
      toast({
        title: t('auth:messages.connection_error'),
        description: t('auth:messages.connection_error_detail'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-900/20 dark:to-slate-900">
      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector variant="full" />
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-sm">

          <GlassPanel variant="strong" className="p-6 space-y-5">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-violet-500 bg-clip-text text-transparent">
                {t('auth:reset_password.title')}
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-xs">
                {t('auth:reset_password.subtitle')}
              </p>
            </div>

            {isSuccess ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {t('auth:reset_password.success_description')}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-xs font-bold text-gray-700 dark:text-gray-200">
                    {t('auth:reset_password.new_password')}
                  </label>
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
                      {showPassword ? <EyeOff className="h-3 w-3 text-gray-500" /> : <Eye className="h-3 w-3 text-gray-500" />}
                    </Button>
                  </div>
                  <PasswordStrength password={password} />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="text-xs font-bold text-gray-700 dark:text-gray-200">
                    {t('auth:fields.confirm_password.label')}
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3 w-4 h-4 text-gray-400 z-10" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder={t('auth:fields.confirm_password.placeholder')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 h-10 bg-gray-50 dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-purple-400 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-100 dark:focus:ring-purple-900/30 transition-all text-sm"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-gradient-to-r from-purple-500 via-pink-500 to-violet-500 hover:from-purple-600 hover:via-pink-600 hover:to-violet-600 text-white font-bold text-base rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      {t('auth:reset_password.saving')}
                    </span>
                  ) : (
                    t('auth:reset_password.button')
                  )}
                </Button>
              </form>
            )}
          </GlassPanel>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
              {t('auth:login.footer')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
