import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Flag } from "lucide-react";
import { ReportModal } from "./ReportModal";

/**
 * ReportFAB — Floating Action Button para levantar un reporte desde cualquier página.
 *
 * Características:
 * - Diseño "Glassmorphism" sutil y no intrusivo.
 * - Soporte para arrastrar y soltar (Drag & Drop) con auto-acoplamiento a los bordes.
 * - Persistencia de posición mediante localStorage.
 * - Tamaño reducido para no obstruir la navegación.
 */
interface ReportFABProps {
  /**
   * Cuando `inline` es true, el botón se renderiza como un elemento
   * de bloque (no flotante), útil para embeberse en páginas como /help.
   */
  inline?: boolean;
  /** Clase CSS adicional para el botón contenedor */
  className?: string;
}

export function ReportFAB({ inline = false, className = "" }: ReportFABProps) {
  const { t } = useTranslation("reports");
  const [open, setOpen] = useState(false);
  
  // ── Position & Drag State ──
  // We only track Y now. X is fixed to the right.
  const [yPos, setYPos] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startY: number; initialY: number } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Load saved Y position
  useEffect(() => {
    if (inline) return;
    const saved = localStorage.getItem("report_fab_y");
    if (saved) {
      setYPos(parseFloat(saved));
    }
  }, [inline]);

  // Handle window resize to keep button within vertical bounds
  useEffect(() => {
    if (inline || yPos === null) return;
    
    const handleResize = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const padding = 24;
      const screenHeight = window.innerHeight;
      const maxY = screenHeight - rect.height - padding;
      
      if (yPos > maxY || yPos < padding) {
        const newY = Math.max(padding, Math.min(yPos, maxY));
        setYPos(newY);
        localStorage.setItem("report_fab_y", newY.toString());
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [inline, yPos]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (inline) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragRef.current = {
      startY: e.clientY,
      initialY: rect.top,
    };
    setIsDragging(false);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    
    const dy = e.clientY - dragRef.current.startY;

    if (!isDragging && Math.abs(dy) > 5) {
      setIsDragging(true);
    }

    if (isDragging) {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenHeight = window.innerHeight;
      const padding = 16;
      
      const nextY = Math.max(padding, Math.min(dragRef.current.initialY + dy, screenHeight - rect.height - padding));
      setYPos(nextY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    if (isDragging) {
      if (yPos !== null) {
        localStorage.setItem("report_fab_y", yPos.toString());
      }
    } else {
      setOpen(true);
    }
    
    dragRef.current = null;
    setIsDragging(false);
  };

  if (inline) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className={`
            inline-flex items-center gap-2.5 px-6 py-3 rounded-[20px] corp-body-sm font-bold
            bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border-2 border-white/50 dark:border-slate-700/50
            text-slate-800 dark:text-white shadow-xl hover:shadow-indigo-500/10
            transition-[background-color,border-color,box-shadow] duration-300 hover:border-indigo-400/30
            ${className}
          `}
        >
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-md">
            <Flag className="w-3.5 h-3.5 text-white" />
          </div>
          {t("button_label")}
        </button>
        <ReportModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  // Final style: fixed on the right, dynamic or default Y
  const dynamicStyle: React.CSSProperties = yPos !== null ? {
    top: `${yPos}px`,
  } : {};

  return (
    <>
      <div 
        ref={buttonRef}
        style={dynamicStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`
          fixed z-[9999] group touch-none select-none
          right-6 md:right-8
          ${yPos === null ? 'bottom-24 md:bottom-8' : ''}
          ${isDragging ? 'cursor-grabbing scale-105 opacity-80' : 'cursor-grab'}
          transition-[transform,opacity] duration-200
          ${className}
        `}
      >
        <div className="relative">
          {/* Subtle static glow */}
          <span className="absolute -inset-1 rounded-full bg-gradient-to-br from-indigo-500/10 to-blue-500/10 blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <button
            type="button"
            className={`
              flex items-center gap-2.5 px-4 py-3 rounded-full corp-caption font-bold
              bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-2 border-white/60 dark:border-slate-700/60
              text-slate-800 dark:text-white shadow-2xl
              transition-[scale,background-color,box-shadow] duration-300 ${isDragging ? '' : 'hover:scale-105 active:scale-[0.96]'}
              ${!isDragging && 'group-hover:pr-6'}
            `}
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-md transition-transform duration-300 group-hover:rotate-6">
              <Flag className="w-3.5 h-3.5 text-white" />
            </div>
            <span className={`max-w-0 overflow-hidden transition-[max-width] duration-500 whitespace-nowrap tracking-tight font-bold ${isDragging ? '' : 'group-hover:max-w-[100px]'}`}>
              {t("button_label")}
            </span>
          </button>
        </div>
      </div>

      <ReportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
