import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing Supabase environment variables. Check that .env.local has VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY set.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Access codes for Police / NGO signup — hardcoded for the hackathon build.
// See PROJECT_SPEC.md §2 and §5.
export const ACCESS_CODES = {
  police: 'TRACEAI-POLICE-2026',
  ngo: 'TRACEAI-NGO-2026',
};

export function personPhotoUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from('person-photos').getPublicUrl(path);
  return data?.publicUrl ?? null;
}

export async function sightingPhotoSignedUrl(path, expiresInSeconds = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from('sighting-photos')
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error(`Failed to create signed URL for sighting photo "${path}": ${error.message}`);
    return null;
  }
  return data?.signedUrl ?? null;
}
