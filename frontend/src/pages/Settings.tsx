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
    Globe,
    Save,
    Loader2,
    ChevronRight,
    Shield,
    Check
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { API_URL } from "@/config/api";
import { supabase } from "@/lib/supabase";
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
    <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 transition-colors", className)}>
        <div className="flex items-center gap-5">
            <div className="corp-icon-chip w-12 h-12 shrink-0">
                <Icon className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
                <span className="corp-label">{label}</span>
                {description && <span className="text-xs font-semibold text-red-500">{description}</span>}
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
        <div className="px-1">
            <span className="corp-eyebrow">{title}</span>
        </div>
        <div className="corp-panel overflow-hidden divide-y divide-slate-200 dark:divide-white/5">
            {children}
        </div>
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

    // Email Change State
    const [isEmailOpen, setIsEmailOpen] = useState(false);
    const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [isChangingEmail, setIsChangingEmail] = useState(false);
    const [emailChangeSent, setEmailChangeSent] = useState(false);

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
            // Verify current password via Edge Function (server-side, no client session side-effects)
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error(t('settings:account.password.error.generic'));

            const verifyRes = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-password`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${session.access_token}`,
                        "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({ password: currentPassword }),
                }
            );
            const { valid } = await verifyRes.json();
            if (!valid) throw new Error(t('settings:account.password.error.wrong_current'));

            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw new Error(error.message || t('settings:account.password.error.generic'));

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

    const handleChangeEmail = async () => {
        if (!emailCurrentPassword.trim() || !newEmail.trim()) {
            toast({ title: t('settings:actions.error_title'), description: t('settings:account.email_change.error.required'), variant: "destructive" });
            return;
        }
        if (newEmail.toLowerCase() === user.email.toLowerCase()) {
            toast({ title: t('settings:actions.error_title'), description: t('settings:account.email_change.error.same'), variant: "destructive" });
            return;
        }

        setIsChangingEmail(true);
        try {
            // Verify current password via Edge Function (server-side, no client session side-effects)
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error(t('settings:account.email_change.error.generic'));

            const verifyRes = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-password`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${session.access_token}`,
                        "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({ password: emailCurrentPassword }),
                }
            );
            const { valid } = await verifyRes.json();
            if (!valid) throw new Error(t('settings:account.email_change.error.wrong_password'));

            // 1. Update in Supabase Auth (sends confirmation email to new address)
            const { error } = await supabase.auth.updateUser(
                { email: newEmail },
                { emailRedirectTo: `${window.location.origin}/auth/callback?type=email_change` }
            );

            if (error) throw new Error(error.message);

            // 2. Sync new email to backend DB (optimistic — confirmed via Supabase email)
            const token = localStorage.getItem('token');
            await fetch(`${API_URL}/auth/me`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ email: newEmail.toLowerCase().trim() })
            });

            // Update localStorage
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            localStorage.setItem('user', JSON.stringify({ ...currentUser, email: newEmail.toLowerCase().trim() }));
            setUser((prev: any) => ({ ...prev, email: newEmail.toLowerCase().trim() }));

            setEmailCurrentPassword("");
            setEmailChangeSent(true);
        } catch (error: any) {
            toast({
                title: t('settings:actions.error_title'),
                description: error.message || t('settings:account.email_change.error.generic'),
                variant: "destructive"
            });
        } finally {
            setIsChangingEmail(false);
        }
    };

    if (!user) return null;
    const isEmailAuth = user.auth_provider === 'email' || !user.auth_provider;

    return (
        <DashboardLayout>
            <div className="corp max-w-6xl mx-auto pb-24 px-4 pt-8 animate-in fade-in duration-500 space-y-8">

                {/* Premium Page Header */}
                <div className="corp-panel px-5 py-5 md:px-7 md:py-6 flex items-center gap-5">
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-xl shadow-indigo-500/25 flex-shrink-0">
                        <Shield className="w-6 h-6 md:w-7 md:h-7 text-white" />
                    </div>
                    <div>
                        <span className="corp-eyebrow">{t('common:app_name')}</span>
                        <h1 className="corp-display mt-1 text-xl md:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                            {t('settings:title')}
                        </h1>
                    </div>
                </div>

                {/* ── Main Layout (3:9) ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* ── Sidebar (3/12) ── */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Compact Profile Card */}
                        <div className="corp-card p-6 flex flex-col items-center text-center gap-4">
                            <AvatarDisplay
                                config={user.avatar_config}
                                size={96}
                                showCTA={false}
                                linkToEdit={true}
                                className="z-10"
                            />
                            <div className="space-y-1">
                                <h1 className="corp-display text-xl font-bold text-slate-900 dark:text-white truncate max-w-[160px]">
                                    {name || user.name}
                                </h1>
                                <p className="text-xs font-mono text-slate-500 dark:text-slate-400">@{username || t('common:status.not_configured')}</p>
                            </div>
                        </div>

                        {/* Navigation Sidebar */}
                        <div className="corp-card p-2 overflow-hidden hidden lg:block">
                            <div className="flex flex-col gap-1">
                                {([
                                    { icon: UserIcon, label: t('settings:identity.title'), id: 'identity', iconCls: "group-hover:text-indigo-500" },
                                    { icon: Mail, label: t('settings:account.title'), id: 'account', iconCls: "group-hover:text-blue-500" },
                                    { icon: Lock, label: t('settings:account.password.label'), id: 'security', iconCls: "group-hover:text-emerald-500" },
                                    { icon: Globe, label: t('settings:account.language'), id: 'prefs', iconCls: "group-hover:text-cyan-500" }
                                ] as const).map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            const el = document.getElementById(tab.id);
                                            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }}
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all group text-left"
                                    >
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-all">
                                            <tab.icon className={cn("w-4 h-4 text-slate-400 transition-colors", tab.iconCls)} />
                                        </div>
                                        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{tab.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
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
                                        className="corp-input h-12"
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
                                            "corp-input h-12 font-mono",
                                            usernameError && "corp-input--error"
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
                                                    "corp-input h-12 w-full flex items-center justify-between",
                                                    !birthDate && "text-slate-400 dark:text-slate-500"
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
                                        <PopoverContent className="corp w-auto p-4 corp-panel rounded-2xl" align="end">
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
                                                    <SelectTrigger className="corp-input w-[120px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="corp rounded-xl pb-10">
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
                                                    <SelectTrigger className="corp-input w-[140px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="corp rounded-xl pb-10">
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
                                    {isEmailAuth ? (
                                        <Dialog open={isEmailOpen} onOpenChange={(open) => { setIsEmailOpen(open); if (!open) { setEmailCurrentPassword(""); setNewEmail(""); setEmailChangeSent(false); } }}>
                                            <DialogTrigger asChild>
                                                <button className="corp-panel-subtle flex items-center gap-3 p-3 px-5 hover:border-blue-400/30 transition-all group">
                                                    <span className="text-sm font-semibold text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300">{user.email}</span>
                                                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                                </button>
                                            </DialogTrigger>
                                            <DialogContent className="corp corp-dialog rounded-3xl sm:max-w-md p-8">
                                                <DialogHeader className="mb-6">
                                                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4 mx-auto md:mx-0">
                                                        <Mail className="w-7 h-7 text-blue-500" />
                                                    </div>
                                                    <DialogTitle className="corp-display text-2xl font-bold text-slate-900 dark:text-white">{t('settings:account.email_change.title')}</DialogTitle>
                                                </DialogHeader>
                                                {emailChangeSent ? (
                                                    <div className="text-center space-y-6 py-6 animate-in fade-in zoom-in-95 duration-500">
                                                        <div className="w-20 h-20 mx-auto bg-emerald-500/10 rounded-full flex items-center justify-center relative">
                                                            <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
                                                            <Check className="w-10 h-10 text-emerald-500 relative z-10" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <p className="text-lg font-bold text-slate-900 dark:text-white">{t('settings:account.email_change.sent_title')}</p>
                                                            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[280px] mx-auto leading-relaxed">{t('settings:account.email_change.sent_desc', { email: newEmail })}</p>
                                                        </div>
                                                        <Button className="corp-btn-secondary w-full h-12 rounded-xl text-sm font-semibold" onClick={() => { setIsEmailOpen(false); setEmailChangeSent(false); setNewEmail(""); }}>
                                                            {t('common:close')}
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-5">
                                                        <div className="space-y-1.5">
                                                            <Label className="corp-label">{t('settings:account.email_change.current')}</Label>
                                                            <div className="corp-panel-subtle h-12 flex items-center px-5 text-sm font-medium text-slate-500 dark:text-slate-400 italic opacity-70 cursor-not-allowed">{user.email}</div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="corp-label">{t('settings:account.email_change.new')}</Label>
                                                            <Input
                                                                type="email"
                                                                value={newEmail}
                                                                onChange={(e) => setNewEmail(e.target.value)}
                                                                placeholder="nuevo@email.com"
                                                                className="corp-input h-12"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="corp-label">{t('settings:account.email_change.password_confirm')}</Label>
                                                            <Input
                                                                type="password"
                                                                value={emailCurrentPassword}
                                                                onChange={(e) => setEmailCurrentPassword(e.target.value)}
                                                                placeholder="••••••••"
                                                                className="corp-input h-12"
                                                            />
                                                        </div>
                                                        <Button
                                                            className="corp-btn-primary w-full h-12 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            onClick={handleChangeEmail}
                                                            disabled={isChangingEmail}
                                                        >
                                                            {isChangingEmail ? <Loader2 className="w-5 h-5 animate-spin" /> : t('settings:account.email_change.button')}
                                                        </Button>
                                                    </div>
                                                )}
                                            </DialogContent>
                                        </Dialog>
                                    ) : (
                                        <div className="corp-panel-subtle flex items-center gap-3 p-3 px-5">
                                            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{user.email}</span>
                                            <Shield className="w-4 h-4 text-emerald-500" />
                                        </div>
                                    )}
                                </SettingItem>
                                <SettingItem icon={Globe} label={t('settings:account.language')}>
                                    <Select value={preferredLanguage} onValueChange={setPreferredLanguage}>
                                        <SelectTrigger className="corp-input h-12 w-full max-w-[200px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="corp rounded-xl">
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
                                        <Dialog open={isPasswordOpen} onOpenChange={(open) => { setIsPasswordOpen(open); if (!open) { setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); } }}>
                                            <DialogTrigger asChild>
                                                <Button className="corp-btn-primary h-12 px-8 rounded-xl text-sm font-semibold">
                                                    {t('settings:account.password.change')}
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="corp corp-dialog rounded-3xl sm:max-w-md p-8">
                                                <DialogHeader className="mb-6">
                                                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4 mx-auto md:mx-0">
                                                        <Lock className="w-7 h-7 text-emerald-500" />
                                                    </div>
                                                    <DialogTitle className="corp-display text-2xl font-bold text-slate-900 dark:text-white">{t('settings:account.password.dialog.title')}</DialogTitle>
                                                </DialogHeader>
                                                <div className="space-y-5">
                                                    <div className="space-y-1.5">
                                                        <Label className="corp-label">{t('settings:account.password.dialog.current')}</Label>
                                                        <Input
                                                            type="password"
                                                            value={currentPassword}
                                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                                            placeholder="••••••••"
                                                            className="corp-input h-12"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="corp-label">{t('settings:account.password.dialog.new')}</Label>
                                                        <Input
                                                            type="password"
                                                            value={newPassword}
                                                            onChange={(e) => setNewPassword(e.target.value)}
                                                            placeholder="••••••••"
                                                            className="corp-input h-12"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="corp-label">{t('settings:account.password.dialog.confirm')}</Label>
                                                        <Input
                                                            type="password"
                                                            value={confirmPassword}
                                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                                            placeholder="••••••••"
                                                            className="corp-input h-12"
                                                        />
                                                    </div>
                                                    <Button
                                                        className="corp-btn-primary w-full h-12 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        onClick={handleChangePassword}
                                                        disabled={isChangingPassword}
                                                    >
                                                        {isChangingPassword ? <Loader2 className="w-5 h-5 animate-spin" /> : t('settings:account.password.dialog.submit')}
                                                    </Button>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    ) : (
                                        <div className="corp-badge corp-badge--success">
                                            <Globe className="w-4 h-4" />
                                            {t('settings:account.social')} ({user.auth_provider})
                                        </div>
                                    )}
                                </SettingItem>
                            </Section>
                        </div>

                        {/* FINAL SAVE BAR */}
                        <div className="pt-6 sticky bottom-6 z-20">
                            <div className="corp-panel p-4 flex justify-between items-center gap-4">
                                <div className="hidden md:flex items-center gap-3">
                                    <div className="corp-icon-chip w-9 h-9">
                                        <Save className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="corp-eyebrow">{t('settings:title')}</p>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t('settings:identity.title')} · {t('settings:account.title')}</p>
                                    </div>
                                </div>
                                <Button
                                    onClick={handleSaveProfile}
                                    disabled={isSaving || !!usernameError}
                                    className="corp-btn-primary flex-1 md:flex-none md:min-w-[220px] h-12 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSaving ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /> {t('settings:actions.saving')}</>
                                    ) : (
                                        <><Save className="w-5 h-5" /> {t('settings:actions.save')}</>
                                    )}
                                </Button>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </DashboardLayout>
    );
};

export default Settings;
