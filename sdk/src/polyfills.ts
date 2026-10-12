import { Buffer } from 'buffer';

// Anchor's browser bundle and legacy buffer-layout reference the global Buffer.
// Vite intentionally does not inject Node globals. Keep this SDK self-contained.
const globals = globalThis as unknown as { Buffer?: typeof Buffer };
globals.Buffer ??= Buffer;
