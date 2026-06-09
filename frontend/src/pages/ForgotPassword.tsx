import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Mail, Sparkles, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { GlassPanel } from "@/components/ui/GlassPanel";

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
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-900/20 dark:to-slate-900">
      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector variant="full" />
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8 space-y-4">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              {t('auth:forgot_password.back_to_login')}
            </Link>
          </div>

          <GlassPanel variant="strong" className="p-6 space-y-5">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-violet-500 bg-clip-text text-transparent">
                {t('auth:forgot_password.title')}
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-xs">
                {t('auth:forgot_password.subtitle')}
              </p>
            </div>

            {emailSent ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <Mail className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {t('auth:forgot_password.email_sent', { email })}
                </p>
                <Link
                  to="/login"
                  className="inline-block text-sm font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 transition-colors"
                >
                  {t('auth:forgot_password.back_to_login')}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-xs font-bold text-gray-700 dark:text-gray-200">
                    {t('auth:fields.email.label')}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
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

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-gradient-to-r from-purple-500 via-pink-500 to-violet-500 hover:from-purple-600 hover:via-pink-600 hover:to-violet-600 text-white font-bold text-base rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      {t('auth:forgot_password.sending')}
                    </span>
                  ) : (
                    t('auth:forgot_password.button')
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

export default ForgotPassword;
