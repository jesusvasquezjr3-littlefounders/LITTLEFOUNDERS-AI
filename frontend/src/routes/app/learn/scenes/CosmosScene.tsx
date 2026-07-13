// Cosmos — adventure 8 ("El Cosmos del Mañana", the capstone; COURSE_ENGINE.md
// §3). ILLUSTRATION ASSET: see scenes.css header for the raw-color + ambient
// motion exemption. Ported + recomposed from LittleFounders v1's
// AdventureCard scene.
import { StarField } from './sceneParts'

export default function CosmosScene() {
  return (
    <div className="lf-scene relative h-full w-full overflow-hidden bg-gradient-to-b from-[#241a6b] via-[#1e2f7e] to-[#05030f]">
      <StarField alwaysOn />

      <div className="absolute -top-12 right-0 z-0 h-2/3 w-2/3 blur-2xl" style={{ background: 'radial-gradient(circle, rgba(217,70,239,0.28), transparent 70%)' }} />
      <div className="absolute -left-6 bottom-0 z-0 h-2/3 w-2/3 blur-2xl" style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.20), transparent 70%)' }} />

      {/* Big ringed planet */}
      <div className="absolute -bottom-[50px] -left-[50px] z-[5] h-[200px] w-[200px] rounded-full bg-[#3949ab] shadow-[inset_-20px_-20px_50px_rgba(0,0,0,0.5)]">
        <div className="absolute left-10 top-10 h-5 w-5 rounded-full bg-[#283593] opacity-50" />
        <div className="absolute left-24 top-20 h-8 w-8 rounded-full bg-[#283593] opacity-50" />
        <div className="absolute left-1/2 top-1/2 h-[60px] w-[260px] -translate-x-1/2 -translate-y-1/2 -rotate-[20deg] rounded-full border-[15px] border-[#ffca28]/30" />
      </div>

      {/* Small planet */}
      <div className="absolute left-[15%] top-20 z-[3] h-[50px] w-[50px] rounded-full bg-gradient-to-br from-[#ff6b6b] to-[#c92a2a] shadow-[inset_-5px_-5px_15px_rgba(0,0,0,0.5)]">
        <div className="absolute left-3 top-2 h-3 w-3 rounded-full bg-[#a61e1e] opacity-40" />
      </div>

      {/* Tiny drifting planet */}
      <div className="absolute right-[15%] top-[40%] z-[3] h-[30px] w-[30px] animate-[lf-scene-float_3s_ease-in-out_infinite] rounded-full bg-gradient-to-br from-[#81d4fa] to-[#0288d1] shadow-[inset_-3px_-3px_10px_rgba(0,0,0,0.5)]" />

      {/* Rocket */}
      <div className="absolute left-1/2 top-1/2 z-10 h-12 w-8 animate-[lf-scene-float_3s_ease-in-out_infinite] rounded-[50%_50%_5px_5px] bg-white">
        <div className="absolute left-2 top-3 h-4 w-4 rounded-full border-2 border-[#e0e0e0] bg-[#4fc3f7]" />
        <div className="absolute -left-2 bottom-0 h-4 w-2 rounded-t-lg bg-[#f44336]" />
        <div className="absolute -right-2 bottom-0 h-4 w-2 rounded-t-lg bg-[#f44336]" />
        <div className="absolute -bottom-4 left-2 h-6 w-4 animate-[lf-scene-flame_0.5s_infinite_alternate] rounded-[0_0_50%_50%] bg-[#ff9800]" />
      </div>

      {/* UFO */}
      <div className="absolute right-20 top-20 z-[8] h-6 w-12 animate-[lf-scene-hover-rotate_4s_ease-in-out_infinite]">
        <div className="absolute -top-3 left-3 h-4 w-6 rounded-t-full border border-slate-400 bg-[#b3e5fc]" />
        <div className="flex h-full w-full items-center justify-center gap-1 rounded-[50%] bg-[#bdbdbd] shadow-lg">
          <div className="h-1 w-1 animate-[lf-scene-twinkle_1.2s_infinite] rounded-full bg-red-500" />
          <div className="h-1 w-1 animate-[lf-scene-twinkle_1.2s_infinite] rounded-full bg-green-500" style={{ animationDelay: '0.2s' }} />
        </div>
      </div>

      {/* Shooting star */}
      <div className="absolute left-1/2 top-10 z-[2] h-[2px] w-[100px] animate-[lf-scene-shoot_3s_ease-in-out_infinite] -rotate-[30deg] bg-gradient-to-r from-white to-transparent" />

      {/* Astronaut */}
      <div className="absolute bottom-20 right-20 z-[9] h-10 w-8 animate-[lf-scene-float-h_9s_ease-in-out_infinite_alternate] rounded-lg bg-white">
        <div className="absolute left-1 top-1 h-4 w-6 rounded-md border border-gray-400 bg-[#333]" />
        <div className="absolute -right-2 top-2 h-6 w-2 rounded-r bg-[#e0e0e0]" />
      </div>
    </div>
  )
}
