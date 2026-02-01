import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Welcome() {
  const { t } = useTranslation('common');
  const [step, setStep] = useState(0); // 0: Intro, 1: Name Input
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    // Attempt to load existing name if user backs into this page?
    // Not strictly necessary but good UX.
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user.name && user.name !== "Nuevo Usuario" && user.name !== "Sin Nombre") {
        // If they already have a real name, maybe skip? 
        // But the user might want to simple edit it or maybe we force them here just for the flow.
        // Let's assume we always run this flow on registration.
      }
    } catch (e) { }

    // Animation timer for "Hola"
    const timer1 = setTimeout(() => {
      setAnimateOut(true); // Fade out "Hola"
      setTimeout(() => {
        setStep(1); // Switch to content
        setAnimateOut(false); // Fade in content
      }, 500);
    }, 2000);

    return () => clearTimeout(timer1);
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name: name })
      });

      if (response.ok) {
        const updatedUser = await response.json();

        // Update local storage
        // Merge existing to keep token or other client-side props if any?
        // Usually we just overwrite the user object.
        const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
        const newUser = { ...currentUser, ...updatedUser };
        localStorage.setItem("user", JSON.stringify(newUser));

        toast({
          title: t('welcome_page.welcome_msg', { name }),
          description: t('welcome_page.space_ready'),
          className: "bg-green-50 border-green-200 text-green-800"
        });

        setTimeout(() => {
          navigate("/dashboard");
        }, 500);
      } else {
        throw new Error("Failed to update profile");
      }
    } catch (error) {
      console.error(error);
      toast({
        title: t('status.error'),
        description: t('welcome_page.error_saving'),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground overflow-hidden selection:bg-primary/20">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-customers/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className={`transition-all duration-500 transform ${animateOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
        {step === 0 ? (
          <div className="text-center">
            <h1 className="text-6xl md:text-8xl font-bold tracking-tighter bg-gradient-to-br from-primary via-foreground to-customers bg-clip-text text-transparent animate-in fade-in zoom-in duration-1000">
              {t('welcome_page.hello')}
            </h1>
          </div>
        ) : (
          <div className="w-full max-w-md px-8 animate-in slide-in-from-bottom-8 fade-in duration-700">
            <div className="mb-8 text-center space-y-2">

              <h2 className="text-3xl font-semibold tracking-tight">
                {t('welcome_page.whats_your_name')}
              </h2>
              <p className="text-muted-foreground text-lg">
                {t('welcome_page.name_desc')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('welcome_page.name_placeholder')}
                  className="h-14 text-lg px-4 bg-background/50 border-2 focus:border-primary/50 transition-all rounded-xl shadow-sm text-center"
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full h-14 text-lg rounded-xl bg-gradient-to-r from-primary to-customers hover:opacity-90 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                disabled={isLoading || !name.trim()}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    {t('common:status.saving')}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {t('buttons.start_adventure')} <ArrowRight className="w-5 h-5" />
                  </span>
                )}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}