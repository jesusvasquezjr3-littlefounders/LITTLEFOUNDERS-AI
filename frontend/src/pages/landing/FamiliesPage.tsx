import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { LandingLayout } from '@/components/landing/LandingLayout';
import { FeatureCard } from '@/components/families/FeatureCard';
import { BenefitGrid } from '@/components/families/BenefitGrid';
import { Button } from '@/components/ui/button';
import { DinaCharacter } from '@/components/characters/DinaCharacter';
import { DinoCharacter } from '@/components/characters/DinoCharacter';
import DrRhoCharacter from '@/components/characters/DrRhoCharacter';
import ZaraVexCharacter from '@/components/characters/ZaraVexCharacter';
import {
  CheckCircle2, Target, Gift, TrendingUp, BarChart3, Users,
  Zap, Trophy, Coins, LineChart, Shield, Brain, Sparkles,
  Heart, Mail, Clock, Send, Star, Lock, Flame, ChevronRight,
} from 'lucide-react';

/* ─── Email waitlist form ─────────────────────────────────────────────── */
function EmailWaitlistForm({ ctaLabel, placeholder, successMsg, language }: {
  ctaLabel: string; placeholder: string; successMsg: string; language: string;
}) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const { error: sbError } = await supabase
      .from('families_waitlist')
      .insert({ email: email.trim().toLowerCase(), language, source: 'families_page' });
    setLoading(false);
    if (sbError && sbError.code !== '23505') {
      setError(sbError.message);
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-3 px-6 py-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300">
        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
        <span className="font-semibold text-sm">{successMsg}</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-2">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder={placeholder} required
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-pink-500 dark:focus:ring-pink-400 transition-all placeholder:text-gray-400"
          />
        </div>
        <Button type="submit" disabled={loading}
          className="shrink-0 px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2 disabled:opacity-60">
          {loading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
          {ctaLabel}
        </Button>
      </form>
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400 font-medium pl-1">{error}</p>
      )}
    </div>
  );
}

