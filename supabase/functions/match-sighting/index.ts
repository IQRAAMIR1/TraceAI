// ============================================================
// TraceAI — match-sighting Edge Function
// ============================================================
// Called directly, synchronously, from the frontend right after a
// successful sighting insert via supabase.functions.invoke('match-sighting', { body: { sighting_id } }).
//
// NO database trigger, NO pg_net, NO Vault. This is deliberate — see
// PROJECT_SPEC.md §8 "Known pitfall from the previous build".
//
// Input:  { sighting_id: string }
// Output: { status: 'matched', score, confidence_label, match_id }
//       | { status: 'no_match', reason }
//       | { status: 'error', reason }
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ------------------------------------------------------------
// Config
// ------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Confidence bands — PROJECT_SPEC.md §6
const PHOTO_STRONG = 75;
const PHOTO_POSSIBLE = 45;
const TEXT_STRONG = 60;
const TEXT_POSSIBLE = 40;

// Notification threshold — PROJECT_SPEC.md §6 ("Possible" or better)
const PHOTO_NOTIFY_THRESHOLD = 45;
const TEXT_NOTIFY_THRESHOLD = 40;

// Explicit extension -> mime map. Do NOT trust File.type from the browser —
// .jfif in particular is often reported as empty or wrong. See spec §8 step 3.
const EXT_MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  pjpeg: "image/jpeg",
  pjp: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
  bmp: "image/bmp",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

interface MissingPersonRow {
  id: string;
  full_name: string;
  age: number | null;
  gender: string | null;
  height_cm: number | null;
  description: string | null;
  clothing_description: string | null;
  identifying_marks: string | null;
  last_seen_at: string | null;
  last_seen_location: string | null;
  photo_path: string;
  status: string;
}

interface SightingRow {
  id: string;
  person_id: string | null;
  is_general: boolean;
  sighted_at: string | null;
  location_text: string | null;
  description: string | null;
  photo_path: string | null;
}

interface GeminiResult {
  score: number;
  reasons: string[];
}

interface CandidateResult {
  candidate: MissingPersonRow;
  score: number;
  reasons: string[];
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function mimeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const mime = EXT_MIME_MAP[ext];
  if (!mime) {
    console.error(
      `[match-sighting] Unknown/unmapped file extension "${ext}" for path "${path}" — defaulting to image/jpeg`,
    );
    return "image/jpeg";
  }
  return mime;
}

function confidenceLabel(score: number, matchType: "photo" | "text_only"): "strong" | "possible" | "weak" {
  if (matchType === "photo") {
    if (score >= PHOTO_STRONG) return "strong";
    if (score >= PHOTO_POSSIBLE) return "possible";
    return "weak";
  } else {
    if (score >= TEXT_STRONG) return "strong";
    if (score >= TEXT_POSSIBLE) return "possible";
    return "weak";
  }
}

function notifyThreshold(matchType: "photo" | "text_only"): number {
  return matchType === "photo" ? PHOTO_NOTIFY_THRESHOLD : TEXT_NOTIFY_THRESHOLD;
}

function describeCandidate(p: MissingPersonRow): string {
  return [
    `Name: ${p.full_name}`,
    p.age != null ? `Age: ${p.age}` : null,
    p.gender ? `Gender: ${p.gender}` : null,
    p.height_cm != null ? `Height: ${p.height_cm} cm` : null,
    p.description ? `Description: ${p.description}` : null,
    p.clothing_description ? `Clothing last seen wearing: ${p.clothing_description}` : null,
    p.identifying_marks ? `Identifying marks: ${p.identifying_marks}` : null,
    p.last_seen_at ? `Last seen at: ${p.last_seen_at}` : null,
    p.last_seen_location ? `Last seen location: ${p.last_seen_location}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function describeSighting(s: SightingRow): string {
  return [
    s.sighted_at ? `Sighted at: ${s.sighted_at}` : null,
    s.location_text ? `Sighting location: ${s.location_text}` : null,
    s.description ? `Sighting description: ${s.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Downloads a file from a Supabase storage bucket and returns it as a base64
 * string, along with the mime type derived explicitly from the file extension.
 */
async function downloadAsBase64(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  path: string,
): Promise<{ base64: string; mime: string } | null> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    console.error(
      `[match-sighting] Failed to download "${path}" from bucket "${bucket}": ${error?.message ?? "no data returned"}`,
    );
    return null;
  }
  const buffer = await data.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);
  return { base64, mime: mimeFromPath(path) };
}

