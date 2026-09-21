/**
 * Redes e formatos de publicação, e a identificação automática a partir
 * do link colado.
 */

export const PLATFORMS = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
  x: "X",
  outro: "Outro",
} as const;
export type Platform = keyof typeof PLATFORMS;

export const FORMATS = {
  estatico: "Estático",
  carrossel: "Carrossel",
  video: "Vídeo",
  reels: "Reels",
  vlog: "Vlog",
  artigo: "Artigo",
  outro: "Outro",
} as const;
export type Format = keyof typeof FORMATS;

export function platformLabel(p?: string | null) {
  return (p && PLATFORMS[p as Platform]) ?? "Outro";
}
export function formatLabel(f?: string | null) {
  return (f && FORMATS[f as Format]) ?? null;
}

export interface DetectedLink {
  url: string;
  platform: Platform;
  format: Format | null;
  valid: boolean;
}

/** Normaliza o texto colado: aceita link com ou sem https://. */
function normalizeUrl(raw: string): string | null {
  const s = raw.trim().replace(/^[<(\["']+|[>)\]"',;.]+$/g, "");
  if (!s) return null;
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withProto);
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Identifica rede e, quando dá para saber pela URL, o formato. */
export function detectLink(raw: string): DetectedLink {
  const url = normalizeUrl(raw);
  if (!url) return { url: raw.trim(), platform: "outro", format: null, valid: false };

  const u = new URL(url);
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const path = u.pathname.toLowerCase();

  let platform: Platform = "outro";
  let format: Format | null = null;

  if (host.endsWith("instagram.com")) {
    platform = "instagram";
    if (path.startsWith("/reel")) format = "reels";
    else if (path.startsWith("/tv/")) format = "video";
    // "/p/" pode ser estático ou carrossel — a URL não diz qual
  } else if (host.endsWith("linkedin.com") || host === "lnkd.in") {
    platform = "linkedin";
    if (path.startsWith("/pulse/")) format = "artigo";
  } else if (host.endsWith("youtube.com") || host === "youtu.be") {
    platform = "youtube";
    format = path.startsWith("/shorts/") ? "video" : "vlog";
  } else if (host.endsWith("tiktok.com")) {
    platform = "tiktok";
    format = "video";
  } else if (host.endsWith("facebook.com") || host === "fb.watch") {
    platform = "facebook";
  } else if (host === "x.com" || host.endsWith("twitter.com")) {
    platform = "x";
  }

  return { url, platform, format, valid: true };
}

/** Separa um bloco colado em links (um por linha, ou separados por espaço). */
export function parseLinks(text: string): DetectedLink[] {
  const seen = new Set<string>();
  const out: DetectedLink[] = [];
  for (const piece of text.split(/[\s\n]+/)) {
    if (!piece.trim()) continue;
    const d = detectLink(piece);
    if (d.valid && seen.has(d.url)) continue;
    seen.add(d.url);
    out.push(d);
  }
  return out;
}
