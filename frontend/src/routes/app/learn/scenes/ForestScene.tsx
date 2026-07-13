// Forest — adventure 2 ("El Bosque de la Abundancia", COURSE_ENGINE.md §3).
// ILLUSTRATION ASSET: see scenes.css header for the raw-color + ambient
// motion exemption. Ported + recomposed from LittleFounders v1's
// AdventureCard scene.
import { Atmosphere, Birds, Celestial, Pine, StarField } from './sceneParts'

export default function ForestScene() {
  return (
    <div className="lf-scene relative h-full w-full overflow-hidden bg-gradient-to-b from-[#7cc6f5] via-[#a7d8f6] to-[#d8ecfb] dark:from-[#0c1b40] dark:via-[#16265c] dark:to-[#243a72]">
      <StarField />
      <Celestial className="right-10 top-9" />
      <Birds className="left-[18%] top-[44px]" />
      <div className="absolute left-10 top-8 z-[1] h-5 w-[70px] animate-[lf-scene-float-h_8s_ease-in-out_infinite_alternate] rounded-[20px] bg-white/85 blur-[1px] dark:bg-white/10" />

      <div className="absolute inset-x-0 bottom-[120px] z-0 h-16 bg-gradient-to-t from-emerald-200/30 to-transparent blur-md dark:from-emerald-400/10" />

      {/* Ground */}
      <div className="absolute bottom-0 z-[1] h-[120px] w-full rounded-t-[50%] bg-gradient-to-b from-[#46a849] to-[#2f7d33]" />

      {/* Background pines */}
      <Pine className="bottom-[62px] left-[8%] z-[2]" scale={0.7} />
      <Pine className="bottom-[86px] right-[12%] z-[2]" scale={0.85} color="#388e3c" />
      <Pine className="bottom-[70px] left-[68%] z-[2]" scale={0.55} />
      <Pine className="bottom-[58px] right-[4%] z-[2]" scale={0.6} color="#388e3c" />

      {/* Foreground ground with pond */}
      <div className="absolute bottom-0 z-10 h-20 w-full rounded-tr-[30%] bg-gradient-to-b from-[#6cc06f] to-[#4a9b4e]">
        <div className="absolute bottom-5 right-5 h-10 w-[110px] rounded-full border-4 border-[#81c784] bg-[#4fc3f7]">
          <div className="absolute left-5 top-2.5 h-2.5 w-4 rounded-full bg-[#2e7d32]" />
        </div>
        <div className="absolute bottom-[64px] left-[22%] z-[11] h-0 w-0 border-x-[26px] border-b-[36px] border-x-transparent border-b-[#ff7043]" />
        {/* Campfire */}
        <div className="absolute bottom-[60px] left-[36%] z-[11]">
          <div className="h-1 w-4 rounded bg-[#5d4037]" />
          <div className="absolute -top-2.5 left-1 h-2.5 w-2.5 animate-[lf-scene-flame_0.5s_infinite_alternate] rounded-[50%_0_50%_50%] -rotate-45 bg-[#ffeb3b]" />
        </div>
      </div>

      {/* Hero pine (foreground) */}
      <Pine className="bottom-[54px] left-[44%] z-[12]" scale={1.15} />

      {/* Fireflies (dark mode only) */}
      <div className="absolute bottom-[92px] left-[30%] z-20 h-1 w-1 animate-[lf-scene-twinkle_1s_infinite] rounded-full bg-[#ffeb3b] opacity-0 dark:opacity-100" />
      <div
        className="absolute bottom-[112px] right-[30%] z-20 h-1 w-1 animate-[lf-scene-twinkle_2s_infinite_alternate] rounded-full bg-[#ffeb3b] opacity-0 dark:opacity-100"
        style={{ animationDelay: '1.5s' }}
      />

      <Atmosphere />
    </div>
  )
}
