import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function uploadImage(file: File, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('product images')
    .upload(path, file, { cacheControl: '3600', upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage
    .from('product images')
    .getPublicUrl(data.path);
  return urlData.publicUrl;
}