/**
 * Calls Gemini with either (photo + photo + text + text) or (text + text) parts,
 * and expects a strict JSON { score, reasons } response.
 */
async function callGemini(
  parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }>,
): Promise<GeminiResult | null> {
  const instruction = {
    text:
      "You are comparing a missing-person case to a reported sighting. " +
      "Respond ONLY with strict JSON, no markdown fences, no preamble, in exactly this shape: " +
      `{"score": <number 0-100>, "reasons": ["<short reason>", "..."]}. ` +
      "Score reflects how likely the sighting describes the same person as the missing-person case, " +
      "based on physical description, clothing, identifying marks, timing, and location proximity" +
      (parts.some((p) => "inline_data" in p) ? ", and visual similarity between the two photos." : "."),
  };

  let response: Response;
  try {
    response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [instruction, ...parts] }],
        generationConfig: { temperature: 0.2 },
      }),
    });
  } catch (err) {
    console.error(`[match-sighting] Gemini fetch threw an exception: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "<unreadable body>");
    console.error(
      `[match-sighting] Gemini API returned non-OK status ${response.status}: ${bodyText}`,
    );
    return null;
  }

  let json: any;
  try {
    json = await response.json();
  } catch (err) {
    console.error(`[match-sighting] Failed to parse Gemini response as JSON: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }

  const rawText: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    console.error(`[match-sighting] Gemini response had no text content: ${JSON.stringify(json)}`);
    return null;
  }

  const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error(
      `[match-sighting] Failed to parse Gemini's JSON payload: ${err instanceof Error ? err.message : String(err)}. Raw text: ${rawText}`,
    );
    return null;
  }

  if (typeof parsed.score !== "number" || !Array.isArray(parsed.reasons)) {
    console.error(`[match-sighting] Gemini JSON missing expected shape: ${JSON.stringify(parsed)}`);
    return null;
  }

  const score = Math.max(0, Math.min(100, parsed.score));
  const reasons = parsed.reasons.filter((r: unknown) => typeof r === "string");

  return { score, reasons };
}

/**
 * Runs the Gemini comparison for a single candidate, branching on whether the
 * sighting has a photo (photo+text mode) or not (text-only mode).
 */
async function scoreCandidate(
  supabase: ReturnType<typeof createClient>,
  sighting: SightingRow,
  candidate: MissingPersonRow,
  matchType: "photo" | "text_only",
): Promise<CandidateResult | null> {
  const candidateText = describeCandidate(candidate);
  const sightingText = describeSighting(sighting);

  const textParts = [
    { text: `MISSING PERSON CASE:\n${candidateText}` },
    { text: `REPORTED SIGHTING:\n${sightingText}` },
  ];

  let parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }>;

  if (matchType === "photo") {
    const candidateImage = await downloadAsBase64(supabase, "person-photos", candidate.photo_path);
    if (!candidateImage) {
      console.error(
        `[match-sighting] Skipping candidate ${candidate.id} — could not download candidate photo "${candidate.photo_path}"`,
      );
      return null;
    }
    const sightingImage = await downloadAsBase64(supabase, "sighting-photos", sighting.photo_path!);
    if (!sightingImage) {
      console.error(
        `[match-sighting] Skipping candidate ${candidate.id} — could not download sighting photo "${sighting.photo_path}"`,
      );
      return null;
    }
    parts = [
      { text: "MISSING PERSON PHOTO:" },
      { inline_data: { mime_type: candidateImage.mime, data: candidateImage.base64 } },
      { text: "SIGHTING PHOTO:" },
      { inline_data: { mime_type: sightingImage.mime, data: sightingImage.base64 } },
      ...textParts,
    ];
  } else {
    parts = textParts;
  }

  const result = await callGemini(parts);
  if (!result) {
    console.error(`[match-sighting] Gemini scoring failed for candidate ${candidate.id} (sighting ${sighting.id})`);
    return null;
  }

  return { candidate, score: result.score, reasons: result.reasons };
}

