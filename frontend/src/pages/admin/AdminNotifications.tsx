import { useState, useEffect, useCallback } from "react";
import {
  Bell, Plus, Filter, RefreshCw, Search, Send, Archive, Edit2,
  Users, User, Globe, Clock, X,
  Megaphone, UserPlus, Flame, Trophy, BookOpen, Sparkles,
} from "lucide-react";
import {
  notificationsAdminApi,
  type NotificationAdminItem,
  type NotificationCreateData,
  type UserSearchResult,
} from "@/lib/api/notifications";

// ── Constants ──

const NOTIFICATION_TYPES = [
  { value: "admin_broadcast", label: "Anuncio General", labelEn: "Broadcast", icon: Megaphone },
  { value: "system", label: "Sistema", labelEn: "System", icon: Sparkles },
  { value: "reminder", label: "Recordatorio", labelEn: "Reminder", icon: Clock },
  { value: "follow_request", label: "Solicitud de Seguimiento", labelEn: "Follow Request", icon: UserPlus },
  { value: "new_follower", label: "Nuevo Seguidor", labelEn: "New Follower", icon: UserPlus },
  { value: "streak", label: "Racha", labelEn: "Streak", icon: Flame },
  { value: "achievement", label: "Logro", labelEn: "Achievement", icon: Trophy },
  { value: "lesson", label: "Leccion", labelEn: "Lesson", icon: BookOpen },
];

const TARGET_TYPES = [
  { value: "all", label: "Todos los Usuarios", icon: Globe },
  { value: "user_type", label: "Por Tipo de Usuario", icon: Users },
  { value: "specific_user", label: "Usuario Especifico", icon: User },
];

const USER_TYPES = [
  { value: "child", label: "Ninos" },
  { value: "tutor", label: "Padres / Tutores" },
  { value: "universal", label: "Universal" },
];

