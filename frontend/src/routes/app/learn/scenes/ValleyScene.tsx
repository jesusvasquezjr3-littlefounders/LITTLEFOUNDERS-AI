// Valley — adventure 3 ("La Aldea del Ahorro", COURSE_ENGINE.md §3).
// ILLUSTRATION ASSET: see scenes.css header for the raw-color + ambient
// motion exemption. Ported + recomposed from LittleFounders v1's
// AdventureCard scene.
import { Atmosphere, Birds, Celestial, StarField } from './sceneParts'

export default function ValleyScene() {
  return (
    <div className="lf-scene relative h-full w-full overflow-hidden bg-gradient-to-b from-[#88cdf2] via-[#bbe3f6] to-[#dcefdf] dark:from-[#0d2742] dark:via-[#163a5c] dark:to-[#1d5230]">
      <StarField />
      <Celestial className="right-10 top-8" />
      <Birds className="left-[16%] top-10" />
      <div className="absolute left-[20%] top-11 z-[1] h-6 w-20 animate-[lf-scene-float-h_8s_ease-in-out_infinite_alternate] rounded-[20px] bg-white/85 blur-[1px] dark:bg-white/10" />

      {/* Rolling hills */}
      <div className="absolute bottom-0 z-0 h-[200px] w-full origin-bottom scale-x-150 rounded-t-[100%] bg-gradient-to-b from-[#9ccc5a] to-[#79ad3c]" />
      <div className="absolute bottom-0 left-[-20%] z-0 h-[150px] w-[60%] origin-bottom scale-x-150 rounded-t-[100%] bg-[#a6d36a] opacity-70" />
      <div className="absolute bottom-0 right-[-20%] z-0 h-[170px] w-[60%] origin-bottom scale-x-150 rounded-t-[100%] bg-[#7cb342] opacity-70" />

      {/* Barn + silo */}
      <div
        className="absolute bottom-[120px] left-[20%] z-[2] h-10 w-[50px] bg-[#d32f2f]"
        style={{ clipPath: 'polygon(0% 40%, 50% 0%, 100% 40%, 100% 100%, 0% 100%)' }}
      >
        <div className="absolute bottom-0 left-[15px] h-[25px] w-5 rounded-t-[10px] border-2 border-b-0 border-[#b71c1c] bg-white" />
      </div>
      <div className="absolute bottom-[120px] left-[calc(20%+50px)] z-[2] h-9 w-4 rounded-t bg-[#cfd8dc]" />

      {/* Hot air balloon */}
      <div className="absolute right-[30%] top-[60px] z-[1] animate-[lf-scene-rise_6s_ease-in-out_infinite_alternate]">
        <div className="h-[50px] w-10 rounded-[50%] bg-[linear-gradient(to_right,#e91e63_20%,#ffeb3b_20%,#ffeb3b_40%,#2196f3_40%,#2196f3_60%,#e91e63_60%)]" />
        <div className="absolute -bottom-[15px] left-3 h-3 w-4 rounded-sm bg-[#795548]" />
      </div>

      {/* Foreground hills + fence */}
      <div className="absolute -bottom-[50px] -left-[20%] z-[3] h-[200px] w-[70%] rounded-full bg-gradient-to-b from-[#84bb47] to-[#5f923a]" />
      <div className="absolute -bottom-[80px] -right-[20%] z-[4] h-[220px] w-[80%] rounded-full bg-gradient-to-b from-[#72ab3f] to-[#527e2f]">
        <div className="absolute left-[30%] top-[65px] flex gap-[5px]">
          <div className="h-4 w-1 bg-[#8d6e63]" />
          <div className="h-4 w-1 bg-[#8d6e63]" />
          <div className="h-4 w-1 bg-[#8d6e63]" />
        </div>
      </div>

      {/* Sheep */}
      <div className="absolute bottom-[90px] right-[25%] z-[6] h-2.5 w-3.5 rounded-lg bg-white">
        <div className="absolute -left-0.5 -top-1 h-2 w-2 rounded-full bg-[#333]" />
      </div>
      <div className="absolute bottom-[100px] right-[15%] z-[6] h-2.5 w-3.5 animate-[lf-scene-float_3s_ease-in-out_infinite] rounded-lg bg-white">
        <div className="absolute -left-0.5 -top-1 h-2 w-2 rounded-full bg-[#333]" />
      </div>
      <div className="absolute bottom-[95px] left-[40%] z-[6] h-2.5 w-3.5 rounded-lg bg-white">
        <div className="absolute -left-0.5 -top-1 h-2 w-2 rounded-full bg-[#333]" />
      </div>

      <Atmosphere />
    </div>
  )
}
