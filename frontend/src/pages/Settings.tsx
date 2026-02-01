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
    LogOut,
    Camera
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
    <div className={cn("flex flex-col sm:flex-row sm:items-center gap-3 p-4", className)}>
        <div className="flex items-center gap-3 min-w-[140px]">
            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="flex flex-col">
                <span className="font-medium text-slate-700 dark:text-slate-200 text-sm">{label}</span>
                {description && <span className="text-xs text-slate-400 font-normal">{description}</span>}
            </div>
        </div>
        <div className="flex-1 w-full sm:w-auto">
            {children}
        </div>
    </div>
);

// Section Container
const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="space-y-3">
        <h3 className="px-4 text-sm font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/50">
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
            <div className="max-w-xl mx-auto pb-24 px-4 pt-6 space-y-8">

                {/* Header Profile */}
                <div className="flex flex-col items-center gap-4 py-4">
                    <div className="relative group">
                        <div className="w-28 h-28 rounded-full ring-4 ring-white dark:ring-slate-800 shadow-xl overflow-hidden bg-indigo-100 flex items-center justify-center">
                            {user.avatar_config ? (
                                <AvatarDisplay config={user.avatar_config} className="w-full h-full" />
                            ) : (
                                <span className="text-4xl">👤</span>
                            )}
                        </div>
                        <button
                            onClick={() => navigate('/avatar/edit')}
                            className="absolute bottom-1 right-1 w-8 h-8 bg-black/80 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform cursor-pointer"
                        >
                            <Camera className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                            {name || user.name}
                        </h1>
                        <p className="text-slate-500 text-sm font-medium">@{username || t('common:status.not_configured')}</p>
                    </div>
                </div>

                {/* Basic Info Group */}
                <Section title={t('settings:identity.title')}>
                    <SettingItem icon={UserIcon} label={t('settings:identity.name.label')}>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="h-10 border-0 bg-transparent text-right font-medium focus-visible:ring-0 placeholder:text-slate-300 p-0 shadow-none text-slate-900 dark:text-white"
                            placeholder={t('settings:identity.name.placeholder')}
                        />
                    </SettingItem>
                    <SettingItem icon={AtSign} label={t('settings:identity.username.label')} description={usernameError ? usernameError : ""}>
                        <div className="relative">
                            <Input
                                value={username}
                                onChange={(e) => {
                                    const val = e.target.value.toLowerCase();
                                    setUsername(val);
                                    validateUsername(val);
                                }}
                                className={cn(
                                    "h-10 border-0 bg-transparent text-right font-medium focus-visible:ring-0 placeholder:text-slate-300 p-0 shadow-none font-mono",
                                    usernameError ? "text-red-500" : "text-indigo-600 dark:text-indigo-400"
                                )}
                                placeholder={t('settings:identity.username.placeholder')}
                            />
                        </div>
                    </SettingItem>
                    <SettingItem icon={Calendar} label={t('settings:identity.birthday.label')}>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"ghost"}
                                    className={cn(
                                        "w-full justify-end text-right font-medium p-0 hover:bg-transparent hover:text-indigo-600",
                                        !birthDate && "text-slate-300"
                                    )}
                                >
                                    {birthDate ? (
                                        format(birthDate, t('settings:identity.birthday.display_format'), { locale: dateLocale })
                                    ) : (
                                        <span>{t('settings:identity.birthday.select')}</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-4" align="end">
                                <div className="flex gap-2 mb-4">
                                    <Select
                                        value={birthDate ? birthDate.getFullYear().toString() : new Date().getFullYear().toString()}
                                        onValueChange={(year) => {
                                            const newDate = birthDate ? new Date(birthDate) : new Date();
                                            newDate.setFullYear(parseInt(year));
                                            setBirthDate(newDate);
                                        }}
                                    >
                                        <SelectTrigger className="w-[120px]">
                                            <SelectValue placeholder={t('settings:identity.birthday.year')} />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            {Array.from({ length: 120 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                                                <SelectItem key={year} value={year.toString()}>
                                                    {year}
                                                </SelectItem>
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
                                        <SelectTrigger className="w-[140px]">
                                            <SelectValue placeholder={t('settings:identity.birthday.month')} />
                                        </SelectTrigger>
                                        <SelectContent>
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
                                    initialFocus
                                    locale={dateLocale}
                                    month={birthDate || new Date()}
                                    onMonthChange={setBirthDate}
                                />
                            </PopoverContent>
                        </Popover>
                    </SettingItem>
                    <SettingItem icon={Users} label={t('settings:identity.gender.label')}>
                        <Select value={gender} onValueChange={setGender}>
                            <SelectTrigger className="border-0 bg-transparent shadow-none focus:ring-0 p-0 h-auto justify-end gap-2 text-right">
                                <SelectValue placeholder={t('settings:identity.gender.placeholder')} />
                            </SelectTrigger>
                            <SelectContent align="end">
                                <SelectItem value="male">{t('settings:identity.gender.options.male')}</SelectItem>
                                <SelectItem value="female">{t('settings:identity.gender.options.female')}</SelectItem>
                                <SelectItem value="prefer_not_say">{t('settings:identity.gender.options.prefer_not_say')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </SettingItem>
                </Section>

                {/* Account Group */}
                <Section title={t('settings:account.title')}>
                    <SettingItem icon={Mail} label={t('settings:account.email')}>
                        <div className="flex items-center justify-end gap-2 text-slate-500">
                            <span className="text-sm truncate max-w-[180px]">{user.email}</span>
                            <Shield className="w-3 h-3 text-green-500" />
                        </div>
                    </SettingItem>

                    {isEmailAuth ? (
                        <SettingItem icon={Lock} label={t('settings:account.password.label')}>
                            <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-auto p-0 text-slate-400 hover:text-indigo-600 font-normal hover:bg-transparent">
                                        {t('settings:account.password.change')} <ChevronRight className="w-4 h-4 ml-1" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md rounded-2xl">
                                    <DialogHeader>
                                        <DialogTitle>{t('settings:account.password.dialog.title')}</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>{t('settings:account.password.dialog.current')}</Label>
                                            <Input
                                                type="password"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                placeholder={t('settings:account.password.dialog.current_placeholder')}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('settings:account.password.dialog.new')}</Label>
                                            <Input
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder={t('settings:account.password.dialog.new_placeholder')}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('settings:account.password.dialog.confirm')}</Label>
                                            <Input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder={t('settings:account.password.dialog.confirm_placeholder')}
                                            />
                                        </div>
                                        <Button
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                                            onClick={handleChangePassword}
                                            disabled={isChangingPassword}
                                        >
                                            {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : t('settings:account.password.dialog.submit')}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </SettingItem>
                    ) : (
                        <SettingItem icon={Globe} label={t('settings:account.social')}>
                            <div className="flex items-center justify-end gap-2 text-slate-600">
                                <span className="text-sm capitalize">{user.auth_provider}</span>
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            </div>
                        </SettingItem>
                    )}

                    <SettingItem icon={Globe} label={t('settings:account.language')}>
                        <Select value={preferredLanguage} onValueChange={setPreferredLanguage}>
                            <SelectTrigger className="border-0 bg-transparent shadow-none focus:ring-0 p-0 h-auto justify-end gap-2 text-right">
                                <SelectValue placeholder={t('settings:account.language')} />
                            </SelectTrigger>
                            <SelectContent align="end">
                                <SelectItem value="es">Español</SelectItem>
                                <SelectItem value="en">English</SelectItem>
                            </SelectContent>
                        </Select>
                    </SettingItem>
                </Section>

                {/* Save Button Floating or Fixed at bottom */}
                <div className="fixed bottom-6 left-0 right-0 px-4 md:static md:px-0">
                    <Button
                        onClick={handleSaveProfile}
                        disabled={isSaving || !!usernameError}
                        className="w-full max-w-xl mx-auto h-12 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 shadow-lg shadow-slate-200 dark:shadow-none transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                {t('settings:actions.saving')}
                            </>
                        ) : (
                            <>
                                {t('settings:actions.save')}
                            </>
                        )}
                    </Button>
                </div>

                <div className="h-12 md:hidden" /> {/* Spacer for floating button */}

            </div>
        </DashboardLayout>
    );
};

export default Settings;
