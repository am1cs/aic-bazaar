import { fileURLToPath } from 'node:url';
import { normalizePath, type Plugin } from 'vite';

// Vite only replaces Windows separators on a Windows host. Normalize imported
// paths explicitly so the same boundary checks work on macOS/Linux CI too.
const portablePath = (value: string) => normalizePath(value.replace(/\\/g, '/'));

/** Redirect only the SDK entry's internal transport import; all other imports stay real. */
export function transportBridgePlugin(options: { sdkEntry?: string; bridge?: string } = {}) {
  const sdkEntry = portablePath(options.sdkEntry ?? fileURLToPath(new URL('../sdk/src/index.ts', import.meta.url)));
  const bridge = portablePath(options.bridge ?? fileURLToPath(new URL('./src/sdkTransportBridge.ts', import.meta.url)));
  return {
    name: 'aic-bazaar-phantom-transport',
    enforce: 'pre' as const,
    resolveId(this: void, source: string, importer?: string) {
      return source === './transport' && importer && portablePath(importer.split('?')[0]) === sdkEntry ? bridge : null;
    },
  } satisfies Plugin;
}
