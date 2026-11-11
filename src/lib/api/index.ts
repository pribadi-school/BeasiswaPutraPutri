import type { Api } from './api';
import { createDemoApi } from './demoApi';
import { createSupabaseApi } from './supabaseApi';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/** Supabase bila URL dan anon key diisi; selain itu mode demo (data hanya di browser ini). */
export const api: Api = url && key ? createSupabaseApi(url, key) : createDemoApi();
