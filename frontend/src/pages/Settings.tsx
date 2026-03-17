import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    User as UserIcon,
    AtSign,
    Mail,
    Lock,
    Calendar,
    Users,
    Globe,
    Save,
    Loader2,
    ChevronRight,
    Shield,
    CreditCard,
    LogOut
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { API_URL } from "@/config/api";
import { useTranslation } from "react-i18next";
import { AvatarDisplay } from "@/components/avatar/AvatarDisplay";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { GlassPanel } from "@/components/ui/GlassPanel";

// Setting Item Component
const SettingItem = ({
    icon: Icon,
    label,
    children,
    className,
    description
}: {
    icon: any,
    label: string,
    children?: React.ReactNode,
    className?: string,
    description?: string
}) => (
    <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 hover:bg-white/5 dark:hover:bg-black/10 transition-colors first:rounded-t-[2rem] last:rounded-b-[2rem]", className)}>
        <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0 shadow-lg border border-indigo-500/20">
                <Icon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex flex-col gap-0.5">
                <span className="font-black text-slate-800 dark:text-slate-100 text-sm uppercase tracking-widest">{label}</span>
                {description && <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{description}</span>}
            </div>
        </div>
        <div className="w-full md:w-auto min-w-[200px] flex justify-end">
            {children}
        </div>
    </div>
);

// Section Container
const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="space-y-4">
        <h3 className="px-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{title}</h3>
        <GlassPanel variant="default" className="liquid-glass-subtle overflow-hidden divide-y divide-black/5 dark:divide-white/5 rounded-3xl border-none shadow-xl">
            {children}
        </GlassPanel>
    </div>
);

