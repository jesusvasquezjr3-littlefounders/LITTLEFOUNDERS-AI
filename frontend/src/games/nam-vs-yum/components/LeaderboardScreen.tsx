import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { X, Trophy, Medal } from 'lucide-react';
import type { LeaderboardEntry } from '../types';

interface LeaderboardScreenProps {
  entries: LeaderboardEntry[];
  currentHighScore: number;
  onClose: () => void;
  onSaveEntry?: (entry: LeaderboardEntry) => void;
}

const STORAGE_KEY = 'namvsyum_leaderboard';

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function saveLeaderboard(entries: LeaderboardEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 10)));
  } catch { /* ignore */ }
}

export function LeaderboardScreen({ entries, currentHighScore, onClose, onSaveEntry }: LeaderboardScreenProps) {
  const { t } = useTranslation('games');
  const [nameInput, setNameInput] = useState('');
  const [showInput, setShowInput] = useState(false);

  const sorted = [...entries].sort((a, b) => b.score - a.score).slice(0, 10);
  const isTop10 = sorted.length < 10 || currentHighScore > (sorted[sorted.length - 1]?.score || 0);
  const alreadySaved = sorted.some((e) => e.score === currentHighScore);

  const handleSave = () => {
    if (!nameInput.trim()) return;
    const entry: LeaderboardEntry = {
      name: nameInput.trim(),
      score: currentHighScore,
      level: 1,
      date: new Date().toLocaleDateString(),
    };
    onSaveEntry?.(entry);
    setShowInput(false);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm px-4" style={{ zIndex: 80 }}>
      <div className="w-full max-w-sm bg-slate-900/95 rounded-2xl border border-white/10 p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h2 className="pixel-font text-sm sm:text-base text-white retro-glow">
              {t('namVsYum.leaderboard.title')}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Save score prompt */}
        {isTop10 && !alreadySaved && !showInput && (
          <div className="mb-4 p-3 bg-yellow-500/20 rounded-xl border border-yellow-500/30">
            <p className="pixel-font text-[8px] text-yellow-300 mb-2">
              {t('namVsYum.leaderboard.newHighScore')}
            </p>
            <button
              onClick={() => setShowInput(true)}
              className="pixel-font text-[8px] px-4 py-2 bg-yellow-500 hover:bg-yellow-400 rounded text-black transition-colors"
            >
              {t('namVsYum.leaderboard.saveScore')}
            </button>
          </div>
        )}

        {showInput && (
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={t('namVsYum.leaderboard.enterName')}
              maxLength={12}
              className="flex-1 px-3 py-2 bg-white/10 rounded-lg text-white text-sm placeholder:text-white/30 border border-white/20 focus:border-cyan-400 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <button
              onClick={handleSave}
              className="pixel-font text-[8px] px-4 py-2 bg-green-500 hover:bg-green-400 rounded text-white transition-colors"
            >
              OK
            </button>
          </div>
        )}

        {/* Entries */}
        {sorted.length === 0 ? (
          <p className="text-center text-white/40 text-sm py-8">
            {t('namVsYum.leaderboard.noScores')}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sorted.map((entry, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg',
                  entry.score === currentHighScore
                    ? 'bg-green-900/30 border border-green-500/30'
                    : 'bg-white/5'
                )}
              >
                <div className="w-6 flex justify-center">
                  {idx === 0 && <Medal className="w-4 h-4 text-yellow-400" />}
                  {idx === 1 && <Medal className="w-4 h-4 text-gray-300" />}
                  {idx === 2 && <Medal className="w-4 h-4 text-amber-600" />}
                  {idx > 2 && <span className="pixel-font text-[8px] text-white/40">{idx + 1}</span>}
                </div>
                <span className="flex-1 pixel-font text-[9px] text-white truncate">{entry.name}</span>
                <span className="pixel-font text-[9px] text-yellow-400">{entry.score}</span>
                <span className="pixel-font text-[7px] text-white/30">{entry.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
