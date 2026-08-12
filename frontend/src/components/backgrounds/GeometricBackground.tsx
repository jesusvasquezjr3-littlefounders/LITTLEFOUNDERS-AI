import React from 'react';

/**
 * Clean animated geometric background with flowing curves and scattered circles.
 * Minimalist composition: massive background layers, organic curves, dispersed circles.
 */
export const GeometricBackground: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={`absolute inset-0 overflow-visible ${className ?? ''}`} aria-hidden="true">
      <style>{`
        .geo-float-1 { animation: geoFloat1 7.2s ease-in-out infinite; }
        .geo-float-2 { animation: geoFloat2 8.5s ease-in-out infinite; animation-delay: 0.5s; }
        .geo-float-3 { animation: geoFloat3 6.8s ease-in-out infinite; animation-delay: 1s; }
        .geo-float-4 { animation: geoFloat4 9s ease-in-out infinite; animation-delay: 1.5s; }
        .geo-float-5 { animation: geoFloat5 7.5s ease-in-out infinite; animation-delay: 0.8s; }
        .geo-sway-1 { animation: geoSway1 5s ease-in-out infinite; }
        .geo-sway-2 { animation: geoSway2 6.5s ease-in-out infinite; animation-delay: 1s; }

        @keyframes geoFloat1 {
          0%, 100% { transform: translateY(0) translateX(0); }
          33% { transform: translateY(-28px) translateX(12px); }
          66% { transform: translateY(-18px) translateX(-8px); }
        }
        @keyframes geoFloat2 {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-32px) translateX(-15px); }
          75% { transform: translateY(-12px) translateX(10px); }
        }
        @keyframes geoFloat3 {
          0%, 100% { transform: translateY(0) translateX(0); }
          40% { transform: translateY(-25px) translateX(20px); }
          60% { transform: translateY(-8px) translateX(-5px); }
        }
        @keyframes geoFloat4 {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-35px); }
        }
        @keyframes geoFloat5 {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-22px) rotate(2deg); }
        }
        @keyframes geoSway1 {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(18px); }
        }
        @keyframes geoSway2 {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-16px); }
        }

        @media (prefers-reduced-motion: reduce) {
          [class^="geo-"] { animation: none !important; }
        }
      `}</style>

      <svg
        className="absolute w-full h-full"
        viewBox="-400 -400 1800 1600"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        {/* ══════════════════════════════════════════════════════════════
            LAYER 0: MASSIVE BACKGROUND CIRCLES (ultra-low opacity, back)
        ══════════════════════════════════════════════════════════════ */}

        {/* Gigantic circle - top left - pink */}
        <circle cx="-100" cy="-150" r="450" fill="#FF6B9D" opacity="0.12" className="geo-float-1" />

        {/* Gigantic circle - bottom right - yellow */}
        <circle cx="1300" cy="1200" r="480" fill="#FFD93D" opacity="0.10" className="geo-float-4" />

        {/* Gigantic circle - top right - purple */}
        <circle cx="1400" cy="-200" r="420" fill="#A78BFA" opacity="0.11" className="geo-float-2" />

        {/* Gigantic circle - bottom left - green */}
        <circle cx="-150" cy="1400" r="460" fill="#86EFAC" opacity="0.09" className="geo-float-5" />

        {/* Gigantic circle - center - blue */}
        <circle cx="500" cy="600" r="500" fill="#38BDF8" opacity="0.08" className="geo-float-3" />

        {/* ══════════════════════════════════════════════════════════════
            LAYER 1: MASSIVE ELLIPSES (very low opacity, depth)
        ══════════════════════════════════════════════════════════════ */}

        {/* Massive ellipse - top center - light pink */}
        <ellipse cx="500" cy="0" rx="550" ry="300" fill="#F472B6" opacity="0.10" className="geo-float-2" />

        {/* Massive ellipse - bottom center - light green */}
        <ellipse cx="500" cy="1200" rx="600" ry="350" fill="#6EE7B7" opacity="0.09" className="geo-float-4" />

        {/* Massive ellipse - left side - light blue */}
        <ellipse cx="-100" cy="600" rx="350" ry="500" fill="#7DD3FC" opacity="0.08" className="geo-float-1" />

        {/* Massive ellipse - right side - light coral */}
        <ellipse cx="1200" cy="600" rx="400" ry="480" fill="#FCA5A5" opacity="0.09" className="geo-float-3" />

        {/* ══════════════════════════════════════════════════════════════
            LAYER 2: ACCENT CURVES & PATHS (flowing lazos)
        ══════════════════════════════════════════════════════════════ */}

        {/* Curved line - top - blue */}
        <path
          d="M -100 300 Q 300 200 600 350 T 1200 400"
          stroke="#38BDF8"
          strokeWidth="12"
          fill="none"
          opacity="0.5"
          strokeLinecap="round"
          className="geo-float-2 geo-sway-1"
        />

        {/* Curved line - upper middle - coral */}
        <path
          d="M 100 450 Q 450 350 900 500 T 1300 480"
          stroke="#FB7185"
          strokeWidth="14"
          fill="none"
          opacity="0.45"
          strokeLinecap="round"
          className="geo-float-3 geo-sway-2"
        />

        {/* Curved line - middle - yellow */}
        <path
          d="M -80 700 Q 350 600 750 750 T 1280 720"
          stroke="#FCD34D"
          strokeWidth="13"
          fill="none"
          opacity="0.48"
          strokeLinecap="round"
          className="geo-float-1 geo-sway-1"
        />

        {/* Wavy line - bottom - green */}
        <path
          d="M 50 950 Q 280 850 580 1000 T 1150 980"
          stroke="#86EFAC"
          strokeWidth="11"
          fill="none"
          opacity="0.50"
          strokeLinecap="round"
          className="geo-float-5 geo-sway-2"
        />

        {/* Arc accent - left side - purple */}
        <path
          d="M -150 200 Q -50 450 0 650"
          stroke="#A78BFA"
          strokeWidth="12"
          fill="none"
          opacity="0.48"
          strokeLinecap="round"
          className="geo-float-4"
        />

        {/* Arc accent - right side - light pink */}
        <path
          d="M 1350 150 Q 1250 400 1200 650"
          stroke="#F472B6"
          strokeWidth="13"
          fill="none"
          opacity="0.45"
          strokeLinecap="round"
          className="geo-float-2"
        />

        {/* ══════════════════════════════════════════════════════════════
            LAYER 3: DISPERSED CIRCLES (circulitos scattered)
        ══════════════════════════════════════════════════════════════ */}

        {/* Top left area */}
        <circle cx="180" cy="200" r="35" fill="#FF6B9D" opacity="0.65" className="geo-float-3" />

        {/* Top center-left */}
        <circle cx="420" cy="80" r="42" fill="#38BDF8" opacity="0.62" className="geo-float-1" style={{ animationDelay: '0.5s' }} />

        {/* Top right area */}
        <circle cx="950" cy="180" r="48" fill="#FFD93D" opacity="0.68" className="geo-float-2" style={{ animationDelay: '0.3s' }} />

        {/* Top far right */}
        <circle cx="1280" cy="120" r="38" fill="#FB7185" opacity="0.60" className="geo-float-4" style={{ animationDelay: '1s' }} />

        {/* Left middle area */}
        <circle cx="80" cy="480" r="50" fill="#38BDF8" opacity="0.70" className="geo-float-5" />

        {/* Center-left */}
        <circle cx="280" cy="650" r="45" fill="#86EFAC" opacity="0.65" className="geo-float-2" style={{ animationDelay: '0.8s' }} />

        {/* Center area */}
        <circle cx="550" cy="500" r="55" fill="#F472B6" opacity="0.68" className="geo-float-3" style={{ animationDelay: '1.2s' }} />

        {/* Center-right */}
        <circle cx="800" cy="350" r="48" fill="#A78BFA" opacity="0.64" className="geo-float-1" style={{ animationDelay: '0.4s' }} />

        {/* Right middle area */}
        <circle cx="1150" cy="520" r="52" fill="#6EE7B7" opacity="0.66" className="geo-float-4" style={{ animationDelay: '1.5s' }} />

        {/* Far right area */}
        <circle cx="1350" cy="720" r="40" fill="#FCD34D" opacity="0.62" className="geo-float-2" style={{ animationDelay: '0.6s' }} />

        {/* Bottom left area */}
        <circle cx="150" cy="1000" r="38" fill="#FB7185" opacity="0.60" className="geo-float-3" style={{ animationDelay: '0.9s' }} />

        {/* Bottom center-left */}
        <circle cx="420" cy="1100" r="44" fill="#7DD3FC" opacity="0.65" className="geo-float-5" style={{ animationDelay: '0.2s' }} />

        {/* Bottom center */}
        <circle cx="680" cy="1050" r="50" fill="#86EFAC" opacity="0.68" className="geo-float-1" style={{ animationDelay: '1.1s' }} />

        {/* Bottom center-right */}
        <circle cx="950" cy="1120" r="42" fill="#A78BFA" opacity="0.63" className="geo-float-4" style={{ animationDelay: '0.7s' }} />

        {/* Bottom right area */}
        <circle cx="1250" cy="950" r="48" fill="#FF6B9D" opacity="0.66" className="geo-float-2" style={{ animationDelay: '1.3s' }} />
      </svg>
    </div>
  );
};

export default GeometricBackground;