const Settings = () => {
    const { t, i18n } = useTranslation(['settings', 'common']);
    const { toast } = useToast();
    const navigate = useNavigate();

    // User state
    const [user, setUser] = useState<any>(null);

    // Form fields
    const [username, setUsername] = useState("");
    const [name, setName] = useState("");
    const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
    const [gender, setGender] = useState("");
    const [preferredLanguage, setPreferredLanguage] = useState("es");

    // Password Change State
    const [isPasswordOpen, setIsPasswordOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // Loading states
    const [isSaving, setIsSaving] = useState(false);
    const [usernameError, setUsernameError] = useState("");

    // Map i18n language to date-fns locale
    const dateLocale = i18n.language === 'en' ? enUS : es;

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (userData) {
            const parsed = JSON.parse(userData);
            setUser(parsed);
            setUsername(parsed.username || "");
            setName(parsed.name || "");
            // Check if birth_date is valid
            if (parsed.birth_date) {
                const date = new Date(parsed.birth_date);
                if (!isNaN(date.getTime())) {
                    setBirthDate(date);
                }
            }
            setGender(parsed.gender || "");
            setPreferredLanguage(parsed.preferred_language || "es");
        }
    }, []);

    const validateUsername = (value: string) => {
        if (!value) {
            setUsernameError("");
            return true;
        }
        const regex = /^[a-z0-9_-]{3,30}$/;
        if (!regex.test(value.toLowerCase())) {
            setUsernameError(t('settings:identity.username.error'));
            return false;
        }
        setUsernameError("");
        return true;
    };

    const handleSaveProfile = async () => {
        if (username && !validateUsername(username)) return;

        setIsSaving(true);
        try {
            const token = localStorage.getItem('token');

            const updateData: Record<string, any> = {};
            if (name !== user.name) updateData.name = name;
            if (username !== (user.username || '')) updateData.username = username || null;

            const currentBirthDateStr = user.birth_date ? user.birth_date.split('T')[0] : '';
            const newBirthDateStr = birthDate ? format(birthDate, "yyyy-MM-dd") : '';

            if (newBirthDateStr !== currentBirthDateStr) updateData.birth_date = newBirthDateStr || null;

            if (gender !== (user.gender || '')) updateData.gender = gender || null;
            if (preferredLanguage !== (user.preferred_language || 'es')) updateData.preferred_language = preferredLanguage;

            const response = await fetch(`${API_URL}/auth/me`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || t('settings:actions.error_generic'));
            }

            const updatedUser = await response.json();
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            const newUser = { ...currentUser, ...updatedUser };
            localStorage.setItem('user', JSON.stringify(newUser));
            setUser(newUser);

            if (preferredLanguage !== i18n.language) {
                i18n.changeLanguage(preferredLanguage);
            }

            toast({
                title: t('settings:actions.success_title'),
                description: t('settings:actions.success_desc'),
                className: "bg-green-500 text-white border-none"
            });
        } catch (error: any) {
            let errorMessage = t('settings:actions.error_generic');
            if (error.message === 'Failed to fetch') {
                errorMessage = t('settings:actions.error_network');
            } else if (error.message) {
                errorMessage = error.message;
            }
            toast({
                title: t('settings:actions.error_title'),
                description: errorMessage,
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            toast({ title: t('settings:actions.error_title'), description: t('settings:account.password.error.required'), variant: "destructive" });
            return;
        }

        if (newPassword !== confirmPassword) {
            toast({ title: t('settings:actions.error_title'), description: t('settings:account.password.error.mismatch'), variant: "destructive" });
            return;
        }

        if (newPassword.length < 8) {
            toast({ title: t('settings:actions.error_title'), description: t('settings:account.password.error.length'), variant: "destructive" });
            return;
        }

        setIsChangingPassword(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || t('settings:account.password.error.generic'));
            }

            toast({ title: t('settings:actions.success_title'), description: t('settings:account.password.success') });
            setIsPasswordOpen(false);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");

        } catch (error: any) {
            toast({
                title: t('settings:actions.error_title'),
                description: error.message || t('settings:account.password.error.generic'),
                variant: "destructive"
            });
        } finally {
            setIsChangingPassword(false);
        }
    };

    if (!user) return null;
    const isEmailAuth = user.auth_provider === 'email' || !user.auth_provider;

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto pb-24 px-4 pt-8 animate-in fade-in duration-500">
                
                {/* ── Main Layout (3:9) ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* ── Sidebar (3/12) ── */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Compact Profile Card */}
                        <GlassPanel variant="default" className="liquid-glass-strong p-6 rounded-[2.5rem] flex flex-col items-center text-center gap-4 shadow-2xl">
                            <div className="relative group">
                                <div
                                    className="absolute -inset-1 rounded-full blur-lg opacity-40 group-hover:opacity-100 transition duration-700"
                                    style={{
                                        background: user.avatar_config?.backgroundColor?.[0] && user.avatar_config.backgroundColor[0] !== 'none'
                                            ? `#${user.avatar_config.backgroundColor[0]}`
                                            : 'linear-gradient(to right, #6366f1, #a855f7)'
                                    }}
                                />
                                <div className="relative">
                                    <AvatarDisplay
                                        config={user.avatar_config}
                                        size={96}
                                        showCTA={false}
                                        linkToEdit={true}
                                        className="z-10 bg-white/10 dark:bg-black/20"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <h1 className="text-xl font-black text-slate-900 dark:text-white truncate max-w-[160px]">
                                    {name || user.name}
                                </h1>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">@{username || t('common:status.not_configured')}</p>
                            </div>
                        </GlassPanel>

                        {/* Navigation Sidebar */}
                        <GlassPanel variant="default" className="liquid-glass-subtle p-2 rounded-[2rem] overflow-hidden hidden lg:block">
                            <div className="flex flex-col gap-1">
                                {[
                                    { icon: UserIcon, label: t('settings:identity.title'), id: 'identity' },
                                    { icon: Mail, label: t('settings:account.title'), id: 'account' },
                                    { icon: Lock, label: t('settings:account.password.label'), id: 'security' },
                                    { icon: Globe, label: t('settings:account.language'), id: 'prefs' }
                                ].map((tab) => (
                                    <button 
                                        key={tab.id}
                                        onClick={() => {
                                            const el = document.getElementById(tab.id);
                                            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }}
                                        className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/10 dark:hover:bg-black/10 transition-all group text-left"
                                    >
                                        <tab.icon className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">{tab.label}</span>
                                    </button>
                                ))}
                            </div>
                        </GlassPanel>
                    </div>

                    {/* ── Main content area (9/12) ── */}
                    <div className="lg:col-span-9 space-y-10">
                        
                        {/* Identity Section */}
                        <div id="identity">
                            <Section title={t('settings:identity.title')}>
                                <SettingItem icon={UserIcon} label={t('settings:identity.name.label')}>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="h-12 border-2 border-black/5 dark:border-white/5 bg-white/5 dark:bg-black/20 rounded-2xl px-4 font-black focus-visible:ring-indigo-500 text-slate-900 dark:text-white"
                                        placeholder={t('settings:identity.name.placeholder')}
                                    />
                                </SettingItem>
                                <SettingItem icon={AtSign} label={t('settings:identity.username.label')} description={usernameError ? usernameError : ""}>
                                    <Input
                                        value={username}
                                        onChange={(e) => {
                                            const val = e.target.value.toLowerCase();
                                            setUsername(val);
                                            validateUsername(val);
                                        }}
                                        className={cn(
                                            "h-12 border-2 border-black/5 dark:border-white/5 bg-white/5 dark:bg-black/20 rounded-2xl px-4 font-black focus-visible:ring-indigo-500 font-mono uppercase",
                                            usernameError ? "text-red-500 border-red-500/20" : "text-indigo-600 dark:text-indigo-400"
                                        )}
                                        placeholder={t('settings:identity.username.placeholder')}
                                    />
                                </SettingItem>
                                <SettingItem icon={Calendar} label={t('settings:identity.birthday.label')}>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full h-12 justify-between px-4 rounded-2xl border-2 border-black/5 dark:border-white/5 bg-white/5 dark:bg-black/20 font-black",
                                                    !birthDate && "text-slate-300"
                                                )}
                                            >
                                                {birthDate ? (
                                                    format(birthDate, t('settings:identity.birthday.display_format'), { locale: dateLocale })
                                                ) : (
                                                    <span>{t('settings:identity.birthday.select')}</span>
                                                )}
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-4 rounded-[2rem] liquid-glass-strong shadow-3xl border-white/10" align="end">
                                            {/* (Existing Calendar Selection Logic is inside Section logic above) */}
                                            <div className="flex gap-2 mb-4">
                                                <Select
                                                    value={birthDate ? birthDate.getFullYear().toString() : new Date().getFullYear().toString()}
                                                    onValueChange={(year) => {
                                                        const newDate = birthDate ? new Date(birthDate) : new Date();
                                                        newDate.setFullYear(parseInt(year));
                                                        setBirthDate(newDate);
                                                    }}
                                                >
                                                    <SelectTrigger className="w-[120px] rounded-xl font-bold bg-white/10">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl liquid-glass pb-10">
                                                        {Array.from({ length: 120 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                                                            <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Select
                                                    value={birthDate ? birthDate.getMonth().toString() : new Date().getMonth().toString()}
                                                    onValueChange={(month) => {
                                                        const newDate = birthDate ? new Date(birthDate) : new Date();
                                                        newDate.setMonth(parseInt(month));
                                                        setBirthDate(newDate);
                                                    }}
                                                >
                                                    <SelectTrigger className="w-[140px] rounded-xl font-bold bg-white/10">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl liquid-glass pb-10">
                                                        {Array.from({ length: 12 }, (_, i) => i).map((month) => (
                                                            <SelectItem key={month} value={month.toString()}>
                                                                {format(new Date(2000, month, 1), "MMMM", { locale: dateLocale })}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <CalendarComponent
                                                mode="single"
                                                selected={birthDate}
                                                onSelect={setBirthDate}
                                                locale={dateLocale}
                                                className="rounded-xl"
                                                month={birthDate || new Date()}
                                                onMonthChange={setBirthDate}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </SettingItem>
                            </Section>
                        </div>

                        {/* Account Section */}
                        <div id="account">
                            <Section title={t('settings:account.title')}>
                                <SettingItem icon={Mail} label={t('settings:account.email')}>
                                    <div className="flex items-center gap-3 bg-white/5 dark:bg-black/20 p-3 px-5 rounded-2xl border-2 border-black/5 dark:border-white/5">
                                        <span className="text-sm font-black text-slate-500">{user.email}</span>
                                        <Shield className="w-4 h-4 text-green-500" />
                                    </div>
                                </SettingItem>
                                <SettingItem icon={Globe} label={t('settings:account.language')}>
                                    <Select value={preferredLanguage} onValueChange={setPreferredLanguage}>
                                        <SelectTrigger className="h-12 w-full max-w-[200px] border-2 border-black/5 dark:border-white/5 bg-white/5 dark:bg-black/20 rounded-2xl px-5 font-black focus:ring-indigo-500">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl liquid-glass">
                                            <SelectItem value="es">Español</SelectItem>
                                            <SelectItem value="en">English</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </SettingItem>
                            </Section>
                        </div>

                        {/* Security Section (Floating / Separate) */}
                        <div id="security">
                            <Section title={t('settings:account.password.label')}>
                                <SettingItem icon={Lock} label={t('settings:account.password.dialog.title')}>
                                    {isEmailAuth ? (
                                        <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
                                            <DialogTrigger asChild>
                                                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-12 px-8 font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                                                    {t('settings:account.password.change')}
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-md rounded-[2.5rem] liquid-glass-strong border-white/10 shadow-3xl">
                                                <DialogHeader>
                                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">{t('settings:account.password.dialog.title')}</DialogTitle>
                                                </DialogHeader>
                                                <div className="space-y-4 py-4">
                                                    <div className="space-y-2">
                                                        <Label className="font-black uppercase tracking-widest text-[10px] text-slate-500">{t('settings:account.password.dialog.current')}</Label>
                                                        <Input
                                                            type="password"
                                                            value={currentPassword}
                                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                                            className="h-12 rounded-2xl bg-white/5 border-black/5 focus-visible:ring-indigo-500"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="font-black uppercase tracking-widest text-[10px] text-slate-500">{t('settings:account.password.dialog.new')}</Label>
                                                        <Input
                                                            type="password"
                                                            value={newPassword}
                                                            onChange={(e) => setNewPassword(e.target.value)}
                                                            className="h-12 rounded-2xl bg-white/5 border-black/5 focus-visible:ring-indigo-500"
                                                        />
                                                    </div>
                                                    <Button
                                                        className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20"
                                                        onClick={handleChangePassword}
                                                    >
                                                        {isChangingPassword ? <Loader2 className="w-5 h-5 animate-spin" /> : t('settings:account.password.dialog.submit')}
                                                    </Button>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    ) : (
                                        <div className="flex items-center gap-2 bg-green-500/10 text-green-600 p-3 px-5 rounded-2xl font-black text-xs uppercase">
                                            <Globe className="w-4 h-4" />
                                            {t('settings:account.social')} ({user.auth_provider})
                                        </div>
                                    )}
                                </SettingItem>
                            </Section>
                        </div>

                        {/* FINAL SAVE BAR */}
                        <div className="pt-6 sticky bottom-8 z-20">
                            <GlassPanel variant="default" className="liquid-glass-strong p-4 rounded-3xl border-indigo-500/20 shadow-2xl flex justify-between items-center gap-6">
                                <div className="hidden md:block">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('settings:actions.success_desc')}</p>
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('settings:identity.title')} & {t('settings:account.title')}</p>
                                </div>
                                <Button
                                    onClick={handleSaveProfile}
                                    disabled={isSaving || !!usernameError}
                                    className="flex-1 md:flex-none md:min-w-[240px] h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    {isSaving ? (
                                        <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> {t('settings:actions.saving')}</>
                                    ) : (
                                        <><Save className="w-5 h-5 mr-3" /> {t('settings:actions.save')}</>
                                    )}
                                </Button>
                            </GlassPanel>
                        </div>

                    </div>
                </div>

            </div>
        </DashboardLayout>
    );
};

export default Settings;
