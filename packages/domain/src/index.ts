export type ReadinessProbe = () => Promise<void>;

/** No infrastructure details or exception messages cross this boundary. */
export async function assessReadiness(probe: ReadinessProbe): Promise<boolean> {
  try {
    await probe();
    return true;
  } catch {
    return false;
  }
}
