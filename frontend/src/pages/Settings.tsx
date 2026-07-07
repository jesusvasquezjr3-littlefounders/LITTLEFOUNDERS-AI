import { useState, useEffect } from "react";
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
    Check,
    Camera,
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

const Settings = () => {
    const { t, i18n } = useTranslation(['settings', 'common']);
    const { toast } = useToast();
    const navigate = useNavigate();

    const [user, setUser] = useState<any>(null);

    const [username, setUsername] = useState("");
    const [name, setName] = useState("");
    const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
    const [gender, setGender] = useState("");
    const [preferredLanguage, setPreferredLanguage] = useState("es");

    const [isPasswordOpen, setIsPasswordOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    const [isEmailOpen, setIsEmailOpen] = useState(false);
    const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [isChangingEmail, setIsChangingEmail] = useState(false);
    const [emailChangeSent, setEmailChangeSent] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [usernameError, setUsernameError] = useState("");
    const [activeSection, setActiveSection] = useState("identity");

    const dateLocale = i18n.language === 'en' ? enUS : es;

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (userData) {
            const parsed = JSON.parse(userData);
            setUser(parsed);
            setUsername(parsed.username || "");
            setName(parsed.name || "");
            if (parsed.birth_date) {
                const date = new Date(parsed.birth_date);
                if (!isNaN(date.getTime())) setBirthDate(date);
            }
            setGender(parsed.gender || "");
            setPreferredLanguage(parsed.preferred_language || "es");
        }
    }, []);

    const validateUsername = (value: string) => {
        if (!value) { setUsernameError(""); return true; }
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
            if (preferredLanguage !== i18n.language) i18n.changeLanguage(preferredLanguage);
            toast({
                title: t('settings:actions.success_title'),
                description: t('settings:actions.success_desc'),
                className: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-900 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/20",
            });
        } catch (error: any) {
            let errorMessage = t('settings:actions.error_generic');
            if (error.message === 'Failed to fetch') errorMessage = t('settings:actions.error_network');
            else if (error.message) errorMessage = error.message;
            toast({ title: t('settings:actions.error_title'), description: errorMessage, variant: "destructive" });
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
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error(t('settings:account.password.error.generic'));
            const verifyRes = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-password`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY },
                    body: JSON.stringify({ password: currentPassword }),
                }
            );
            const { valid } = await verifyRes.json();
            if (!valid) throw new Error(t('settings:account.password.error.wrong_current'));
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw new Error(error.message || t('settings:account.password.error.generic'));
            toast({ title: t('settings:actions.success_title'), description: t('settings:account.password.success') });
            setIsPasswordOpen(false);
            setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
        } catch (error: any) {
            toast({ title: t('settings:actions.error_title'), description: error.message || t('settings:account.password.error.generic'), variant: "destructive" });
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
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error(t('settings:account.email_change.error.generic'));
            const verifyRes = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-password`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY },
                    body: JSON.stringify({ password: emailCurrentPassword }),
                }
            );
            const { valid } = await verifyRes.json();
            if (!valid) throw new Error(t('settings:account.email_change.error.wrong_password'));
            const { error } = await supabase.auth.updateUser(
                { email: newEmail },
                { emailRedirectTo: `${window.location.origin}/auth/callback?type=email_change` }
            );
            if (error) throw new Error(error.message);
            const token = localStorage.getItem('token');
            await fetch(`${API_URL}/auth/me`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ email: newEmail.toLowerCase().trim() })
            });
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            localStorage.setItem('user', JSON.stringify({ ...currentUser, email: newEmail.toLowerCase().trim() }));
            setUser((prev: any) => ({ ...prev, email: newEmail.toLowerCase().trim() }));
            setEmailCurrentPassword("");
            setEmailChangeSent(true);
        } catch (error: any) {
            toast({ title: t('settings:actions.error_title'), description: error.message || t('settings:account.email_change.error.generic'), variant: "destructive" });
        } finally {
            setIsChangingEmail(false);
        }
    };

    if (!user) return null;
    const isEmailAuth = user.auth_provider === 'email' || !user.auth_provider;

    const NAV_ITEMS = [
        { id: 'identity', icon: UserIcon, label: t('settings:identity.title') },
        { id: 'account', icon: Mail, label: t('settings:account.title') },
        { id: 'security', icon: Shield, label: t('settings:account.password.label') },
    ];

    return (
        <div className="corp max-w-6xl mx-auto pb-16 px-4 pt-8 animate-in fade-in duration-300">

            {/* ── Page header ────────────────────────────────────────── */}
            <div className="mb-8">
                <h1 className="corp-h1">
                    {t('settings:title')}
                </h1>
            </div>

            {/* ── Layout ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* ── Left Panel ─────────────────────────────────────── */}
                <div className="lg:col-span-4 space-y-6">

                    {/* Profile card */}
                    <div className="corp-panel rounded-[2.5rem] p-8 flex flex-col items-center text-center gap-5">
                        <div className="relative">
                            <AvatarDisplay config={user.avatar_config} size={112} showCTA={false} linkToEdit={true} />
                            <button
                                onClick={() => navigate('/avatar/edit')}
                                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-white dark:bg-[#0d1426] border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors duration-150"
                                aria-label="Edit avatar"
                            >
                                <Camera className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            </button>
                        </div>
                        <div>
                            <h2 className="corp-h4">{name || user.name}</h2>
                            <p className="corp-body-sm mt-0.5">
                                @{username || t('common:status.not_configured')}
                            </p>
                        </div>
                        <div className="w-full pt-4 border-t border-slate-200 dark:border-white/10">
                            <div className="flex items-center justify-center gap-2">
                                <Mail className="w-4 h-4" />
                                <span className="corp-body truncate max-w-[180px]">{user.email}</span>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="corp-panel rounded-[2.5rem] p-2">
                        {NAV_ITEMS.map((item) => {
                            const isActive = activeSection === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setActiveSection(item.id);
                                        document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }}
                                    className={cn(
                                        "w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-[background-color,color] duration-150 text-left",
                                        isActive
                                            ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 shadow-sm"
                                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                                    )}
                                >
                                    <item.icon className={cn("w-5 h-5", isActive && "text-indigo-600 dark:text-indigo-400")} />
                                    <span className="corp-label">{item.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Language picker */}
                    <div className="corp-panel rounded-[2.5rem] p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="corp-icon-chip w-10 h-10">
                                <Globe className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="corp-label">{t('settings:account.language')}</span>
                            </div>
                        </div>
                        <Select value={preferredLanguage} onValueChange={setPreferredLanguage}>
                            <SelectTrigger className="corp-input h-11 rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="corp rounded-xl">
                                <SelectItem value="es">Espa&ntilde;ol</SelectItem>
                                <SelectItem value="en">English</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* ── Right Content ──────────────────────────────────── */}
                <div className="lg:col-span-8 space-y-6">

                    {/* ─ Identity ────────────────────────────────────── */}
                    <div id="identity" className="corp-panel rounded-[2.5rem] p-6 md:p-8">
                        <div className="mb-8">
                            <span className="corp-eyebrow">{t('settings:identity.title')}</span>
                        </div>

                        <div className="space-y-6">
                            {/* Name */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                                <div className="flex items-center gap-3 sm:w-48 shrink-0">
                                    <UserIcon className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <span className="corp-label">{t('settings:identity.name.label')}</span>
                                </div>
                                <div className="flex-1">
                                    <Input value={name} onChange={(e) => setName(e.target.value)} className="corp-input h-11 rounded-xl" placeholder={t('settings:identity.name.placeholder')} />
                                </div>
                            </div>

                            {/* Separator */}
                            <div className="border-t border-slate-100 dark:border-white/5" />

                            {/* Username */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                                <div className="flex items-center gap-3 sm:w-48 shrink-0">
                                    <AtSign className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <span className="corp-label">{t('settings:identity.username.label')}</span>
                                </div>
                                <div className="flex-1">
                                    <Input
                                        value={username}
                                        onChange={(e) => { const val = e.target.value.toLowerCase(); setUsername(val); validateUsername(val); }}
                                        className={cn("corp-input h-11 rounded-xl", usernameError && "corp-input--error")}
                                        placeholder={t('settings:identity.username.placeholder')}
                                    />
                                    {usernameError && <p className="text-red-500 corp-caption font-semibold mt-1.5">{usernameError}</p>}
                                </div>
                            </div>

                            {/* Separator */}
                            <div className="border-t border-slate-100 dark:border-white/5" />

                            {/* Birthday */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                                <div className="flex items-center gap-3 sm:w-48 shrink-0">
                                    <Calendar className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <span className="corp-label">{t('settings:identity.birthday.label')}</span>
                                </div>
                                <div className="flex-1">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className={cn("corp-input h-11 w-full flex items-center justify-between rounded-xl font-normal", !birthDate && "text-slate-400 dark:text-slate-500")}>
                                                {birthDate ? format(birthDate, t('settings:identity.birthday.display_format'), { locale: dateLocale }) : <span>{t('settings:identity.birthday.select')}</span>}
                                                <Calendar className="w-4 h-4 text-slate-400 ml-2" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="corp w-auto p-4 corp-panel rounded-2xl" align="start">
                                            <div className="flex gap-2 mb-4">
                                                <Select value={birthDate ? birthDate.getFullYear().toString() : new Date().getFullYear().toString()}
                                                    onValueChange={(year) => { const d = birthDate ? new Date(birthDate) : new Date(); d.setFullYear(parseInt(year)); setBirthDate(d); }}>
                                                    <SelectTrigger className="corp-input h-10 w-[120px] rounded-xl"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="corp rounded-xl">
                                                        {Array.from({ length: 120 }, (_, i) => new Date().getFullYear() - i).map((y) => (<SelectItem key={y} value={y.toString()}>{y}</SelectItem>))}
                                                    </SelectContent>
                                                </Select>
                                                <Select value={birthDate ? birthDate.getMonth().toString() : new Date().getMonth().toString()}
                                                    onValueChange={(month) => { const d = birthDate ? new Date(birthDate) : new Date(); d.setMonth(parseInt(month)); setBirthDate(d); }}>
                                                    <SelectTrigger className="corp-input h-10 w-[140px] rounded-xl"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="corp rounded-xl">
                                                        {Array.from({ length: 12 }, (_, i) => i).map((m) => (<SelectItem key={m} value={m.toString()}>{format(new Date(2000, m, 1), "MMMM", { locale: dateLocale })}</SelectItem>))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <CalendarComponent mode="single" selected={birthDate} onSelect={setBirthDate} locale={dateLocale} className="rounded-xl" month={birthDate || new Date()} onMonthChange={setBirthDate} />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─ Account ─────────────────────────────────────── */}
                    <div id="account" className="corp-panel rounded-[2.5rem] p-6 md:p-8">
                        <div className="mb-8">
                            <span className="corp-eyebrow">{t('settings:account.title')}</span>
                        </div>

                        <div className="space-y-6">
                            {/* Email */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                                <div className="flex items-center gap-3 sm:w-48 shrink-0">
                                    <Mail className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <span className="corp-label">{t('settings:account.email')}</span>
                                </div>
                                <div className="flex-1 flex items-center gap-3">
                                    {isEmailAuth ? (
                                        <Dialog open={isEmailOpen} onOpenChange={(open) => { setIsEmailOpen(open); if (!open) { setEmailCurrentPassword(""); setNewEmail(""); setEmailChangeSent(false); } }}>
                                            <DialogTrigger asChild>
                                                <button className="flex items-center gap-3 group">
                                                    <span className="corp-body font-semibold">{user.email}</span>
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 group-hover:underline">
                                                        {t('settings:account.password.change')}
                                                        <ChevronRight className="w-3 h-3" />
                                                    </span>
                                                </button>
                                            </DialogTrigger>
                                            <DialogContent className="corp-dialog rounded-3xl sm:max-w-md p-8">
                                                <DialogHeader className="mb-6">
                                                    <div className="corp-icon-chip w-12 h-12 mb-4">
                                                        <Mail className="w-6 h-6" />
                                                    </div>
                                                    <DialogTitle className="corp-h3">{t('settings:account.email_change.title')}</DialogTitle>
                                                </DialogHeader>
                                                {emailChangeSent ? (
                                                    <div className="text-center space-y-5 py-4 animate-in fade-in zoom-in-95 duration-300">
                                                        <div className="corp-icon-chip w-16 h-16 mx-auto">
                                                            <Check className="w-8 h-8" />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                    <p className="corp-h4">{t('settings:account.email_change.sent_title')}</p>
                                                    <p className="corp-body-sm max-w-xs mx-auto">{t('settings:account.email_change.sent_desc', { email: newEmail })}</p>
                                                        </div>
                                                        <Button className="corp-btn-secondary w-full h-11 rounded-full text-sm font-semibold" onClick={() => { setIsEmailOpen(false); setEmailChangeSent(false); setNewEmail(""); }}>{t('common:close')}</Button>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4">
                                                        <div className="space-y-1.5">
                                                            <Label className="corp-label">{t('settings:account.email_change.current')}</Label>
                                                            <div className="bg-slate-50 dark:bg-white/5 h-11 flex items-center px-4 rounded-xl text-sm font-medium text-slate-400 border border-slate-200 dark:border-white/10">{user.email}</div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="corp-label">{t('settings:account.email_change.new')}</Label>
                                                            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="nuevo@email.com" className="corp-input h-11 rounded-xl" />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="corp-label">{t('settings:account.email_change.password_confirm')}</Label>
                                                            <Input type="password" value={emailCurrentPassword} onChange={(e) => setEmailCurrentPassword(e.target.value)} placeholder="••••••••" className="corp-input h-11 rounded-xl" />
                                                        </div>
                                                        <Button className="corp-btn-primary w-full h-11 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleChangeEmail} disabled={isChangingEmail}>
                                                            {isChangingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : t('settings:account.email_change.button')}
                                                        </Button>
                                                    </div>
                                                )}
                                            </DialogContent>
                                        </Dialog>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className="corp-body">{user.email}</span>
                                            <span className="corp-badge corp-badge--info text-[10px]">
                                                <Globe className="w-3 h-3" />
                                                {user.auth_provider}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─ Security ────────────────────────────────────── */}
                    <div id="security" className="corp-panel rounded-[2.5rem] p-6 md:p-8">
                        <div className="mb-8">
                            <span className="corp-eyebrow">{t('settings:account.password.label')}</span>
                        </div>

                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                                <div className="flex items-center gap-3 sm:w-48 shrink-0">
                                    <Lock className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <span className="corp-label">{t('settings:account.password.label')}</span>
                                </div>
                                <div className="flex-1">
                                    {isEmailAuth ? (
                                        <Dialog open={isPasswordOpen} onOpenChange={(open) => { setIsPasswordOpen(open); if (!open) { setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); } }}>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" className="corp-btn-secondary h-11 px-6 rounded-full text-sm font-semibold inline-flex items-center gap-2">
                                                    <Lock className="w-4 h-4" />
                                                    {t('settings:account.password.change')}
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="corp-dialog rounded-3xl sm:max-w-md p-8">
                                                <DialogHeader className="mb-6">
                                                    <div className="corp-icon-chip w-12 h-12 mb-4">
                                                        <Lock className="w-6 h-6" />
                                                    </div>
                                                    <DialogTitle className="corp-h3">{t('settings:account.password.dialog.title')}</DialogTitle>
                                                </DialogHeader>
                                                <div className="space-y-4">
                                                    {[
                                                        { label: t('settings:account.password.dialog.current'), value: currentPassword, setter: setCurrentPassword },
                                                        { label: t('settings:account.password.dialog.new'), value: newPassword, setter: setNewPassword },
                                                        { label: t('settings:account.password.dialog.confirm'), value: confirmPassword, setter: setConfirmPassword },
                                                    ].map((field, i) => (
                                                        <div key={i} className="space-y-1.5">
                                                            <Label className="corp-label">{field.label}</Label>
                                                            <Input type="password" value={field.value} onChange={(e) => field.setter(e.target.value)} placeholder="••••••••" className="corp-input h-11 rounded-xl" />
                                                        </div>
                                                    ))}
                                                    <Button className="corp-btn-primary w-full h-11 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleChangePassword} disabled={isChangingPassword}>
                                                        {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : t('settings:account.password.dialog.submit')}
                                                    </Button>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    ) : (
                                        <span className="corp-badge corp-badge--info">
                                            <Globe className="w-3.5 h-3.5" />
                                            {t('settings:account.social')} ({user.auth_provider})
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Save button */}
                    <div className="flex justify-end pt-2">
                        <Button
                            onClick={handleSaveProfile}
                            disabled={isSaving || !!usernameError}
                            className="corp-btn-primary h-12 px-10 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-500/10"
                        >
                            {isSaving ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> {t('settings:actions.saving')}</>
                            ) : (
                                <><Save className="w-4 h-4" /> {t('settings:actions.save')}</>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
