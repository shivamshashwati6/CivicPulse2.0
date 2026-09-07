import { createClient } from '@supabase/supabase-js';

function formatSupabaseUrl(rawUrl) {
  if (!rawUrl || rawUrl.includes('placeholder')) {
    return 'https://placeholder.supabase.co';
  }
  let url = rawUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('.')) {
      return `${parsed.protocol}//${parsed.hostname}.supabase.co`;
    }
  } catch {
    if (!url.includes('.')) {
      return url + '.supabase.co';
    }
  }
  return url;
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tiecqwgsmdwqklotnqao.supabase.co';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ktQKKLFdIqL14h3-ymB9pQ_QNOIAsBk';

export const supabaseUrl = formatSupabaseUrl(rawUrl);
export const supabaseAnonKey = rawKey.trim();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
