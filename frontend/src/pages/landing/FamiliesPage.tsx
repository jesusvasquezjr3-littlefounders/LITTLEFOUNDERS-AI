import React, { useState } from 'react';
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
  Heart, Mail, Clock, Send, Star, Flame, ChevronRight,
} from 'lucide-react';

/* ─── Wave divider ────────────────────────────────────────────────────────── */
function WaveDivider({ top = false, fromClass, toClass }: { top?: boolean; fromClass?: string; toClass: string }) {
  return (
    <div className={`relative w-full overflow-hidden leading-none pointer-events-none ${top ? '' : ''}`} style={{ height: 64 }}>
      <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className={`absolute w-full h-full ${top ? 'bottom-0' : 'bottom-0'}`} xmlns="http://www.w3.org/2000/svg">
        {top
          ? <path d="M0,64 C360,20 720,64 1080,30 C1260,12 1380,50 1440,40 L1440,64 L0,64 Z" className={toClass} />
          : <path d="M0,20 C360,60 720,10 1080,45 C1260,60 1380,20 1440,35 L1440,64 L0,64 Z" className={toClass} />
        }
      </svg>
    </div>
  );
}

/* ─── Email waitlist form ─────────────────────────────────────────────────── */
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
    if (sbError && sbError.code !== '23505') { setError(sbError.message); return; }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300">
        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
        <span className="font-bold text-sm">{successMsg}</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-2">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder={placeholder} required
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-400 dark:focus:ring-orange-500 transition-all placeholder:text-gray-400"
          />
        </div>
        <Button type="submit" disabled={loading}
          className="btn-press shrink-0 px-6 py-3 rounded-xl font-black bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-400 hover:to-pink-400 text-white border-0 shadow-none inline-flex items-center gap-2 disabled:opacity-60">
          {loading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
          {ctaLabel}
        </Button>
      </form>
      {error && <p className="text-xs text-red-500 dark:text-red-400 font-medium pl-1">{error}</p>}
    </div>
  );
}

