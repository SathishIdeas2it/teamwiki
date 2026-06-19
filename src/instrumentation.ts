export async function register(): Promise<void> {
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    const { startImportPoller } = await import('@/lib/mcp/importer');
    startImportPoller();
  }
}
