export function getDeliverySimulationPollMs(): number {
  const seconds = Number(import.meta.env.VITE_DELIVERY_SIMULATION_POLL_SECONDS || 15);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 15000;
  }
  return Math.max(5000, Math.round(seconds * 1000));
}