// ------------------------------------------------------------
// Main handler
// ------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  let body: { sighting_id?: string };
  try {
    body = await req.json();
  } catch (err) {
    console.error(`[match-sighting] Request body was not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
    return new Response(
      JSON.stringify({ status: "error", reason: "Invalid request body — expected JSON with sighting_id" }),
      { status: 400, headers: jsonHeaders },
    );
  }

  const sightingId = body.sighting_id;
  if (!sightingId) {
    console.error("[match-sighting] Request missing required field sighting_id");
    return new Response(
      JSON.stringify({ status: "error", reason: "Missing required field: sighting_id" }),
      { status: 400, headers: jsonHeaders },
    );
  }

  if (!GEMINI_API_KEY) {
    console.error("[match-sighting] GEMINI_API_KEY secret is not set");
    return new Response(
      JSON.stringify({ status: "error", reason: "Server misconfiguration: GEMINI_API_KEY not set" }),
      { status: 500, headers: jsonHeaders },
    );
  }

  // Service-role client — bypasses RLS entirely, as required to write to `matches`.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Fetch the sighting row.
  const { data: sighting, error: sightingError } = await supabase
    .from("sightings")
    .select("*")
    .eq("id", sightingId)
    .maybeSingle();

  if (sightingError) {
    console.error(`[match-sighting] Error fetching sighting ${sightingId}: ${sightingError.message}`);
    return new Response(
      JSON.stringify({ status: "error", reason: `Failed to fetch sighting: ${sightingError.message}` }),
      { status: 500, headers: jsonHeaders },
    );
  }
  if (!sighting) {
    console.error(`[match-sighting] Sighting ${sightingId} not found`);
    return new Response(
      JSON.stringify({ status: "error", reason: "Sighting not found" }),
      { status: 404, headers: jsonHeaders },
    );
  }

  const typedSighting = sighting as SightingRow;

  // 2. Build the candidate list.
  let candidates: MissingPersonRow[] = [];

  if (!typedSighting.is_general && typedSighting.person_id) {
    const { data: person, error: personError } = await supabase
      .from("missing_persons")
      .select("*")
      .eq("id", typedSighting.person_id)
      .maybeSingle();

    if (personError) {
      console.error(
        `[match-sighting] Error fetching linked case ${typedSighting.person_id} for sighting ${sightingId}: ${personError.message}`,
      );
      return new Response(
        JSON.stringify({ status: "error", reason: `Failed to fetch linked case: ${personError.message}` }),
        { status: 500, headers: jsonHeaders },
      );
    }
    if (!person) {
      console.error(`[match-sighting] Linked case ${typedSighting.person_id} not found for sighting ${sightingId}`);
      return new Response(
        JSON.stringify({ status: "error", reason: "Linked missing-person case not found" }),
        { status: 404, headers: jsonHeaders },
      );
    }
    candidates = [person as MissingPersonRow];
  } else {
    const { data: allMissing, error: allMissingError } = await supabase
      .from("missing_persons")
      .select("*")
      .eq("status", "missing");

    if (allMissingError) {
      console.error(
        `[match-sighting] Error fetching candidate pool for general sighting ${sightingId}: ${allMissingError.message}`,
      );
      return new Response(
        JSON.stringify({ status: "error", reason: `Failed to fetch candidate pool: ${allMissingError.message}` }),
        { status: 500, headers: jsonHeaders },
      );
    }
    candidates = (allMissing ?? []) as MissingPersonRow[];
  }

  if (candidates.length === 0) {
    console.error(`[match-sighting] No candidate missing-person cases found for sighting ${sightingId} — nothing to compare against`);
    return new Response(
      JSON.stringify({ status: "no_match", reason: "No active missing-person cases to compare against" }),
      { status: 200, headers: jsonHeaders },
    );
  }

  // 3. Determine match type and score every candidate.
  const matchType: "photo" | "text_only" = typedSighting.photo_path ? "photo" : "text_only";

  const scored: CandidateResult[] = [];
  for (const candidate of candidates) {
    const result = await scoreCandidate(supabase, typedSighting, candidate, matchType);
    if (result) {
      scored.push(result);
    }
    // Failures are already logged inside scoreCandidate; we continue to the
    // next candidate rather than aborting the whole batch.
  }

  if (scored.length === 0) {
    console.error(
      `[match-sighting] Every candidate comparison failed for sighting ${sightingId} (matchType=${matchType}, candidates=${candidates.length})`,
    );
    return new Response(
      JSON.stringify({ status: "error", reason: "All Gemini comparisons failed — see function logs" }),
      { status: 502, headers: jsonHeaders },
    );
  }

  // 4. Pick the best-scoring candidate.
  const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
  const label = confidenceLabel(best.score, matchType);

  const { data: matchRow, error: matchError } = await supabase
    .from("matches")
    .upsert(
      {
        person_id: best.candidate.id,
        sighting_id: typedSighting.id,
        match_type: matchType,
        score: best.score,
        confidence_label: label,
        reasons: best.reasons,
      },
      { onConflict: "person_id,sighting_id" },
    )
    .select()
    .single();

  if (matchError || !matchRow) {
    console.error(
      `[match-sighting] Failed to upsert match for sighting ${sightingId} / person ${best.candidate.id}: ${matchError?.message ?? "no row returned"}`,
    );
    return new Response(
      JSON.stringify({ status: "error", reason: `Failed to save match: ${matchError?.message ?? "unknown error"}` }),
      { status: 500, headers: jsonHeaders },
    );
  }

  // 5. Notify the reporter if the score clears the threshold.
  const threshold = notifyThreshold(matchType);
  if (best.score >= threshold) {
    const { data: caseRow, error: caseError } = await supabase
      .from("missing_persons")
      .select("reporter_id, full_name")
      .eq("id", best.candidate.id)
      .maybeSingle();

    if (caseError) {
      console.error(
        `[match-sighting] Match saved (${matchRow.id}) but failed to fetch reporter for case ${best.candidate.id}: ${caseError.message}`,
      );
    } else if (!caseRow?.reporter_id) {
      console.error(
        `[match-sighting] Match saved (${matchRow.id}) but case ${best.candidate.id} has no reporter_id — skipping notification`,
      );
    } else {
      const { error: notifyError } = await supabase.from("notifications").insert({
        user_id: caseRow.reporter_id,
        person_id: best.candidate.id,
        sighting_id: typedSighting.id,
        match_id: matchRow.id,
        title: `New ${label} match for ${caseRow.full_name}`,
        body: `A sighting has been matched to this case with a ${label} confidence score of ${best.score.toFixed(0)}%.`,
      });
      if (notifyError) {
        console.error(
          `[match-sighting] Match saved (${matchRow.id}) but failed to insert notification: ${notifyError.message}`,
        );
      }
    }
  }

  return new Response(
    JSON.stringify({
      status: "matched",
      score: best.score,
      confidence_label: label,
      match_id: matchRow.id,
    }),
    { status: 200, headers: jsonHeaders },
  );
});