/* ─── Mock UI: Family Dashboard (Hero right column) ─────────────────────── */
function HeroDashboardPreview() {
  const tasks = [
    { label: 'Limpiar habitación', coins: 30, done: true, color: 'pink' },
    { label: 'Hacer la tarea', coins: 50, done: true, color: 'purple' },
    { label: 'Lavar los platos', coins: 25, done: false, color: 'blue' },
    { label: 'Leer 20 minutos', coins: 40, done: false, color: 'green' },
  ];
  const completed = tasks.filter(t => t.done).length;
  const pct = Math.round((completed / tasks.length) * 100);

  return (
    <div className="relative w-full max-w-sm mx-auto select-none">
      {/* Glow base */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-300/30 via-purple-300/20 to-blue-300/20 dark:from-pink-900/20 dark:via-purple-900/15 dark:to-blue-900/15 rounded-3xl blur-2xl -z-10" />

      {/* Main card */}
      <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Panel Familiar</p>
              <p className="text-white font-black text-lg">Sofía</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">🦕</div>
          </div>
          {/* Coin balance */}
          <div className="flex items-center gap-2 bg-white/15 rounded-xl px-4 py-2">
            <span className="text-2xl">🪙</span>
            <div>
              <p className="text-white font-black text-xl leading-none">1,250</p>
              <p className="text-white/70 text-xs">monedas acumuladas</p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Progreso de hoy</span>
            <span className="text-xs font-black text-pink-600 dark:text-pink-400">{pct}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Task list */}
        <div className="px-5 pb-5 space-y-2">
          {tasks.map((task, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${task.done ? 'bg-green-50 dark:bg-green-900/15' : 'bg-gray-50 dark:bg-slate-800/50'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${task.done ? 'bg-green-500' : 'border-2 border-gray-300 dark:border-gray-600'}`}>
                {task.done && <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>
              <span className={`text-sm font-semibold flex-1 ${task.done ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                {task.label}
              </span>
              <div className="flex items-center gap-1 text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                🪙 {task.coins}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating badge — streak */}
      <div className="absolute -top-3 -right-3 bg-gradient-to-br from-orange-400 to-red-500 text-white px-3 py-1.5 rounded-xl shadow-lg text-xs font-black flex items-center gap-1.5 z-10">
        <Flame className="w-3.5 h-3.5" /> 7 días seguidos
      </div>
    </div>
  );
}

/* ─── Mock UI: Task Manager (section visual) ──────────────────────────── */
function TaskManagerPreview() {
  const [activeTask, setActiveTask] = useState<number | null>(null);
  const tasks = [
    { icon: '📚', label: 'Completar lección de ahorro', reward: 60, category: 'Aprendizaje', color: 'from-purple-400 to-blue-500' },
    { icon: '🧹', label: 'Ordenar el cuarto', reward: 35, category: 'Hogar', color: 'from-pink-400 to-rose-500' },
    { icon: '🌱', label: 'Regar las plantas', reward: 20, category: 'Hogar', color: 'from-green-400 to-emerald-500' },
    { icon: '🎯', label: 'Practicar 30 min de piano', reward: 45, category: 'Habilidad', color: 'from-amber-400 to-orange-500' },
  ];

  return (
    <div className="relative w-full max-w-sm mx-auto select-none">
      <div className="absolute inset-0 bg-gradient-to-br from-pink-200/20 to-purple-200/20 dark:from-pink-900/10 dark:to-purple-900/10 rounded-3xl blur-3xl -z-10" />
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-gray-900 dark:text-white">Tareas de Luna</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">4 tareas pendientes · 160 🪙 disponibles</p>
            </div>
            <button className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white flex items-center justify-center text-lg font-black shadow-md">+</button>
          </div>
        </div>
        <div className="p-4 space-y-2">
          {tasks.map((task, i) => (
            <div
              key={i}
              onClick={() => setActiveTask(activeTask === i ? null : i)}
              className={`group p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${activeTask === i ? 'border-pink-300 dark:border-pink-700 bg-pink-50 dark:bg-pink-900/15 shadow-md' : 'border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600 bg-gray-50/50 dark:bg-slate-800/30'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${task.color} flex items-center justify-center text-lg shadow-sm`}>{task.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{task.label}</p>
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">{task.category}</span>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="text-sm font-black text-amber-600 dark:text-amber-400">🪙 {task.reward}</div>
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${activeTask === i ? 'rotate-90' : ''}`} />
                </div>
              </div>
              {activeTask === i && (
                <div className="mt-3 pt-3 border-t border-pink-200 dark:border-pink-800/40 flex gap-2">
                  <button className="flex-1 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-bold shadow-sm">Marcar como hecha</button>
                  <button className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-xs font-bold">Editar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Mock UI: Marketplace ────────────────────────────────────────────── */
function MarketplacePreview() {
  const items = [
    { emoji: '💰', label: 'Dinero de bolsillo', price: 500, desc: '≈ $2 USD', badge: 'Popular', badgeColor: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
    { emoji: '🎮', label: 'Tiempo de videojuego', price: 200, desc: '30 minutos extra', badge: 'Nuevo', badgeColor: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
    { emoji: '🍕', label: 'Elegir la cena', price: 350, desc: 'Tú decides hoy', badge: null, badgeColor: '' },
    { emoji: '⭐', label: 'Lección Premium', price: 150, desc: 'Contenido especial', badge: 'LF+', badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  ];

  return (
    <div className="relative w-full max-w-sm mx-auto select-none">
      <div className="absolute inset-0 bg-gradient-to-br from-green-200/20 to-blue-200/20 dark:from-green-900/10 dark:to-blue-900/10 rounded-3xl blur-3xl -z-10" />
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Tienda de Recompensas</p>
              <p className="text-white font-black text-lg">Marketplace</p>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 rounded-xl px-3 py-1.5">
              <span className="text-lg">🪙</span>
              <span className="text-white font-black">1,250</span>
            </div>
          </div>
        </div>
        {/* Items grid */}
        <div className="p-4 grid grid-cols-2 gap-3">
          {items.map((item, i) => (
            <div key={i} className="group relative p-4 rounded-2xl border border-gray-100 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 bg-gray-50 dark:bg-slate-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all cursor-pointer hover:shadow-md">
              {item.badge && (
                <span className={`absolute top-2 right-2 text-[10px] font-black px-1.5 py-0.5 rounded-full ${item.badgeColor}`}>{item.badge}</span>
              )}
              <div className="text-3xl mb-2">{item.emoji}</div>
              <p className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-tight mb-1">{item.label}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">{item.desc}</p>
              <div className="flex items-center gap-1">
                <span className="text-sm">🪙</span>
                <span className="text-sm font-black text-amber-600 dark:text-amber-400">{item.price}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 pb-4">
          <button className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold shadow-sm hover:shadow-md transition-all">
            Ver catálogo completo →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Mock UI: Parent Analytics Dashboard ────────────────────────────── */
function ParentDashboardPreview() {
  const barData = [40, 65, 30, 80, 55, 90, 72];
  const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const maxBar = Math.max(...barData);

  return (
    <div className="relative w-full max-w-sm mx-auto select-none">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-200/20 to-purple-200/20 dark:from-blue-900/10 dark:to-purple-900/10 rounded-3xl blur-3xl -z-10" />
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-5">
          <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Panel de Padres</p>
          <p className="text-white font-black text-lg">Progreso Semanal</p>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {[
              { label: 'Tareas', value: '14', icon: '✅' },
              { label: 'Monedas', value: '380', icon: '🪙' },
              { label: 'Racha', value: '7d', icon: '🔥' },
            ].map((stat, i) => (
              <div key={i} className="bg-white/15 rounded-xl p-2 text-center">
                <div className="text-lg">{stat.icon}</div>
                <div className="text-white font-black text-sm">{stat.value}</div>
                <div className="text-white/60 text-[10px]">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bar chart */}
        <div className="p-5">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Actividad diaria</p>
          <div className="flex items-end gap-2 h-20">
            {barData.map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-blue-500 to-indigo-400 transition-all duration-700 hover:from-blue-600 hover:to-indigo-500"
                  style={{ height: `${(val / maxBar) * 64}px` }}
                />
                <span className="text-[10px] text-gray-400 font-semibold">{days[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent lessons */}
        <div className="px-5 pb-5 space-y-2">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Últimas lecciones</p>
          {[
            { topic: 'Ahorro e inversión', score: 95, emoji: '💰' },
            { topic: 'Presupuesto familiar', score: 82, emoji: '📊' },
          ].map((lesson, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl">
              <span className="text-lg">{lesson.emoji}</span>
              <span className="flex-1 text-xs font-semibold text-gray-700 dark:text-gray-300">{lesson.topic}</span>
              <span className="text-xs font-black text-blue-600 dark:text-blue-400">{lesson.score}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Notification bubble */}
      <div className="absolute -bottom-2 -left-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg px-3 py-2 flex items-center gap-2 z-10 max-w-[180px]">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">¡Sofía completó 3 tareas!</span>
      </div>
    </div>
  );
}

/* ─── Section header ──────────────────────────────────────────────────── */
function SectionBadge({ icon: Icon, label, colorClass }: { icon: React.ElementType; label: string; colorClass: string }) {
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${colorClass}`}>
      <Icon className="w-4 h-4" />
      <span className="text-xs lg:text-sm font-bold uppercase tracking-wider">{label}</span>
    </div>
  );
}

/* ─── Decorative dots grid ────────────────────────────────────────────── */
function DotsGrid({ className }: { className?: string }) {
  return (
    <div className={`absolute pointer-events-none opacity-30 dark:opacity-20 ${className}`}>
      <div className="grid grid-cols-6 gap-3">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600" />
        ))}
      </div>
    </div>
  );
}

/* ─── Step number ─────────────────────────────────────────────────────── */
function StepPill({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white text-xs font-black flex items-center justify-center shadow-md">{n}</div>
      <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
    </div>
  );
}

/* ─── PAGE ────────────────────────────────────────────────────────────── */
export default function FamiliesPage() {
  const { t, i18n } = useTranslation('landing');
  const [activeTab] = useState<'tasks' | 'marketplace' | 'tools'>('tasks');
  const lang = i18n.language;

  return (
    <LandingLayout>
      <div className="min-h-screen bg-gradient-to-b from-white via-slate-50/60 to-white dark:from-slate-950 dark:via-slate-900/50 dark:to-slate-950 transition-colors duration-500">

        {/* ══════════════════════════════════════════════════════════════
            HERO
        ══════════════════════════════════════════════════════════════ */}
        <section className="relative pt-20 lg:pt-32 pb-20 px-4 overflow-hidden min-h-[90vh] flex items-center">
          <DotsGrid className="top-32 left-8" />
          <DotsGrid className="bottom-20 right-8" />

          <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
            <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-pink-400/15 to-purple-400/10 dark:from-pink-900/10 dark:to-purple-900/5 rounded-full blur-[120px] animate-float" />
            <div className="absolute bottom-[-15%] left-[-15%] w-[700px] h-[700px] bg-gradient-to-tr from-blue-400/10 to-pink-400/10 dark:from-blue-900/5 dark:to-pink-900/5 rounded-full blur-[120px] animate-float" style={{ animationDelay: '3s' }} />
          </div>

          <div className="max-w-7xl mx-auto w-full relative">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

              {/* LEFT */}
              <div className="space-y-7 z-10">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white leading-[1.1] tracking-tight">
                  {t('families.hero.title_part1')}
                  <span className="block">
                    <span className="inline-block bg-gradient-to-r from-pink-600 via-purple-600 to-pink-500 bg-clip-text text-transparent relative">
                      {t('families.hero.title_highlight')}
                      <div className="absolute -bottom-1 left-0 w-full h-1 bg-gradient-to-r from-pink-600 to-purple-600 rounded-full opacity-30" />
                    </span>
                  </span>
                  {t('families.hero.title_part2')}
                </h1>

                <p className="text-base lg:text-lg text-gray-700 dark:text-gray-300 max-w-xl leading-relaxed font-medium">
                  {t('families.hero.subtitle')}
                </p>

                {/* How it works — 3 micro-steps */}
                <div className="flex flex-col gap-3">
                  {[
                    { n: 1, icon: '📋', text: t('families.hero.step_1') },
                    { n: 2, icon: '✅', text: t('families.hero.step_2') },
                    { n: 3, icon: '🎁', text: t('families.hero.step_3') },
                  ].map(step => (
                    <div key={step.n} className="flex items-center gap-3 p-3 rounded-xl bg-white/60 dark:bg-slate-900/40 border border-gray-200/60 dark:border-slate-700/50 backdrop-blur-sm">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white text-xs font-black flex items-center justify-center shadow-md flex-shrink-0">{step.n}</div>
                      <span className="text-base mr-1">{step.icon}</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{step.text}</span>
                    </div>
                  ))}
                </div>

                {/* Coming soon + email */}
                <div className="space-y-3 pt-2">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100/80 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/40">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs lg:text-sm font-bold text-amber-700 dark:text-amber-300">
                      {t('families.hero.coming_soon_label')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('families.hero.notify_desc')}</p>
                  <EmailWaitlistForm
                    ctaLabel={t('families.hero.notify_cta')}
                    placeholder={t('families.hero.email_placeholder')}
                    successMsg={t('families.hero.email_success')}
                    language={lang}
                  />
                </div>
              </div>

              {/* RIGHT — Dashboard mockup */}
              <div className="flex justify-center items-center pt-8 lg:pt-0">
                <HeroDashboardPreview />
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            TASK MANAGER
        ══════════════════════════════════════════════════════════════ */}
        <section className="relative py-20 lg:py-28 px-4 overflow-hidden bg-gradient-to-br from-pink-50/60 via-white to-purple-50/40 dark:from-pink-950/20 dark:via-slate-950 dark:to-purple-950/20">
          <DotsGrid className="top-12 right-12" />
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-pink-300/10 to-transparent dark:from-pink-900/5 rounded-full blur-3xl" />
          </div>

          <div className="max-w-7xl mx-auto">
            {/* Section header */}
            <div className="text-center mb-12">
              <SectionBadge icon={Target} label={t('families.task_manager.badge')} colorClass="bg-pink-100/80 dark:bg-pink-900/30 border-pink-200/60 dark:border-pink-800/40 text-pink-700 dark:text-pink-300" />
              <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white leading-tight">
                {t('families.task_manager.title')}
              </h2>
              <p className="mt-3 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-base lg:text-lg leading-relaxed">
                {t('families.task_manager.description')}
              </p>
            </div>

            {/* Two-column: features + mockup + character */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-center">
              {/* Feature list */}
              <div className="space-y-4 lg:order-1">
                {[
                  { icon: Target, text: t('families.task_manager.feature_1'), color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-900/30' },
                  { icon: Zap, text: t('families.task_manager.feature_2'), color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
                  { icon: Shield, text: t('families.task_manager.feature_3'), color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
                  { icon: Sparkles, text: t('families.task_manager.feature_4'), color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
                ].map((f, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200/60 dark:border-slate-700/50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
                    <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                      <f.icon className={`w-5 h-5 ${f.color}`} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 leading-relaxed">{f.text}</span>
                  </div>
                ))}
              </div>

              {/* Mockup */}
              <div className="flex justify-center lg:order-2">
                <TaskManagerPreview />
              </div>

              {/* Character */}
              <div className="hidden lg:flex justify-center items-end h-96 lg:order-3">
                <DinaCharacter expression="happy" className="drop-shadow-2xl w-full h-full" />
              </div>
            </div>

            {/* Benefit cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-14">
              {[
                { icon: <Target className="w-6 h-6 text-pink-600 dark:text-pink-400" />, title: t('families.task_manager.benefit_1_title'), description: t('families.task_manager.benefit_1_desc') },
                { icon: <Trophy className="w-6 h-6 text-yellow-500 dark:text-yellow-400" />, title: t('families.task_manager.benefit_2_title'), description: t('families.task_manager.benefit_2_desc') },
                { icon: <Coins className="w-6 h-6 text-green-600 dark:text-green-400" />, title: t('families.task_manager.benefit_3_title'), description: t('families.task_manager.benefit_3_desc') },
                { icon: <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />, title: t('families.task_manager.benefit_4_title'), description: t('families.task_manager.benefit_4_desc') },
              ].map((card, i) => <FeatureCard key={i} {...card} />)}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            MARKETPLACE
        ══════════════════════════════════════════════════════════════ */}
        <section className="relative py-20 lg:py-28 px-4 overflow-hidden">
          <DotsGrid className="bottom-12 left-12" />
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-emerald-300/8 to-transparent dark:from-emerald-900/5 rounded-full blur-3xl" />
          </div>

          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <SectionBadge icon={Gift} label={t('families.marketplace.badge')} colorClass="bg-emerald-100/80 dark:bg-emerald-900/30 border-emerald-200/60 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300" />
              <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white leading-tight">
                {t('families.marketplace.title')}
              </h2>
              <p className="mt-3 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-base lg:text-lg">
                {t('families.marketplace.description')}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-center">
              {/* Character */}
              <div className="hidden lg:flex justify-center items-end h-96 order-2 lg:order-1">
                <DinoCharacter mood="happy" className="drop-shadow-2xl w-full h-full" />
              </div>

              {/* Mockup */}
              <div className="flex justify-center order-1 lg:order-2">
                <MarketplacePreview />
              </div>

              {/* Features */}
              <div className="space-y-4 order-3">
                {[
                  { icon: Gift, text: t('families.marketplace.feature_1'), color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
                  { icon: Star, text: t('families.marketplace.feature_2'), color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
                  { icon: TrendingUp, text: t('families.marketplace.feature_3'), color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
                ].map((f, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200/60 dark:border-slate-700/50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
                    <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                      <f.icon className={`w-5 h-5 ${f.color}`} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 leading-relaxed">{f.text}</span>
                  </div>
                ))}

                {/* Coin flow graphic */}
                <div className="mt-6 p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/60 dark:border-amber-800/30">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider mb-3">El ciclo del dinero</p>
                  <div className="flex items-center gap-2 text-sm">
                    {['Tarea ✅', '🪙 Monedas', '🎁 Recompensa'].map((step, i, arr) => (
                      <React.Fragment key={i}>
                        <span className="font-bold text-gray-700 dark:text-gray-300 text-xs text-center flex-1">{step}</span>
                        {i < arr.length - 1 && <span className="text-gray-400 font-black">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-14">
              {[
                { icon: <Gift className="w-6 h-6 text-pink-600 dark:text-pink-400" />, title: t('families.marketplace.item_1_title'), description: t('families.marketplace.item_1_desc') },
                { icon: <Zap className="w-6 h-6 text-yellow-500 dark:text-yellow-400" />, title: t('families.marketplace.item_2_title'), description: t('families.marketplace.item_2_desc') },
                { icon: <Brain className="w-6 h-6 text-purple-600 dark:text-purple-400" />, title: t('families.marketplace.item_3_title'), description: t('families.marketplace.item_3_desc') },
              ].map((card, i) => <FeatureCard key={i} {...card} />)}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            PARENT TOOLS
        ══════════════════════════════════════════════════════════════ */}
        <section className="relative py-20 lg:py-28 px-4 overflow-hidden bg-gradient-to-br from-blue-50/60 via-white to-indigo-50/40 dark:from-blue-950/20 dark:via-slate-950 dark:to-indigo-950/20">
          <DotsGrid className="top-12 left-12" />
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute top-0 right-[10%] w-[400px] h-[400px] bg-gradient-to-bl from-blue-300/10 to-transparent dark:from-blue-900/5 rounded-full blur-3xl" />
          </div>

          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <SectionBadge icon={BarChart3} label={t('families.parent_tools.badge')} colorClass="bg-blue-100/80 dark:bg-blue-900/30 border-blue-200/60 dark:border-blue-800/40 text-blue-700 dark:text-blue-300" />
              <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white leading-tight">
                {t('families.parent_tools.title')}
              </h2>
              <p className="mt-3 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-base lg:text-lg">
                {t('families.parent_tools.description')}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-center">
              {/* Features */}
              <div className="space-y-4 lg:order-1">
                {[
                  { icon: BarChart3, text: t('families.parent_tools.feature_1'), color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
                  { icon: Users, text: t('families.parent_tools.feature_2'), color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
                  { icon: LineChart, text: t('families.parent_tools.feature_3'), color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
                ].map((f, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200/60 dark:border-slate-700/50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
                    <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                      <f.icon className={`w-5 h-5 ${f.color}`} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 leading-relaxed">{f.text}</span>
                  </div>
                ))}

                {/* Conversation prompt card */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/60 dark:border-blue-800/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">💬</span>
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">Pregunta de la semana</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 italic">"Sofía aprendió sobre ahorro. Pregúntale: si tuvieras $100, ¿cómo los dividirías?"</p>
                </div>
              </div>

              {/* Mockup */}
              <div className="flex justify-center lg:order-2">
                <ParentDashboardPreview />
              </div>

              {/* Character */}
              <div className="hidden lg:flex justify-center items-end h-96 lg:order-3">
                <DrRhoCharacter mood="wise" className="drop-shadow-2xl w-full h-full" />
              </div>
            </div>

            {/* Insights grid */}
            <div className="mt-14">
              <BenefitGrid columns={3} items={[
                { icon: <BarChart3 className="w-8 h-8 text-pink-600 dark:text-pink-400" />, title: t('families.parent_tools.insight_1_title'), description: t('families.parent_tools.insight_1_desc') },
                { icon: <LineChart className="w-8 h-8 text-blue-600 dark:text-blue-400" />, title: t('families.parent_tools.insight_2_title'), description: t('families.parent_tools.insight_2_desc') },
                { icon: <Users className="w-8 h-8 text-purple-600 dark:text-purple-400" />, title: t('families.parent_tools.insight_3_title'), description: t('families.parent_tools.insight_3_desc') },
                { icon: <Shield className="w-8 h-8 text-green-600 dark:text-green-400" />, title: t('families.parent_tools.insight_4_title'), description: t('families.parent_tools.insight_4_desc') },
                { icon: <Brain className="w-8 h-8 text-orange-600 dark:text-orange-400" />, title: t('families.parent_tools.insight_5_title'), description: t('families.parent_tools.insight_5_desc') },
                { icon: <Trophy className="w-8 h-8 text-pink-600 dark:text-pink-400" />, title: t('families.parent_tools.insight_6_title'), description: t('families.parent_tools.insight_6_desc') },
              ]} />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            BENEFITS / ZaraVex
        ══════════════════════════════════════════════════════════════ */}
        <section className="relative py-20 lg:py-28 px-4 overflow-hidden">
          <DotsGrid className="bottom-12 right-12" />
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-gradient-to-tl from-pink-300/8 to-transparent dark:from-pink-900/5 rounded-full blur-3xl" />
          </div>

          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Character */}
              <div className="relative hidden lg:flex justify-center items-end h-[500px] order-2 lg:order-1">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-200/20 to-pink-200/20 dark:from-purple-900/10 dark:to-pink-900/10 rounded-3xl blur-3xl" />
                <ZaraVexCharacter mood="happy" className="drop-shadow-2xl w-full h-full relative z-10" />
                {/* Floating testimonial */}
                <div className="absolute top-4 right-0 max-w-[200px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-4 z-20">
                  <div className="flex gap-0.5 mb-2">
                    {[1,2,3,4,5].map(s => <Star key={s} className="w-3 h-3 text-yellow-400 fill-yellow-400" />)}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 italic">"Mi hija ahora ahorra su domingo por primera vez."</p>
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-1.5">— Mamá de Sofía, 9 años</p>
                </div>
              </div>

              {/* Content */}
              <div className="space-y-8 order-1 lg:order-2">
                <SectionBadge icon={Heart} label={t('families.benefits.badge')} colorClass="bg-purple-100/80 dark:bg-purple-900/30 border-purple-200/60 dark:border-purple-800/40 text-purple-700 dark:text-purple-300" />

                <div>
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white leading-tight mb-4">
                    {t('families.benefits.title')}
                  </h2>
                  <p className="text-gray-700 dark:text-gray-300 text-base lg:text-lg leading-relaxed">
                    {t('families.benefits.description')}
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    { icon: <Heart className="w-5 h-5 text-pink-600 dark:text-pink-400" />, title: t('families.benefits.benefit_1_title'), description: t('families.benefits.benefit_1_desc'), bg: 'bg-pink-50 dark:bg-pink-900/10' },
                    { icon: <Sparkles className="w-5 h-5 text-amber-500 dark:text-amber-400" />, title: t('families.benefits.benefit_2_title'), description: t('families.benefits.benefit_2_desc'), bg: 'bg-amber-50 dark:bg-amber-900/10' },
                    { icon: <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />, title: t('families.benefits.benefit_3_title'), description: t('families.benefits.benefit_3_desc'), bg: 'bg-blue-50 dark:bg-blue-900/10' },
                    { icon: <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />, title: t('families.benefits.benefit_4_title'), description: t('families.benefits.benefit_4_desc'), bg: 'bg-purple-50 dark:bg-purple-900/10' },
                  ].map((item, idx) => (
                    <div key={idx} className={`flex gap-4 p-4 rounded-2xl ${item.bg} border border-gray-200/60 dark:border-gray-700/40 hover:shadow-md transition-all hover:-translate-y-0.5 group cursor-pointer`}>
                      <div className="flex-shrink-0 mt-0.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 shadow-sm group-hover:scale-110 transition-transform">
                        {item.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-0.5">{item.title}</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            CTA
        ══════════════════════════════════════════════════════════════ */}
        <section className="relative py-24 lg:py-32 px-4 overflow-hidden">
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-pink-300/15 via-purple-300/15 to-blue-300/15 dark:from-pink-900/10 dark:via-purple-900/10 dark:to-blue-900/10 rounded-full blur-3xl" />
          </div>

          <div className="max-w-3xl mx-auto text-center relative">
            <div className="relative p-10 lg:p-16 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-gray-200/60 dark:border-slate-700/50 shadow-2xl">
              {/* Decorative corner dots */}
              <div className="absolute top-4 left-4 w-2 h-2 rounded-full bg-pink-400 opacity-50" />
              <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-purple-400 opacity-50" />
              <div className="absolute bottom-4 left-4 w-2 h-2 rounded-full bg-blue-400 opacity-50" />
              <div className="absolute bottom-4 right-4 w-2 h-2 rounded-full bg-pink-400 opacity-50" />

              <div className="space-y-6">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white leading-tight">
                  {t('families.cta.title')}
                </h2>
                <p className="text-base lg:text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto leading-relaxed">
                  {t('families.cta.subtitle')}
                </p>

                <div className="flex flex-col items-center gap-4 pt-2">
                  <EmailWaitlistForm
                    ctaLabel={t('families.cta.button')}
                    placeholder={t('families.hero.email_placeholder')}
                    successMsg={t('families.hero.email_success')}
                    language={lang}
                  />
                  <p className="text-sm text-gray-400 font-medium">{t('families.cta.disclaimer')}</p>
                </div>
              </div>
            </div>

            {/* Trust row */}
            <div className="grid grid-cols-3 gap-4 mt-8">
              {[
                { icon: <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />, label: t('families.cta.trust_1') },
                { icon: <Heart className="w-5 h-5 text-pink-500 dark:text-pink-400" />, label: t('families.cta.trust_2') },
                { icon: <Sparkles className="w-5 h-5 text-amber-500 dark:text-amber-400" />, label: t('families.cta.trust_3') },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/70 dark:bg-slate-900/50 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/40 shadow-sm">
                  {item.icon}
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </LandingLayout>
  );
}
