let timer: ReturnType<typeof setInterval> | null = null;

export function startChurnWorker(): void {
  timer = setInterval(() => {
    // Refresh churn scores (the churn query is live, but we could cache results)
  }, 24 * 60 * 60 * 1000);
}

export function stopChurnWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
