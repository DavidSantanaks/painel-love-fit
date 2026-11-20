export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build" && !process.env.DISABLE_WORKER) {
    const { startWorker } = await import("./server/worker");
    startWorker();
  }
}
