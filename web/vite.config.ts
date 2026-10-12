import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@aic-bazaar/sdk': fileURLToPath(new URL('../sdk/src/index.ts', import.meta.url)) }, dedupe: ['react', 'react-dom', '@solana/web3.js', '@coral-xyz/anchor', 'bn.js', 'bs58', 'buffer'] },
  server: { fs: { allow: ['..'] }, port: 5173 },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], restoreMocks: true },
  build: { sourcemap: false, chunkSizeWarningLimit: 1000 },
});
