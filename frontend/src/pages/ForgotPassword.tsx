import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LanguageSelector } from "@/components/ui/LanguageSelector";

const ForgotPassword = () => {
  const { t } = useTranslation(['auth']);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      });

      if (error) {
        toast({
          title: t('auth:forgot_password.error_title'),
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setEmailSent(true);
      toast({
        title: t('auth:forgot_password.success_title'),
        description: t('auth:forgot_password.success_description'),
        className: "bg-green-50 border-green-200 text-green-800",
      });
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

      {/* Corp grid background */}
      <div className="absolute inset-0 corp-grid-bg pointer-events-none" />

      {/* Ambient glow */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-indigo-400/12 dark:bg-indigo-600/12 blur-[120px] pointer-events-none" />

      {/* Language Selector */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector variant="full" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-sm">

          {/* Back link */}
          <div className="text-center mb-8 space-y-4">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              {t('auth:forgot_password.back_to_login')}
            </Link>
          </div>

          {/* Card */}
          <div className="corp-card p-7 space-y-6">

            {/* Header */}
            <div className="text-center space-y-1.5">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t('auth:forgot_password.title')}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('auth:forgot_password.subtitle')}
              </p>
            </div>

            {emailSent ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                  <Mail className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t('auth:forgot_password.email_sent', { email })}
                </p>
                <Link
                  to="/login"
                  className="inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                >
                  {t('auth:forgot_password.back_to_login')}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="corp-label">
                    {t('auth:fields.email.label')}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      placeholder={t('auth:fields.email.placeholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="corp-input h-10 pl-10"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="corp-btn-primary w-full h-11 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('auth:forgot_password.sending')}
                    </>
                  ) : (
                    t('auth:forgot_password.button')
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-slate-400 dark:text-slate-500">
            {t('auth:login.footer')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
