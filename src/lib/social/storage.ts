import "server-only";
import { del, put } from "@vercel/blob";

/**
 * Arquivos da aba Social Media no Vercel Blob do projeto (variável
 * BLOB_READ_WRITE_TOKEN, criada pela Vercel ao conectar o Blob ao projeto).
 * Os links são públicos para o Metricool conseguir buscar a mídia ao agendar.
 */

export function isStorageConfigured() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export class StorageError extends Error {}

/** Tamanho máximo de um arquivo copiado de um link (vídeo incluído). */
const MAX_COPY_BYTES = 300 * 1024 * 1024;

export function kindOf(contentType: string | null | undefined, name = "") {
  const ct = (contentType ?? "").toLowerCase();
  const ext = name.toLowerCase().split("?")[0].split(".").pop() ?? "";
  if (ct.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "avif"].includes(ext)) return "imagem";
  if (ct.startsWith("video/") || ["mp4", "mov", "webm", "m4v"].includes(ext)) return "video";
  if (ct === "application/pdf" || ext === "pdf") return "pdf";
  return "outro";
}

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "application/pdf": "pdf",
};

/** Nome de arquivo seguro para o caminho do Blob. */
export function safeName(name: string) {
  const clean = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(-80);
  return clean || "arquivo";
}

/** Links que o servidor não deve buscar (rede interna). */
function isPrivateHost(host: string) {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".internal") ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^169\.254\./.test(h) ||
    h === "0.0.0.0" ||
    h.startsWith("[")
  );
}

/** O link é de um arquivo já guardado no Blob deste projeto? */
export function isOwnBlobUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/**
 * Baixa um arquivo de um link público (export do Canva, Metricool, Drive
 * público...) e guarda uma cópia permanente no Blob.
 */
export async function copyFromUrl(sourceUrl: string, folder: string) {
  if (!isStorageConfigured()) throw new StorageError("Conecte o Blob ao projeto na Vercel para guardar arquivos.");
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new StorageError(`Link inválido: ${sourceUrl.slice(0, 80)}`);
  }
  if (!/^https?:$/.test(parsed.protocol) || isPrivateHost(parsed.hostname)) {
    throw new StorageError(`Link não permitido: ${parsed.hostname}`);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(parsed, { redirect: "follow", signal: controller.signal, cache: "no-store" });
    if (!res.ok || !res.body) throw new StorageError(`Não consegui baixar o arquivo (HTTP ${res.status}).`);
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_COPY_BYTES) throw new StorageError("Arquivo grande demais (máximo de 300 MB).");
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim() || "application/octet-stream";
    const fromPath = decodeURIComponent(parsed.pathname.split("/").pop() ?? "");
    const ext = EXT[contentType] ?? (fromPath.includes(".") ? fromPath.split(".").pop() : "bin");
    const base = safeName(fromPath.replace(/\.[^.]+$/, "")) || "arquivo";
    const blob = await put(`${folder}/${base}.${ext}`, res.body, {
      access: "public",
      contentType,
      addRandomSuffix: true,
      multipart: length === 0 || length > 20 * 1024 * 1024,
    });
    return {
      url: blob.url,
      pathname: blob.pathname,
      contentType,
      size: length || null,
      name: `${base}.${ext}`,
      kind: kindOf(contentType, `${base}.${ext}`),
    };
  } catch (e) {
    if (e instanceof StorageError) throw e;
    if (e instanceof Error && e.name === "AbortError") throw new StorageError("O download demorou demais.");
    console.error("[storage] cópia falhou", e);
    throw new StorageError("Não consegui copiar o arquivo para o cockpit.");
  } finally {
    clearTimeout(timer);
  }
}

/** Apaga arquivos do Blob (melhor esforço: não trava se falhar). */
export async function removeFiles(urls: string[]) {
  const own = urls.filter(isOwnBlobUrl);
  if (!own.length || !isStorageConfigured()) return;
  // não deixa a tela ou o conector esperando se o Blob estiver lento
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    await del(own, { abortSignal: controller.signal });
  } catch (e) {
    console.error("[storage] remoção falhou", e);
  } finally {
    clearTimeout(timer);
  }
}
