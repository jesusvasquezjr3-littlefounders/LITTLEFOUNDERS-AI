import { cn } from '@/lib/utils';

interface FloatingTextItem {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

interface FloatingTextProps {
  texts: FloatingTextItem[];
}

export function FloatingText({ texts }: FloatingTextProps) {
  return (
    <>
      {texts.map((ft) => (
        <div
          key={ft.id}
          className={cn(
            'absolute pointer-events-none pixel-font text-xs sm:text-sm font-bold',
            'animate-float-up-fade'
          )}
          style={{
            left: ft.x,
            top: ft.y,
            color: ft.color,
            zIndex: 55,
            textShadow: '0 0 8px currentColor',
          }}
        >
          {ft.text}
        </div>
      ))}
    </>
  );
}
