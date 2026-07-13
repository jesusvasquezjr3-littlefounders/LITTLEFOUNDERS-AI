// Kingdom — adventure 6 ("El Faro de la Confianza", archipelago-night
// variant reuses this castle set piece; COURSE_ENGINE.md §3). ILLUSTRATION
// ASSET: see scenes.css header for the raw-color + ambient motion exemption.
// Ported + recomposed from LittleFounders v1's AdventureCard scene.
import { Atmosphere, Celestial, StarField } from './sceneParts'

function Turret({ tall = false, torchSide }: { tall?: boolean; torchSide?: 'left' | 'right' }) {
  return (
    <div className={`relative mx-0.5 w-[25px] rounded bg-[#bdbdbd] ${tall ? 'h-[100px] shadow-[inset_-5px_0_0_rgba(0,0,0,0.2)]' : 'h-[70px] bg-[#9e9e9e]'}`}>
      <div
        className="absolute -left-0.5 -top-5 h-[25px] w-[115%] bg-[#c62828]"
        style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
      />
      <div className="absolute -top-9 left-1/2 h-4 w-0.5 bg-[#333]">
        <div className="absolute left-0.5 top-0 h-2 w-3 animate-[lf-scene-sway_2s_ease-in-out_infinite] bg-[#ffca28]" />
      </div>
      {torchSide && (
        <div className={`absolute top-5 h-1 w-1 animate-[lf-scene-twinkle_1s_infinite] rounded-full bg-[#ffeb3b] shadow-[0_0_6px_#ff6f00] ${torchSide === 'left' ? 'left-[5px]' : 'right-[5px]'}`} />
      )}
    </div>
  )
}

export default function KingdomScene() {
  return (
    <div className="lf-scene relative h-full w-full overflow-hidden bg-gradient-to-b from-[#ffb24d] via-[#ff8f5e] to-[#ffd9a8] dark:from-[#241640] dark:via-[#3b1f49] dark:to-[#5b2f44]">
      <StarField />
      <Celestial className="right-10 top-8" />
      <div className="absolute inset-x-0 bottom-10 z-0 h-28 bg-gradient-to-t from-amber-300/45 to-transparent blur-md dark:from-fuchsia-500/15" />

      {/* Dragon */}
      <div className="absolute left-[20%] top-[60px] z-10 h-5 w-10 animate-[lf-scene-hover-rotate_4s_ease-in-out_infinite] rounded-[20px] bg-[#4caf50]">
        <div className="absolute -left-2.5 -top-[5px] h-4 w-4 rounded bg-[#4caf50]" />
        <div className="absolute left-2.5 -top-4 h-5 w-5 -rotate-[20deg] animate-[lf-scene-float_3s_ease-in-out_infinite] rounded-tr-[20px] bg-[#81c784]" />
      </div>

      {/* Mountain base */}
      <div className="absolute -bottom-20 z-[1] h-[200px] w-full rounded-t-[50%] bg-gradient-to-b from-[#7c5a44] to-[#4e3527] dark:from-[#3a2540] dark:to-[#241531]" />

      {/* Castle */}
      <div className="absolute bottom-[90px] left-1/2 z-[5] flex -translate-x-1/2 items-end">
        <Turret torchSide="left" />
        <Turret tall />
        <div className="relative z-[6] flex h-[60px] w-[60px] flex-col items-center justify-end bg-[#757575]">
          <div
            className="absolute -left-[5%] -top-5 h-[25px] w-[110%] bg-[#c62828]"
            style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
          />
          <div className="h-10 w-[30px] rounded-t-[15px] border-2 border-b-0 border-[#616161] bg-[#3e2723]">
            <div className="h-[25px] w-full border-b-2 border-[#333] bg-[repeating-linear-gradient(90deg,#333,#333_2px,transparent_2px,transparent_6px)]" />
          </div>
        </div>
        <Turret tall />
        <Turret torchSide="right" />
      </div>

      {/* Market stall */}
      <div className="absolute bottom-[70px] left-[25%] z-[7] h-5 w-[30px] bg-[#8d6e63]">
        <div className="absolute -top-2.5 h-2.5 w-[30px] rounded-t bg-[repeating-linear-gradient(90deg,#fff,#fff_5px,#f44336_5px,#f44336_10px)]" />
      </div>

      {/* Guard */}
      <div className="absolute bottom-[70px] left-[65%] z-[7] h-4 w-2 bg-[#e0e0e0]">
        <div className="absolute -top-1.5 h-1.5 w-2 rounded-full bg-[#757575]" />
        <div className="absolute -bottom-2 -right-0.5 h-[25px] w-px bg-[#333]" />
      </div>

      <Atmosphere />
    </div>
  )
}
