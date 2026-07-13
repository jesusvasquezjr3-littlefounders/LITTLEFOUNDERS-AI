// Archipelago — adventure 1 ("El Archipiélago del Trueque", COURSE_ENGINE.md
// §3). ILLUSTRATION ASSET: see scenes.css header for the raw-color + ambient
// motion exemption. Ported + recomposed from LittleFounders v1's
// AdventureCard scene.
import { Atmosphere, Birds, Celestial, StarField } from './sceneParts'

export default function ArchipelagoScene() {
  return (
    <div className="lf-scene relative h-full w-full overflow-hidden bg-gradient-to-b from-[#7fe3f0] via-[#37bfe8] to-[#cdeff5] dark:from-[#06182f] dark:via-[#0b3a5c] dark:to-[#0a5d7a]">
      <StarField />
      <div className="absolute inset-x-0 bottom-[34%] z-0 h-24 bg-gradient-to-t from-amber-200/40 to-transparent blur-md dark:from-sky-300/10" />
      <Celestial className="right-10 top-9" />
      <Birds className="left-[26%] top-[52px]" />

      <div className="absolute left-8 top-10 z-[1] h-[22px] w-[70px] animate-[lf-scene-float-h_8s_ease-in-out_infinite_alternate] rounded-[20px] bg-white/90 blur-[1px] dark:bg-white/10" />
      <div
        className="absolute right-16 top-[74px] z-[1] h-[26px] w-[90px] animate-[lf-scene-float-h_8s_ease-in-out_infinite_alternate] rounded-[20px] bg-white/80 blur-[1px] dark:bg-white/10"
        style={{ animationDelay: '1.4s' }}
      />

      {/* Water band + shimmer */}
      <div className="absolute bottom-0 z-[1] h-[130px] w-full overflow-hidden bg-gradient-to-b from-[#3bb7ef] to-[#1d83c7] dark:from-[#0a5d7a] dark:to-[#063f56]">
        <div className="absolute left-0 top-7 h-2 w-full animate-[lf-scene-shimmer_5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/55 to-transparent opacity-70" />
        <div
          className="absolute left-0 top-[62px] h-1.5 w-full animate-[lf-scene-shimmer_5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50"
          style={{ animationDelay: '2.2s' }}
        />
      </div>

      {/* Main island + palm */}
      <div className="absolute bottom-10 left-[6%] z-[5] h-[100px] w-[190px] rounded-t-full bg-gradient-to-b from-[#ffd277] to-[#ee9f3c] shadow-[inset_-15px_-5px_0_rgba(245,124,0,0.55)]">
        <div className="absolute -top-[70px] left-[58px] h-[80px] w-4 -rotate-6 rounded-lg bg-gradient-to-r from-[#6b4a3a] to-[#8a6147]" />
        <div className="absolute -top-6 left-[50px] h-[38px] w-[18px] rounded-[50px] bg-[#66bb6a]" />
        <div className="absolute -top-3 left-[8px] h-[16px] w-[52px] origin-right -rotate-[22deg] rounded-[50px] bg-[#4caf50]" />
        <div className="absolute -top-3 left-[92px] h-[16px] w-[52px] origin-left rotate-[22deg] rounded-[50px] bg-[#4caf50]" />
        <div className="absolute top-0 left-[14px] h-[14px] w-[46px] origin-right rotate-[8deg] rounded-[50px] bg-[#81c784]" />
        <div className="absolute top-0 left-[88px] h-[14px] w-[46px] origin-left -rotate-[8deg] rounded-[50px] bg-[#81c784]" />
      </div>

      {/* Lighthouse */}
      <div className="absolute bottom-[60px] right-10 z-[3] h-20 w-5 rounded-t bg-[repeating-linear-gradient(45deg,#f44336,#f44336_10px,#fff_10px,#fff_20px)] shadow-md">
        <div className="absolute -left-1 -top-4 h-4 w-7 rounded-t bg-[#333]" />
        <div className="absolute left-[6px] top-1 h-2.5 w-3 animate-[lf-scene-twinkle_1s_infinite] rounded-full bg-[#ffeb3b] shadow-[0_0_6px_#ff6f00]" />
      </div>

      {/* Sailboats */}
      <div className="absolute bottom-[50px] right-[45%] z-[8] h-5 w-12 animate-[lf-scene-float_3s_ease-in-out_infinite] rounded-b-[20px] bg-[#ef5350]">
        <div className="absolute bottom-5 left-1 h-0 w-0 border-b-[28px] border-r-[18px] border-b-[#eceff1] border-r-transparent" />
      </div>
      <div
        className="absolute bottom-[72px] left-[78%] z-[6] h-4 w-10 animate-[lf-scene-float_3s_ease-in-out_infinite] rounded-b-[16px] bg-[#42a5f5]"
        style={{ animationDelay: '1.5s' }}
      >
        <div className="absolute bottom-4 left-1 h-0 w-0 border-b-[22px] border-r-[14px] border-b-white border-r-transparent" />
      </div>

      {/* Foreground wave */}
      <div className="absolute -bottom-5 -left-[10%] z-20 h-[90px] w-[120%] animate-[lf-scene-wave_4s_ease-in-out_infinite_alternate] rounded-t-[50%] bg-gradient-to-b from-[#1f9fe0] to-[#0570b6] shadow-[0_-10px_0_#4fc3f7] dark:from-[#0a5168] dark:to-[#063044]" />

      <Atmosphere />
    </div>
  )
}
