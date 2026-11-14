import type { Api } from './api';
import { createDemoApi } from './demoApi';
import { createHttpApi } from './httpApi';

/**
 * VITE_BACKEND=server → server Node.js + MySQL (build produksi memakai ini, lihat .env.production).
 * Selain itu → mode demo (data hanya di browser ini), untuk mencoba tampilan.
 */
export const api: Api = import.meta.env.VITE_BACKEND === 'server' ? createHttpApi() : createDemoApi();
