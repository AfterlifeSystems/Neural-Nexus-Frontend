// After a Vercel deploy, a tab can still be running an older hashed bundle.
// That bundle asks for chunk files the new deploy no longer has. The host then
// answers with the HTML shell, and the browser refuses to execute it as a
// module. Reload once so the next index.html points at the chunks that exist.

export const STALE_MODULE_RELOAD_STORAGE_KEY =
  'neural-nexus-stale-module-reload';

/**
 * Load a Vite-split module. On the first failure in this tab, reload so the
 * document can pick up the current hashed filenames. A second failure throws,
 * so a broken network cannot loop.
 *
 * @param {() => Promise<unknown>} importer
 * @param {Object} [options]
 * @param {Pick<Storage, 'getItem' | 'setItem'> | null} [options.storage]
 * @param {() => void} [options.reload]
 */
export async function loadDeployedModule(
  importer,
  {
    storage = typeof sessionStorage === 'undefined' ? null : sessionStorage,
    reload = () => {
      window.location.reload();
    },
  } = {}
) {
  try {
    return await importer();
  } catch (loadError) {
    if (storage?.getItem(STALE_MODULE_RELOAD_STORAGE_KEY) !== '1') {
      storage?.setItem(STALE_MODULE_RELOAD_STORAGE_KEY, '1');
      reload();
      return new Promise(() => {});
    }
    throw loadError;
  }
}