/* ─── Hero dashboard preview ──────────────────────────────────────────────── */
function HeroDashboardPreview({ t }: { t: any }) {
  const tasks = [
    { label: t('families.mock_data.tidy_room'), coins: 30, done: true, color: 'pink' },
    { label: t('families.mock_data.complete_lesson'), coins: 50, done: true, color: 'purple' },
    { label: t('families.mock_data.water_plants'), coins: 25, done: false, color: 'blue' },
    { label: t('families.mock_data.practice_piano'), coins: 40, done: false, color: 'green' },
  ];
  const completed = tasks.filter(t => t.done).length;
  const pct = Math.round((completed / tasks.length) * 100);

  return (
    <div className="relative w-full max-w-sm mx-auto select-none">
      {/* Glow */}
      <div className="absolute -inset-4 bg-gradient-to-br from-[#ff6b6b]/20 to-[#7048e8]/20 dark:from-[#ff6b6b]/10 dark:to-[#7048e8]/10 rounded-3xl blur-3xl -z-10" />

      {/* Card */}
      <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#ff6b6b] to-[#e64980] p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">{t('families.mock_data.panel_header')}</p>
              <p className="text-white font-black text-lg">Sofía</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">🦕</div>
          </div>
          <div className="flex items-center gap-2 bg-white/15 rounded-xl px-4 py-2">
            <span className="text-2xl">🪙</span>
            <div>
              <p className="text-white font-black text-xl leading-none">1,250</p>
              <p className="text-white/70 text-xs">{t('families.mock_data.accumulated_coins')}</p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{t('families.mock_data.today_progress')}</span>
            <span className="text-xs font-black text-orange-600 dark:text-orange-400">{pct}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#ff6b6b] to-[#e64980] rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Tasks */}
        <div className="px-5 pb-5 space-y-2">
          {tasks.map((task, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${task.done ? 'bg-green-50 dark:bg-green-900/15' : 'bg-gray-50 dark:bg-slate-800/50'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${task.done ? 'bg-green-500' : 'border-2 border-gray-300 dark:border-gray-600'}`}>
                {task.done && <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>
              <span className={`text-sm font-semibold flex-1 ${task.done ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>{task.label}</span>
              <div className="flex items-center gap-1 text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                🪙 {task.coins}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Streak badge */}
      <div className="absolute -top-3 -right-3 bg-gradient-to-br from-orange-400 to-red-500 text-white px-3 py-1.5 rounded-xl shadow-lg text-xs font-black flex items-center gap-1.5 z-10 animate-glow-pulse">
        <Flame className="w-3.5 h-3.5" /> {t('families.mock_data.streak_days', { count: 7 })}
      </div>
    </div>
  );
}

/* ─── Task manager preview ────────────────────────────────────────────────── */
function TaskManagerPreview({ t }: { t: any }) {
  const [activeTask, setActiveTask] = useState<number | null>(null);
  const tasks = [
    { icon: '📚', label: t('families.mock_data.complete_lesson'), reward: 60, category: t('families.mock_data.category_learning'), color: 'from-purple-400 to-blue-500' },
    { icon: '🧹', label: t('families.mock_data.tidy_room'), reward: 35, category: t('families.mock_data.category_home'), color: 'from-pink-400 to-rose-500' },
    { icon: '🌱', label: t('families.mock_data.water_plants'), reward: 20, category: t('families.mock_data.category_home'), color: 'from-green-400 to-emerald-500' },
    { icon: '🎯', label: t('families.mock_data.practice_piano'), reward: 45, category: t('families.mock_data.category_skill'), color: 'from-amber-400 to-orange-500' },
  ];

  return (
    <div className="relative w-full max-w-sm mx-auto select-none">
      <div className="absolute -inset-4 bg-gradient-to-br from-[#ff6b6b]/15 to-[#7048e8]/15 dark:from-[#ff6b6b]/10 dark:to-[#7048e8]/10 rounded-3xl blur-3xl -z-10" />
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-gray-900 dark:text-white">{t('families.mock_data.tasks_title', { name: 'Luna' })}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('families.mock_data.pending_tasks', { count: 4 })} · {t('families.mock_data.available_coins', { count: 160 })}</p>
            </div>
            <button className="w-8 h-8 rounded-full bg-gradient-to-r from-[#ff6b6b] to-[#e64980] text-white flex items-center justify-center text-lg font-black shadow-md">+</button>
          </div>
        </div>
        <div className="p-4 space-y-2">
          {tasks.map((task, i) => (
            <div key={i} onClick={() => setActiveTask(activeTask === i ? null : i)}
              className={`group p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${activeTask === i ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/15 shadow-md' : 'border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600 bg-gray-50/50 dark:bg-slate-800/30'}`}>
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
                <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-800/40 flex gap-2">
                  <button className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#ff6b6b] to-[#e64980] text-white text-xs font-bold shadow-sm">{t('families.mock_data.mark_done')}</button>
                  <button className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-xs font-bold">{t('families.mock_data.edit')}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Marketplace preview ─────────────────────────────────────────────────── */
function MarketplacePreview({ t }: { t: any }) {
  const items = [
    { emoji: '💰', label: t('families.mock_data.pocket_money'), price: 500, desc: '≈ $2 USD', badge: 'Popular', badgeColor: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
    { emoji: '🎮', label: t('families.mock_data.game_time'), price: 200, desc: '30 min extra', badge: t('families.mock_data.badge_new'), badgeColor: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
    { emoji: '🍕', label: t('families.mock_data.choose_dinner'), price: 350, desc: t('families.mock_data.choose_dinner_desc'), badge: null, badgeColor: '' },
    { emoji: '⭐', label: t('families.mock_data.premium_lesson'), price: 150, desc: t('families.mock_data.premium_lesson_desc'), badge: 'LF+', badgeColor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  ];

  return (
    <div className="relative w-full max-w-sm mx-auto select-none">
      <div className="absolute -inset-4 bg-gradient-to-br from-emerald-200/20 to-teal-200/20 dark:from-emerald-900/10 dark:to-teal-900/10 rounded-3xl blur-3xl -z-10" />
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">{t('families.mock_data.marketplace_header')}</p>
              <p className="text-white font-black text-lg">Marketplace</p>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 rounded-xl px-3 py-1.5">
              <span className="text-lg">🪙</span>
              <span className="text-white font-black">1,250</span>
            </div>
          </div>
        </div>
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
            {t('families.marketplace.feature_1')} →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Parent analytics preview ───────────────────────────────────────────── */
function ParentDashboardPreview({ t }: { t: any }) {
  const barData = [40, 65, 30, 80, 55, 90, 72];
  const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const maxBar = Math.max(...barData);

  return (
    <div className="relative w-full max-w-sm mx-auto select-none">
      <div className="absolute -inset-4 bg-gradient-to-br from-blue-200/20 to-indigo-200/20 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-3xl blur-3xl -z-10" />
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-5">
          <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">{t('families.mock_data.parent_dashboard')}</p>
          <p className="text-white font-black text-lg">{t('families.mock_data.weekly_progress')}</p>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {[
              { label: t('families.mock_data.completed_tasks'), value: '14', icon: '✅' },
              { label: t('families.mock_data.coins_earned'), value: '380', icon: '🪙' },
              { label: t('families.mock_data.streak_label'), value: '7d', icon: '🔥' },
            ].map((stat, i) => (
              <div key={i} className="bg-white/15 rounded-xl p-2 text-center">
                <div className="text-lg">{stat.icon}</div>
                <div className="text-white font-black text-sm">{stat.value}</div>
                <div className="text-white/60 text-[10px]">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-5">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t('families.mock_data.daily_activity')}</p>
          <div className="flex items-end gap-2 h-20">
            {barData.map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-lg bg-gradient-to-t from-blue-500 to-indigo-400 hover:from-blue-600 hover:to-indigo-500 transition-all duration-700" style={{ height: `${(val / maxBar) * 64}px` }} />
                <span className="text-[10px] text-gray-400 font-semibold">{days[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="px-5 pb-5 space-y-2">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('families.mock_data.recent_lessons')}</p>
          {[
            { topic: t('families.mock_data.saving_investing'), score: 95, emoji: '💰' },
            { topic: t('families.mock_data.family_budget'), score: 82, emoji: '📊' },
          ].map((lesson, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl">
              <span className="text-lg">{lesson.emoji}</span>
              <span className="flex-1 text-xs font-semibold text-gray-700 dark:text-gray-300">{lesson.topic}</span>
              <span className="text-xs font-black text-blue-600 dark:text-blue-400">{lesson.score}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-2 -left-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg px-3 py-2 flex items-center gap-2 z-10 max-w-[180px]">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{t('families.mock_data.sofia_notification')}</span>
      </div>
    </div>
  );
}

/* ─── Section badge ───────────────────────────────────────────────────────── */
function SectionBadge({ emoji, label, colorClass }: { emoji: string; label: string; colorClass: string }) {
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${colorClass}`}>
      <span className="text-base">{emoji}</span>
      <span className="text-xs lg:text-sm font-bold uppercase tracking-wider">{label}</span>
    </div>
  );
}

/* ─── Feature row item ────────────────────────────────────────────────────── */
function FeatureRow({ icon: Icon, text, colorClass, bgClass }: { icon: React.ElementType; text: string; colorClass: string; bgClass: string }) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200/60 dark:border-slate-700/50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
      <div className={`w-10 h-10 rounded-xl ${bgClass} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
        <Icon className={`w-5 h-5 ${colorClass}`} />
      </div>
      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 leading-relaxed">{text}</span>
    </div>
  );
}

/* ─── PAGE ────────────────────────────────────────────────────────────────── */
export default function FamiliesPage() {
  const { t, i18n } = useTranslation('landing');
  const lang = i18n.language;

  return (
    <LandingLayout>
      <div className="min-h-screen">

        {/* ════════════════════════════════════════════════════════
            HERO — warm amber sunburst, cozy family energy
        ════════════════════════════════════════════════════════ */}
        <section className="relative pt-20 lg:pt-32 pb-0 px-4 overflow-hidden min-h-[92vh] flex flex-col justify-center hero-sunburst dark:bg-[#16112a]">

          {/* Ambient glows */}
          <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
            <div className="absolute top-10 right-[5%] w-[500px] h-[500px] bg-orange-300/15 dark:bg-orange-900/10 rounded-full blur-[100px] animate-orb-1" />
            <div className="absolute bottom-10 left-[10%] w-[400px] h-[400px] bg-pink-300/15 dark:bg-pink-900/8 rounded-full blur-[100px] animate-orb-2" style={{ animationDelay: '3s' }} />
          </div>

          {/* Floating decos */}
          <div className="absolute top-28 left-[6%] text-3xl opacity-40 animate-float pointer-events-none" style={{ animationDelay: '0.5s' }}>👨‍👩‍👧</div>
          <div className="absolute top-40 right-[8%] text-2xl opacity-30 animate-float pointer-events-none" style={{ animationDelay: '1.5s' }}>🪙</div>
          <div className="absolute bottom-32 left-[18%] text-2xl opacity-30 animate-float pointer-events-none" style={{ animationDelay: '0.8s' }}>⭐</div>

          <div className="max-w-7xl mx-auto w-full relative z-10 pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

              {/* LEFT */}
              <div className="space-y-6">

                {/* Coming-soon badge */}
                <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/80 dark:bg-white/10 backdrop-blur-sm border border-amber-300 dark:border-amber-700/50 shadow-lg animate-fade-in-up">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-bold text-amber-800 dark:text-amber-300">{t('families.hero.coming_soon_label')}</span>
                </div>

                <h1 className="landing-heading text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white leading-[1.1] tracking-tight animate-fade-in-up-delay-1">
                  {t('families.hero.title_part1')}
                  <span className="block mt-1">
                    <span className="relative inline-block">
                      <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b6b] to-[#7048e8]">
                        {t('families.hero.title_highlight')}
                      </span>
                      <svg className="absolute -bottom-1.5 left-0 w-full" viewBox="0 0 200 10" fill="none" preserveAspectRatio="none">
                        <path d="M2 6 C50 1, 100 9, 150 4 C170 2, 190 7, 198 5" stroke="url(#fam-squiggle)" strokeWidth="3" strokeLinecap="round" fill="none"/>
                        <defs>
                          <linearGradient id="fam-squiggle" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#ff6b6b"/>
                            <stop offset="100%" stopColor="#7048e8"/>
                          </linearGradient>
                        </defs>
                      </svg>
                    </span>
                  </span>
                  <span className="block mt-1">{t('families.hero.title_part2')}</span>
                </h1>

                <p className="text-base lg:text-lg text-gray-700 dark:text-gray-300 max-w-xl leading-relaxed font-medium animate-fade-in-up-delay-2">
                  {t('families.hero.subtitle')}
                </p>

                {/* Steps */}
                <div className="flex flex-col gap-3 animate-fade-in-up-delay-2">
                  {[
                    { n: 1, icon: '📋', text: t('families.hero.step_1') },
                    { n: 2, icon: '✅', text: t('families.hero.step_2') },
                    { n: 3, icon: '🎁', text: t('families.hero.step_3') },
                  ].map(step => (
                    <div key={step.n} className="flex items-center gap-3 p-3 rounded-2xl bg-white/70 dark:bg-slate-900/50 border border-gray-200/60 dark:border-slate-700/50 backdrop-blur-sm hover:shadow-md transition-all">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 text-white text-xs font-black flex items-center justify-center shadow-md flex-shrink-0">{step.n}</div>
                      <span className="text-base mr-1">{step.icon}</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{step.text}</span>
                    </div>
                  ))}
                </div>

                {/* Email CTA */}
                <div className="space-y-3 pt-1 animate-fade-in-up-delay-3">
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
              <div className="flex justify-center items-center pt-4 lg:pt-0 animate-fade-in-up-delay-2">
                <HeroDashboardPreview t={t} />
              </div>
            </div>
          </div>

          {/* Wave bottom */}
          <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none" style={{ height: 64 }}>
            <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,30 C360,64 720,15 1080,45 C1260,60 1380,20 1440,35 L1440,64 L0,64 Z" className="fill-white dark:fill-slate-950" />
            </svg>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            TASK MANAGER — pink-tinted warm background
        ════════════════════════════════════════════════════════ */}
        <section className="relative py-20 lg:py-28 px-4 overflow-hidden bg-rose-50/70 dark:bg-slate-950">

          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute top-10 right-10 w-[400px] h-[400px] bg-pink-300/10 dark:bg-pink-900/5 rounded-full blur-3xl" />
          </div>

          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <SectionBadge emoji="🎯" label={t('families.task_manager.badge')} colorClass="bg-pink-100/80 dark:bg-pink-900/30 border-pink-200/60 dark:border-pink-800/40 text-pink-700 dark:text-pink-300 mb-4" />
              <h2 className="landing-heading mt-4 text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white leading-tight">
                {t('families.task_manager.title')}
              </h2>
              <p className="mt-3 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-base lg:text-lg leading-relaxed">
                {t('families.task_manager.description')}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-center">
              {/* Feature list */}
              <div className="space-y-3 lg:order-1">
                {[
                  { icon: Target, text: t('families.task_manager.feature_1'), colorClass: 'text-pink-600 dark:text-pink-400', bgClass: 'bg-pink-100 dark:bg-pink-900/30' },
                  { icon: Zap, text: t('families.task_manager.feature_2'), colorClass: 'text-yellow-600 dark:text-yellow-400', bgClass: 'bg-yellow-100 dark:bg-yellow-900/30' },
                  { icon: Shield, text: t('families.task_manager.feature_3'), colorClass: 'text-blue-600 dark:text-blue-400', bgClass: 'bg-blue-100 dark:bg-blue-900/30' },
                  { icon: Sparkles, text: t('families.task_manager.feature_4'), colorClass: 'text-violet-600 dark:text-violet-400', bgClass: 'bg-violet-100 dark:bg-violet-900/30' },
                ].map((f, i) => <FeatureRow key={i} {...f} />)}
              </div>

              {/* Mockup */}
              <div className="flex justify-center lg:order-2">
                <TaskManagerPreview t={t} />
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

          {/* Wave bottom */}
          <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none" style={{ height: 64 }}>
            <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,45 C480,10 960,60 1440,25 L1440,64 L0,64 Z" className="fill-white dark:fill-[#080a14]" />
            </svg>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            MARKETPLACE — white/light section
        ════════════════════════════════════════════════════════ */}
        <section className="relative py-20 lg:py-28 px-4 overflow-hidden bg-white dark:bg-[#080a14]">

          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute bottom-0 left-10 w-[500px] h-[500px] bg-emerald-300/8 dark:bg-emerald-900/5 rounded-full blur-3xl" />
          </div>

          {/* Wave top */}
          <div className="absolute top-0 left-0 w-full overflow-hidden leading-none" style={{ height: 64 }}>
            <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,0 C480,50 960,5 1440,40 L1440,0 L0,0 Z" className="fill-rose-50/70 dark:fill-slate-950" />
            </svg>
          </div>

          <div className="max-w-7xl mx-auto pt-8">
            <div className="text-center mb-12">
              <SectionBadge emoji="🎁" label={t('families.marketplace.badge')} colorClass="bg-emerald-100/80 dark:bg-emerald-900/30 border-emerald-200/60 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 mb-4" />
              <h2 className="landing-heading mt-4 text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white leading-tight">
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
                <MarketplacePreview t={t} />
              </div>

              {/* Features */}
              <div className="space-y-4 order-3">
                {[
                  { icon: Gift, text: t('families.marketplace.feature_1'), colorClass: 'text-emerald-600 dark:text-emerald-400', bgClass: 'bg-emerald-100 dark:bg-emerald-900/30' },
                  { icon: Star, text: t('families.marketplace.feature_2'), colorClass: 'text-amber-600 dark:text-amber-400', bgClass: 'bg-amber-100 dark:bg-amber-900/30' },
                  { icon: TrendingUp, text: t('families.marketplace.feature_3'), colorClass: 'text-blue-600 dark:text-blue-400', bgClass: 'bg-blue-100 dark:bg-blue-900/30' },
                ].map((f, i) => <FeatureRow key={i} {...f} />)}

                {/* Coin flow */}
                <div className="mt-2 p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/60 dark:border-amber-800/30">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider mb-3">{t('families.mock_data.cycle_label')}</p>
                  <div className="flex items-center gap-2 text-sm">
                    {[t('families.mock_data.task_step'), t('families.mock_data.coins_step'), t('families.mock_data.reward_step')].map((step, i, arr) => (
                      <React.Fragment key={i}>
                        <span className="font-bold text-gray-700 dark:text-gray-300 text-xs text-center flex-1">{step}</span>
                        {i < arr.length - 1 && <span className="text-orange-400 font-black text-lg">→</span>}
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
                { icon: <Brain className="w-6 h-6 text-violet-600 dark:text-violet-400" />, title: t('families.marketplace.item_3_title'), description: t('families.marketplace.item_3_desc') },
              ].map((card, i) => <FeatureCard key={i} {...card} />)}
            </div>
          </div>

          {/* Wave bottom */}
          <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none" style={{ height: 64 }}>
            <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,20 C360,60 720,10 1080,50 C1260,65 1380,25 1440,40 L1440,64 L0,64 Z" className="fill-sky-50/70 dark:fill-[#0a0f1e]" />
            </svg>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            PARENT TOOLS — sky-tinted
        ════════════════════════════════════════════════════════ */}
        <section className="relative py-20 lg:py-28 px-4 overflow-hidden bg-sky-50/70 dark:bg-[#0a0f1e]">

          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute top-0 right-[10%] w-[400px] h-[400px] bg-blue-300/10 dark:bg-blue-900/5 rounded-full blur-3xl" />
          </div>

          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <SectionBadge emoji="📊" label={t('families.parent_tools.badge')} colorClass="bg-blue-100/80 dark:bg-blue-900/30 border-blue-200/60 dark:border-blue-800/40 text-blue-700 dark:text-blue-300 mb-4" />
              <h2 className="landing-heading mt-4 text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white leading-tight">
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
                  { icon: BarChart3, text: t('families.parent_tools.feature_1'), colorClass: 'text-blue-600 dark:text-blue-400', bgClass: 'bg-blue-100 dark:bg-blue-900/30' },
                  { icon: Users, text: t('families.parent_tools.feature_2'), colorClass: 'text-violet-600 dark:text-violet-400', bgClass: 'bg-violet-100 dark:bg-violet-900/30' },
                  { icon: LineChart, text: t('families.parent_tools.feature_3'), colorClass: 'text-indigo-600 dark:text-indigo-400', bgClass: 'bg-indigo-100 dark:bg-indigo-900/30' },
                ].map((f, i) => <FeatureRow key={i} {...f} />)}

                {/* Conversation prompt */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/60 dark:border-blue-800/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">💬</span>
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">{t('families.mock_data.conversation_prompt')}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{t('families.mock_data.conversation_text', { child_name: 'Sofía', topic: 'ahorro' })}"</p>
                </div>
              </div>

              {/* Mockup */}
              <div className="flex justify-center lg:order-2">
                <ParentDashboardPreview t={t} />
              </div>

              {/* Character */}
              <div className="hidden lg:flex justify-center items-end h-96 lg:order-3">
                <DrRhoCharacter mood="wise" className="drop-shadow-2xl w-full h-full" />
              </div>
            </div>

            <div className="mt-14">
              <BenefitGrid columns={3} items={[
                { icon: <BarChart3 className="w-8 h-8 text-pink-600 dark:text-pink-400" />, title: t('families.parent_tools.insight_1_title'), description: t('families.parent_tools.insight_1_desc') },
                { icon: <LineChart className="w-8 h-8 text-blue-600 dark:text-blue-400" />, title: t('families.parent_tools.insight_2_title'), description: t('families.parent_tools.insight_2_desc') },
                { icon: <Users className="w-8 h-8 text-violet-600 dark:text-violet-400" />, title: t('families.parent_tools.insight_3_title'), description: t('families.parent_tools.insight_3_desc') },
                { icon: <Shield className="w-8 h-8 text-green-600 dark:text-green-400" />, title: t('families.parent_tools.insight_4_title'), description: t('families.parent_tools.insight_4_desc') },
                { icon: <Brain className="w-8 h-8 text-orange-600 dark:text-orange-400" />, title: t('families.parent_tools.insight_5_title'), description: t('families.parent_tools.insight_5_desc') },
                { icon: <Trophy className="w-8 h-8 text-pink-600 dark:text-pink-400" />, title: t('families.parent_tools.insight_6_title'), description: t('families.parent_tools.insight_6_desc') },
              ]} />
            </div>
          </div>

          {/* Wave bottom */}
          <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none" style={{ height: 64 }}>
            <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,40 C480,10 960,55 1440,20 L1440,64 L0,64 Z" className="fill-white dark:fill-slate-950" />
            </svg>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            BENEFITS — white with ZaraVex + testimonial
        ════════════════════════════════════════════════════════ */}
        <section className="relative py-20 lg:py-28 px-4 overflow-hidden bg-white dark:bg-slate-950">

          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-pink-300/8 dark:bg-pink-900/5 rounded-full blur-3xl" />
          </div>

          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Character */}
              <div className="relative hidden lg:flex justify-center items-end h-[500px] order-2 lg:order-1">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-100/40 to-pink-100/40 dark:from-violet-900/10 dark:to-pink-900/10 rounded-3xl blur-3xl" />
                <ZaraVexCharacter mood="happy" className="drop-shadow-2xl w-full h-full relative z-10" />
                {/* Testimonial bubble */}
                <div className="absolute top-4 right-0 max-w-[210px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 p-4 z-20">
                  <div className="flex gap-0.5 mb-2">
                    {[1,2,3,4,5].map(s => <Star key={s} className="w-3 h-3 text-yellow-400 fill-yellow-400" />)}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 italic leading-relaxed">"{t('families.benefits.testimonial_text')}"</p>
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-2">{t('families.benefits.testimonial_author')}</p>
                </div>
              </div>

              {/* Content */}
              <div className="space-y-7 order-1 lg:order-2">
                <SectionBadge emoji="❤️" label={t('families.benefits.badge')} colorClass="bg-violet-100/80 dark:bg-violet-900/30 border-violet-200/60 dark:border-violet-800/40 text-violet-700 dark:text-violet-300" />

                <div>
                  <h2 className="landing-heading text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white leading-tight mb-4">
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
                    { icon: <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />, title: t('families.benefits.benefit_4_title'), description: t('families.benefits.benefit_4_desc'), bg: 'bg-violet-50 dark:bg-violet-900/10' },
                  ].map((item, idx) => (
                    <div key={idx} className={`flex gap-4 p-4 rounded-2xl ${item.bg} border border-gray-200/60 dark:border-gray-700/40 hover:shadow-md transition-all hover:-translate-y-0.5 group cursor-pointer`}>
                      <div className="flex-shrink-0 mt-0.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 shadow-sm group-hover:scale-110 transition-transform">
                        {item.icon}
                      </div>
                      <div>
                        <h3 className="landing-heading font-black text-gray-900 dark:text-white text-sm mb-0.5">{item.title}</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            CTA — warm gradient, celebratory
        ════════════════════════════════════════════════════════ */}
        <section className="relative py-24 lg:py-32 px-4 overflow-hidden bg-gradient-to-br from-orange-50 via-pink-50/60 to-violet-50/40 dark:from-[#1a0f2e] dark:via-slate-950 dark:to-[#0f1a2e]">

          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-br from-orange-300/15 via-pink-300/15 to-violet-300/15 dark:from-orange-900/10 dark:via-pink-900/10 dark:to-violet-900/10 rounded-full blur-3xl" />
          </div>

          {/* Floating decos */}
          <div className="absolute top-8 left-16 text-3xl opacity-20 animate-float pointer-events-none" style={{ animationDelay: '0.3s' }}>🎉</div>
          <div className="absolute top-12 right-20 text-2xl opacity-20 animate-float pointer-events-none" style={{ animationDelay: '1.2s' }}>⭐</div>
          <div className="absolute bottom-8 left-24 text-2xl opacity-20 animate-float pointer-events-none" style={{ animationDelay: '0.8s' }}>🪙</div>
          <div className="absolute bottom-12 right-16 text-3xl opacity-15 animate-float pointer-events-none" style={{ animationDelay: '2s' }}>✨</div>

          <div className="max-w-3xl mx-auto text-center relative z-10">
            <div className="relative p-10 lg:p-16 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-orange-200/50 dark:border-slate-700/50 shadow-2xl">

              {/* Top accent line */}
              <div className="absolute top-0 left-8 right-8 h-1 bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 rounded-full" />

              <div className="space-y-6">
                <div className="text-5xl">🚀</div>
                <h2 className="landing-heading text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white leading-tight">
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
                <div key={i} className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/40 shadow-sm">
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
