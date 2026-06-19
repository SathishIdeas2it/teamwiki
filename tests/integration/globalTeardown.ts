export default async function globalTeardown(): Promise<void> {
  // Per-suite disconnection is handled in setup.ts afterAll.
  // This hook exists for future global resource cleanup.
}
