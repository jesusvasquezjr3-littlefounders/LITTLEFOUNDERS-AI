// City — adventure 4 ("El Mercado de los Colores", COURSE_ENGINE.md §3).
// ILLUSTRATION ASSET: see scenes.css header for the raw-color + ambient
// motion exemption. Ported + recomposed from LittleFounders v1's
// AdventureCard scene.
import { Atmosphere, Celestial, StarField, Tower } from './sceneParts'

export default function CityScene() {
  return (
    <div className="lf-scene relative h-full w-full overflow-hidden bg-gradient-to-b from-[#8b93f5] via-[#a5b4fc] to-[#d6ddfe] dark:from-[#1b1745] dark:via-[#262061] dark:to-[#1e3a6e]">
      <StarField />
      <Celestial className="right-10 top-8" />

      {/* Background skyline */}
      <div className="absolute bottom-10 z-[1] flex w-full justify-around opacity-60">
        <div className="h-[100px] w-10 rounded-t bg-[#4f46e5]" />
        <div className="h-[160px] w-10 rounded-t bg-[#6366f1]" />
        <div className="h-[90px] w-10 rounded-t bg-[#4f46e5]" />
        <div className="h-[140px] w-10 rounded-t bg-[#4338ca]" />
        <div className="h-[120px] w-10 rounded-t bg-[#4f46e5]" />
        <div className="h-[110px] w-10 rounded-t bg-[#6366f1]" />
        <div className="h-[80px] w-8 rounded-t bg-[#4f46e5]" />
      </div>

      {/* Foreground towers with lit windows */}
      <Tower className="bottom-[50px] left-[6%] h-[140px] w-[58px] z-[5]" from="#8b96fb" to="#5b67d6" lit={[1, 3, 4, 7, 9]} />
      <Tower className="bottom-[50px] left-[27%] h-[195px] w-[78px] z-[6]" from="#8e97d8" to="#5a64ad" lit={[0, 2, 5, 6, 9, 11]} />
      <Tower className="bottom-[50px] left-[54%] h-[120px] w-[50px] z-[4]" from="#f47472" to="#c83f3d" lit={[1, 4, 8]} />
      <Tower className="bottom-[50px] right-[6%] h-[160px] w-[70px] z-[5]" from="#5fd6e6" to="#27a3b8" lit={[2, 3, 7, 10]} />

      {/* Road */}
      <div className="absolute bottom-0 z-10 h-[50px] w-full bg-[#78909c]" />
      <div className="absolute bottom-[15px] z-[11] h-[25px] w-full bg-[#37474f]">
        <div className="absolute top-2.5 h-0.5 w-full bg-[repeating-linear-gradient(90deg,#fff,#fff_15px,transparent_15px,transparent_30px)]" />
      </div>

      {/* Bus */}
      <div className="absolute bottom-[18px] z-[15] h-[25px] w-[60px] animate-[lf-scene-drive_8s_linear_infinite] rounded-[6px] bg-[#ffb300]">
        <div className="absolute left-[5px] top-[3px] h-2 w-10 bg-[#e3f2fd]" />
      </div>

      {/* Streetlight */}
      <div className="absolute bottom-[50px] left-[45%] z-[14] h-[60px] w-1 bg-[#455a64]">
        <div className="absolute -left-2 top-0 h-1.5 w-5 rounded bg-[#455a64]" />
        <div className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-[#eceff1] shadow-[0_0_10px_#eceff1] dark:bg-[#ffca28] dark:shadow-[0_0_10px_#ffca28]" />
      </div>

      <Atmosphere />
    </div>
  )
}
