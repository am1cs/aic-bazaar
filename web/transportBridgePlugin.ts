import { fileURLToPath } from 'node:url';
import { normalizePath, type Plugin } from 'vite';

/** Redirect only the SDK entry's internal transport import; all other imports stay real. */
export function transportBridgePlugin(options: { sdkEntry?: string; bridge?: string } = {}) {
  const sdkEntry = normalizePath(options.sdkEntry ?? fileURLToPath(new URL('../sdk/src/index.ts', import.meta.url)));
  const bridge = normalizePath(options.bridge ?? fileURLToPath(new URL('./src/sdkTransportBridge.ts', import.meta.url)));
  return {
    name: 'aic-bazaar-phantom-transport',
    enforce: 'pre' as const,
    resolveId(this: void, source: string, importer?: string) {
      return source === './transport' && importer && normalizePath(importer.split('?')[0]) === sdkEntry ? bridge : null;
    },
  } satisfies Plugin;
}
