import { evaluateAlerts } from '../services/alerts.js';

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
let paused = false;

export function pauseAlertWorker(): void { paused = true; }
export function resumeAlertWorker(): void { paused = false; }
export function isAlertWorkerIdle(): boolean { return !running; }

export function startAlertWorker(): void {
  void runEvaluate();
  timer = setInterval(() => void runEvaluate(), 5 * 60 * 1000);
}

export function stopAlertWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

// Guards against overlapping ticks: evaluateAlerts() does a per-alert
// check-then-act (read last_triggered_at, decide, write) with no lock
// spanning the two, so a slow run overlapping with the next 5-minute tick
// could double-trigger the same alert before either write lands.
async function runEvaluate(): Promise<void> {
  if (paused) return;
  if (running) return;
  try {
    running = true;
    await evaluateAlerts();
  } catch (err) {
    console.error('[dataintel] Alert evaluation failed:', err);
  } finally {
    running = false;
  }
}
