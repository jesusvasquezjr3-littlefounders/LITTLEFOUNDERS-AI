import { evaluateAlerts } from '../services/alerts.js';

let timer: ReturnType<typeof setInterval> | null = null;

export function startAlertWorker(): void {
  void evaluateAlerts();
  timer = setInterval(() => void evaluateAlerts(), 5 * 60 * 1000);
}

export function stopAlertWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
