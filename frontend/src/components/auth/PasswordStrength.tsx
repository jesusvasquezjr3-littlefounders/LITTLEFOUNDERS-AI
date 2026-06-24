import { useTranslation } from 'react-i18next';

interface PasswordStrengthProps {
  password?: string;
}

const PASSWORD_STRENGTH_LEVELS = [
  'very_weak',
  'weak',
  'acceptable',
  'good',
  'strong',
  'very_strong',
] as const;

const STRENGTH_COLORS = [
  'bg-red-500',
  'bg-red-500',
  'bg-indigo-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-green-700',
];

function getStrength(password: string): number {
  let score = 0;
  if (!password) return score;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return Math.min(score, 5);
}

const PasswordStrength = ({ password = '' }: PasswordStrengthProps) => {
  const { t } = useTranslation('auth');

  if (!password) return null;

  const strength = getStrength(password);
  const levelKey = PASSWORD_STRENGTH_LEVELS[strength];
  const barColor = STRENGTH_COLORS[strength];

  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {t('password_strength.label')}
        </span>
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
          {t(`password_strength.levels.${levelKey}`)}
        </span>
      </div>
      <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-[width,background-color] duration-300 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] ${barColor}`}
          style={{ width: `${(strength / 5) * 100}%` }}
        />
      </div>
    </div>
  );
};

export { PasswordStrength };
