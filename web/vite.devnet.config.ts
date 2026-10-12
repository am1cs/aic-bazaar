import { defineConfig } from 'vitest/config';
import base from './vite.config.ts';
export default defineConfig({...base,test:{environment:'node',include:['checks/devnet.test.ts'],testTimeout:60000,hookTimeout:60000,fileParallelism:false,restoreMocks:true}});
