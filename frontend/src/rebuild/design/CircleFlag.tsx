import { useId } from 'react';

/**
 * The three launch-market flags, drawn as circles in a 32 px box. They name a
 * language by its country, so they are always decorative: the control that
 * carries one also carries the language's own name as its accessible label.
 */
export type FlagCode = 'MX' | 'US' | 'BR';

export const LOCALE_FLAG: Readonly<Record<string, FlagCode>> = { 'es-MX': 'MX', 'en-US': 'US', 'pt-BR': 'BR' };

function Mexico() {
  return <>
    <rect width="32" height="32" fill="#ffffff" />
    <rect width="10.67" height="32" fill="#006847" />
    <rect x="21.33" width="10.67" height="32" fill="#ce1126" />
    <circle cx="16" cy="16" r="3.2" fill="#8a6a2f" />
    <circle cx="16" cy="16" r="1.9" fill="#4a8b3c" />
  </>;
}

function UnitedStates() {
  const stripes = Array.from({ length: 7 }, (_, index) => <rect key={index} y={index * 4.57} width="32" height="2.29" fill="#b22234" />);
  return <>
    <rect width="32" height="32" fill="#ffffff" />
    {stripes}
    <rect width="15" height="17.7" fill="#3c3b6e" />
    {[3.5, 7.5, 11.5].flatMap((x) => [3.5, 8, 12.5].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" fill="#ffffff" />))}
  </>;
}

function Brazil() {
  return <>
    <rect width="32" height="32" fill="#009c3b" />
    <polygon points="16,4.5 29,16 16,27.5 3,16" fill="#ffdf00" />
    <circle cx="16" cy="16" r="6.2" fill="#002776" />
    <path d="M10.2 14.6c3.7-.9 8.2-.2 11.7 2.3" fill="none" stroke="#ffffff" strokeWidth="1.1" />
  </>;
}

export function CircleFlag({ code, className = 'lf-flag' }: { code: FlagCode; className?: string }) {
  const clip = useId();
  return <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
    <defs><clipPath id={clip}><circle cx="16" cy="16" r="16" /></clipPath></defs>
    <g clipPath={`url(#${clip})`}>{code === 'MX' ? <Mexico /> : code === 'US' ? <UnitedStates /> : <Brazil />}</g>
  </svg>;
}
