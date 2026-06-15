import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { LanguageSelector } from "@/components/ui/LanguageSelector";

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
    <div className="corp min-h-screen relative overflow-hidden bg-gradient-to-b from-indigo-50/80 via-white to-white dark:from-[#0b1124] dark:via-[#070b14] dark:to-[#070b14]">
      <div className="absolute inset-0 corp-grid-bg pointer-events-none" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-indigo-400/12 dark:bg-indigo-600/12 blur-[120px] pointer-events-none" />

      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector variant="full" />
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-sm">

          <div className="corp-card p-6 space-y-5">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t('auth:reset_password.title')}
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-xs">
                {t('auth:reset_password.subtitle')}
              </p>
            </div>

            {isSuccess ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t('auth:reset_password.success_description')}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="password" className="corp-label">
                    {t('auth:reset_password.new_password')}
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3 w-4 h-4 text-slate-400 z-10" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t('auth:fields.password.placeholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="corp-input h-10 pl-10 pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 h-7 w-7 p-0 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg z-10"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                  </div>
                  <PasswordStrength password={password} />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="corp-label">
                    {t('auth:fields.confirm_password.label')}
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3 w-4 h-4 text-slate-400 z-10" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder={t('auth:fields.confirm_password.placeholder')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="corp-input h-10 pl-10"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="corp-btn-primary w-full h-11 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
              {t('auth:login.footer')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
