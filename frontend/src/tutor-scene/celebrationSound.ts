/** A quiet milestone cue; blocked audio never interrupts the scene. */
export function playCelebrationSound(): void {
  try {
    if (typeof Audio === 'undefined' || localStorage.getItem('lf_sound_muted') === '1') return;
    const audio = new Audio('/sounds/edu/lesson_complete.mp3');
    audio.volume = 0.075;
    const started: unknown = audio.play();
    if (started instanceof Promise) started.catch(() => {});
  } catch { /* Sound is an enhancement. */ }
}