const STATUS_COLORS: Record<string, string> = {
  active: "corp-badge corp-badge--success",
  draft: "corp-badge corp-badge--brand",
  archived: "corp-badge",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "corp-badge",
  normal: "corp-badge corp-badge--info",
  high: "corp-badge corp-badge--danger",
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "hace un momento";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

// ── Notification Editor Modal ──

interface EditorProps {
  notification?: NotificationAdminItem | null;
  onSave: (data: NotificationCreateData) => Promise<void>;
  onClose: () => void;
}

function NotificationEditor({ notification, onSave, onClose }: EditorProps) {
  const isEdit = !!notification;

  const [form, setForm] = useState<NotificationCreateData>({
    type: notification?.type || "admin_broadcast",
    priority: notification?.priority || "normal",
    status: notification?.status || "active",
    title_es: notification?.title_es || "",
    title_en: notification?.title_en || "",
    body_es: notification?.body_es || "",
    body_en: notification?.body_en || "",
    media_url: notification?.media_url || "",
    action_url: notification?.action_url || "",
    target_type: notification?.target_type || "all",
    target_value: notification?.target_value || "",
    scheduled_at: notification?.scheduled_at || "",
    expires_at: notification?.expires_at || "",
  });

  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 2) {
      setUserResults([]);
      return;
    }
    setSearchingUsers(true);
    try {
      const results = await notificationsAdminApi.searchUsers(q);
      setUserResults(results);
    } catch {
      setUserResults([]);
    } finally {
      setSearchingUsers(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(userSearch), 300);
    return () => clearTimeout(timer);
  }, [userSearch, searchUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title_es || !form.title_en) return;

    setSaving(true);
    try {
      const data = { ...form };
      // Clean optional fields
      if (!data.media_url) delete data.media_url;
      if (!data.action_url) delete data.action_url;
      if (!data.scheduled_at) delete data.scheduled_at;
      if (!data.expires_at) delete data.expires_at;
      if (data.target_type === "specific_user" && selectedUser) {
        data.target_value = selectedUser.public_id;
      }
      await onSave(data);
    } finally {
      setSaving(false);
    }
  };

  const selectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setForm(prev => ({ ...prev, target_value: user.public_id }));
    setUserSearch("");
    setUserResults([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="corp corp-dialog rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
          <h2 className="corp-display text-lg font-bold text-slate-900 dark:text-white">
            {isEdit ? "Editar Notificacion" : "Nueva Notificacion"}
          </h2>
          <button onClick={onClose} className="corp-btn-ghost h-9 w-9 rounded-lg inline-flex items-center justify-center">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Type, Priority, Status row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="corp-label">Tipo</label>
              <select
                value={form.type}
                onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
                className="corp-input"
              >
                {NOTIFICATION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="corp-label">Prioridad</label>
              <select
                value={form.priority}
                onChange={e => setForm(prev => ({ ...prev, priority: e.target.value }))}
                className="corp-input"
              >
                <option value="low">Baja</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="corp-label">Estado</label>
              <select
                value={form.status}
                onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                className="corp-input"
              >
                <option value="active">Activa</option>
                <option value="draft">Borrador</option>
                <option value="archived">Archivada</option>
              </select>
            </div>
          </div>

          {/* Content - Spanish */}
          <div className="space-y-3">
            <h3 className="corp-display text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="fi fi-es w-4 h-3 rounded-sm" /> Contenido en Espanol
            </h3>
            <input
              type="text"
              placeholder="Titulo en espanol *"
              value={form.title_es}
              onChange={e => setForm(prev => ({ ...prev, title_es: e.target.value }))}
              className="corp-input"
              required
            />
            <textarea
              placeholder="Descripcion en espanol (opcional)"
              value={form.body_es || ""}
              onChange={e => setForm(prev => ({ ...prev, body_es: e.target.value }))}
              className="corp-input resize-none"
              rows={2}
            />
          </div>

          {/* Content - English */}
          <div className="space-y-3">
            <h3 className="corp-display text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="fi fi-us w-4 h-3 rounded-sm" /> Content in English
            </h3>
            <input
              type="text"
              placeholder="Title in English *"
              value={form.title_en}
              onChange={e => setForm(prev => ({ ...prev, title_en: e.target.value }))}
              className="corp-input"
              required
            />
            <textarea
              placeholder="Description in English (optional)"
              value={form.body_en || ""}
              onChange={e => setForm(prev => ({ ...prev, body_en: e.target.value }))}
              className="corp-input resize-none"
              rows={2}
            />
          </div>

          {/* Targeting */}
          <div className="space-y-3">
            <h3 className="corp-display text-sm font-semibold text-slate-900 dark:text-white">Destinatarios</h3>
            <div className="grid grid-cols-3 gap-2">
              {TARGET_TYPES.map(tt => {
                const Icon = tt.icon;
                return (
                  <button
                    key={tt.value}
                    type="button"
                    onClick={() => {
                      setForm(prev => ({ ...prev, target_type: tt.value, target_value: "" }));
                      setSelectedUser(null);
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      form.target_type === tt.value
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tt.label}
                  </button>
                );
              })}
            </div>

            {/* User type selector */}
            {form.target_type === "user_type" && (
              <div className="flex gap-2 mt-2">
                {USER_TYPES.map(ut => (
                  <button
                    key={ut.value}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, target_value: ut.value }))}
                    className={`px-3 py-2 rounded-xl border text-sm transition-all ${
                      form.target_value === ut.value
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                    }`}
                  >
                    {ut.label}
                  </button>
                ))}
              </div>
            )}

            {/* Specific user search */}
            {form.target_type === "specific_user" && (
              <div className="space-y-2 mt-2">
                {selectedUser ? (
                  <div className="corp-panel-subtle flex items-center justify-between p-3 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedUser.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedUser.username ? `@${selectedUser.username}` : selectedUser.email} · {selectedUser.user_type} · Idioma: {selectedUser.preferred_language}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser(null);
                        setForm(prev => ({ ...prev, target_value: "" }));
                      }}
                      className="corp-btn-ghost h-8 w-8 rounded-lg inline-flex items-center justify-center"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
                    <input
                      type="text"
                      placeholder="Buscar usuario por nombre, email o username..."
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      className="corp-input pl-9"
                    />
                    {userResults.length > 0 && (
                      <div className="corp-panel absolute z-10 w-full mt-1 rounded-xl shadow-lg max-h-48 overflow-y-auto overflow-hidden">
                        {userResults.map(u => (
                          <button
                            key={u.public_id}
                            type="button"
                            onClick={() => selectUser(u)}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 text-sm border-b border-slate-100 dark:border-white/10 last:border-0"
                          >
                            <p className="font-medium text-slate-900 dark:text-white">{u.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {u.username ? `@${u.username}` : u.email} · {u.user_type} · {u.preferred_language}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchingUsers && (
                      <div className="corp-panel absolute z-10 w-full mt-1 rounded-xl shadow-lg p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                        Buscando...
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Media & Action */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="corp-label">URL de Imagen/Media</label>
              <input
                type="url"
                placeholder="https://..."
                value={form.media_url || ""}
                onChange={e => setForm(prev => ({ ...prev, media_url: e.target.value }))}
                className="corp-input"
              />
            </div>
            <div className="space-y-1.5">
              <label className="corp-label">URL de Accion (click)</label>
              <input
                type="text"
                placeholder="/dashboard, /lessons, etc."
                value={form.action_url || ""}
                onChange={e => setForm(prev => ({ ...prev, action_url: e.target.value }))}
                className="corp-input"
              />
            </div>
          </div>

          {/* Schedule & Expiry */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="corp-label">Programar envio</label>
              <input
                type="datetime-local"
                value={form.scheduled_at ? new Date(form.scheduled_at).toISOString().slice(0, 16) : ""}
                onChange={e => setForm(prev => ({ ...prev, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : "" }))}
                className="corp-input"
              />
            </div>
            <div className="space-y-1.5">
              <label className="corp-label">Fecha de expiracion</label>
              <input
                type="datetime-local"
                value={form.expires_at ? new Date(form.expires_at).toISOString().slice(0, 16) : ""}
                onChange={e => setForm(prev => ({ ...prev, expires_at: e.target.value ? new Date(e.target.value).toISOString() : "" }))}
                className="corp-input"
              />
            </div>
          </div>

          {/* Preview */}
          {(form.title_es || form.title_en) && (
            <div className="corp-panel-subtle rounded-xl p-4">
              <p className="corp-eyebrow mb-2">Vista Previa</p>
              <div className="flex items-start gap-3">
                <div className="corp-icon-chip w-9 h-9 shrink-0">
                  <Bell className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{form.title_es || form.title_en}</p>
                  {form.body_es && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{form.body_es}</p>}
                  {form.media_url && (
                    <img src={form.media_url} alt="" className="mt-2 rounded-lg max-h-24 object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="corp-btn-ghost h-11 rounded-xl px-5 text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !form.title_es || !form.title_en}
              className="corp-btn-primary h-11 rounded-xl px-5 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isEdit ? "Guardar Cambios" : "Crear Notificacion"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Admin Page ──

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<NotificationAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingNotification, setEditingNotification] = useState<NotificationAdminItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (filterStatus) filters.status = filterStatus;
      if (filterType) filters.type = filterType;
      const data = await notificationsAdminApi.list(filters);
      setNotifications(data);
    } catch {
      // handle error silently
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleCreate = async (data: NotificationCreateData) => {
    await notificationsAdminApi.create(data);
    setShowEditor(false);
    fetchNotifications();
  };

  const handleUpdate = async (data: NotificationCreateData) => {
    if (!editingNotification) return;
    await notificationsAdminApi.update(editingNotification.public_id, data);
    setEditingNotification(null);
    setShowEditor(false);
    fetchNotifications();
  };

  const handleArchive = async (publicId: string) => {
    await notificationsAdminApi.archive(publicId);
    fetchNotifications();
  };

  const openEditor = (notif?: NotificationAdminItem) => {
    setEditingNotification(notif || null);
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingNotification(null);
  };

  // Stats
  const totalActive = notifications.filter(n => n.status === "active").length;
  const totalDraft = notifications.filter(n => n.status === "draft").length;
  const totalArchived = notifications.filter(n => n.status === "archived").length;
  const totalRead = notifications.reduce((sum, n) => sum + n.read_count, 0);

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="corp-panel p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="h-6 w-6 text-indigo-500" />
              Notificaciones
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Gestiona las notificaciones de la plataforma
            </p>
          </div>
          <button
            onClick={() => openEditor()}
            className="corp-btn-primary h-10 rounded-xl px-4 text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nueva Notificacion
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="corp-card p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Activas</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalActive}</p>
          </div>
          <div className="corp-card p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Borradores</p>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-300">{totalDraft}</p>
          </div>
          <div className="corp-card p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Archivadas</p>
            <p className="text-2xl font-bold text-slate-500 dark:text-slate-400">{totalArchived}</p>
          </div>
          <div className="corp-card p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Lecturas Totales</p>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-300">{totalRead}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="corp-panel p-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="corp-input w-auto py-1.5"
            >
              <option value="">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="draft">Borradores</option>
              <option value="archived">Archivadas</option>
            </select>
          </div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="corp-input w-auto py-1.5"
          >
            <option value="">Todos los tipos</option>
            {NOTIFICATION_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button
            onClick={fetchNotifications}
            className="corp-btn-ghost ml-auto h-9 rounded-lg px-3 text-sm font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            Refrescar
          </button>
        </div>

        {/* Notifications Table */}
        <div className="corp-panel overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400">
              <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full mr-3" />
              Cargando notificaciones...
            </div>
          ) : notifications.length === 0 ? (
            <div className="corp-empty py-16">
              <Bell className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-lg font-medium text-slate-900 dark:text-white">Sin notificaciones</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Crea tu primera notificacion para comenzar.</p>
              <button
                onClick={() => openEditor()}
                className="corp-btn-primary mt-4 h-10 rounded-xl px-4 text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Crear Notificacion
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/10">
              {notifications.map(notif => {
                const typeInfo = NOTIFICATION_TYPES.find(t => t.value === notif.type);
                const TypeIcon = typeInfo?.icon || Bell;
                const targetInfo = TARGET_TYPES.find(t => t.value === notif.target_type);

                return (
                  <div
                    key={notif.public_id}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    {/* Icon */}
                    <div className="corp-icon-chip w-10 h-10 shrink-0">
                      <TypeIcon className="h-5 w-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {notif.title_es}
                        </p>
                        <span className={STATUS_COLORS[notif.status] || "corp-badge"}>
                          {notif.status}
                        </span>
                        <span className={PRIORITY_COLORS[notif.priority] || "corp-badge"}>
                          {notif.priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          {targetInfo && <targetInfo.icon className="h-3 w-3" />}
                          {notif.target_type === "all" ? "Todos" :
                           notif.target_type === "user_type" ? `Tipo: ${notif.target_value}` :
                           "Usuario especifico"}
                        </span>
                        <span>·</span>
                        <span>{notif.read_count}/{notif.total_recipients} leidas</span>
                        <span>·</span>
                        <span>{timeAgo(notif.created_at)}</span>
                        {notif.created_by_name && (
                          <>
                            <span>·</span>
                            <span>por {notif.created_by_name}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditor(notif)}
                        className="corp-btn-ghost h-8 w-8 rounded-lg inline-flex items-center justify-center"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {notif.status !== "archived" && (
                        <button
                          onClick={() => handleArchive(notif.public_id)}
                          className="corp-btn-ghost h-8 w-8 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-red-500"
                          title="Archivar"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      {/* Editor Modal */}
      {showEditor && (
        <NotificationEditor
          notification={editingNotification}
          onSave={editingNotification ? handleUpdate : handleCreate}
          onClose={closeEditor}
        />
      )}
    </div>
  );
}
