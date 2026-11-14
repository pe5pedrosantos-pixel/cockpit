"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, FileText, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { upload } from "@vercel/blob/client";
import {
  attachMediaFromUrlAction,
  attachUploadedMediaAction,
  moveMediaAction,
  removeMediaAction,
} from "@/lib/actions/social";
import { background } from "@/lib/social/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Feedback, useAction } from "@/components/social/bits";
import type { MediaData } from "@/components/social/types";
import { cn } from "@/lib/utils";

/**
 * Visualizador das mídias de um post: carrossel com setas e miniaturas,
 * vídeo com player e PDF embutido. Sem mídia, mostra o título no fundo
 * da peça, como um rascunho.
 */
export function MediaGallery({
  media,
  title,
  bg,
  className,
  size = "md",
}: {
  media: MediaData[];
  title: string;
  bg: string | null;
  className?: string;
  size?: "sm" | "md";
}) {
  const [index, setIndex] = useState(0);
  const items = media;
  const current = items[Math.min(index, items.length - 1)];
  const many = items.length > 1;

  useEffect(() => {
    if (index > items.length - 1) setIndex(Math.max(items.length - 1, 0));
  }, [items.length, index]);

  if (!current) {
    const b = background(bg);
    return (
      <div
        className={cn(
          "flex aspect-[4/5] w-full items-end rounded-md border border-border-strong p-3 font-display font-semibold leading-snug",
          size === "sm" ? "text-[12px]" : "text-[15px]",
          className
        )}
        style={{ backgroundColor: b?.hex ?? "#FFFFFF", color: b?.ink ?? "#0F1E3D" }}
      >
        <span className="line-clamp-5">{title}</span>
      </div>
    );
  }

  const go = (d: number) => setIndex((i) => (i + d + items.length) % items.length);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        className="relative overflow-hidden rounded-md border border-border bg-black/[0.04]"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(-1);
          if (e.key === "ArrowRight") go(1);
        }}
        tabIndex={many ? 0 : -1}
        aria-label={many ? `Carrossel com ${items.length} arquivos. Use as setas para navegar.` : undefined}
      >
        {current.kind === "video" ? (
          <video
            key={current.id}
            src={current.url}
            controls
            playsInline
            preload="metadata"
            className="aspect-[9/16] max-h-[70vh] w-full bg-black object-contain"
          />
        ) : current.kind === "pdf" ? (
          <div className="flex aspect-[4/5] w-full flex-col">
            <object data={current.url} type="application/pdf" className="h-full w-full" aria-label={current.name ?? "PDF"}>
              <a href={current.url} target="_blank" rel="noreferrer" className="flex h-full flex-col items-center justify-center gap-2 text-[13px] text-navy underline">
                <FileText className="h-6 w-6" /> Abrir o PDF
              </a>
            </object>
          </div>
        ) : current.kind === "imagem" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current.id}
            src={current.url}
            alt={`${title}: ${index + 1} de ${items.length}`}
            className="aspect-[4/5] w-full object-contain"
            loading="lazy"
          />
        ) : (
          <a href={current.url} target="_blank" rel="noreferrer" className="flex aspect-[4/5] w-full items-center justify-center text-[13px] text-navy underline">
            Abrir arquivo
          </a>
        )}

        {many && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-paper/90 p-1.5 shadow-sm hover:bg-paper"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-paper/90 p-1.5 shadow-sm hover:bg-paper"
              aria-label="Próximo"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="absolute right-2 top-2 rounded-full bg-navy/85 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-on-navy">
              {index + 1}/{items.length}
            </span>
          </>
        )}
      </div>

      {many && size === "md" && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {items.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ir para o arquivo ${i + 1}`}
              className={cn(
                "h-14 w-11 shrink-0 cursor-pointer overflow-hidden rounded border",
                i === index ? "border-coral ring-1 ring-coral" : "border-border opacity-70 hover:opacity-100"
              )}
            >
              <Thumb m={m} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Thumb({ m }: { m: MediaData }) {
  if (m.kind === "imagem") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.url} alt="" className="h-full w-full object-cover" loading="lazy" />;
  }
  return (
    <span className="flex h-full w-full items-center justify-center bg-navy text-[9px] font-semibold uppercase text-on-navy">
      {m.kind === "video" ? "vídeo" : m.kind === "pdf" ? "pdf" : "arq."}
    </span>
  );
}

/** Miniatura do primeiro arquivo (para listas e cards pequenos). */
export function MediaThumb({ media, className }: { media: MediaData[]; className?: string }) {
  const first = media[0];
  if (!first) return null;
  return (
    <span className={cn("relative block overflow-hidden rounded border border-border", className)}>
      <Thumb m={first} />
      {media.length > 1 && (
        <span className="absolute bottom-0.5 right-0.5 rounded bg-navy/85 px-1 text-[9px] font-semibold tabular-nums text-on-navy">
          {media.length}
        </span>
      )}
    </span>
  );
}

/**
 * Gerência das mídias de um post: subir arquivos (direto para o Blob),
 * copiar de um link, reordenar e remover.
 */
export function MediaManager({
  postId,
  media,
  storageEnabled,
}: {
  postId: number;
  media: MediaData[];
  storageEnabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const { pending, msg, setMsg, run } = useAction();

  if (!storageEnabled) {
    return (
      <p className="rounded-md border border-dashed border-border-strong px-3 py-2 text-[12.5px] text-ink-muted">
        Para guardar artes e vídeos aqui, conecte o Blob ao projeto na Vercel (Storage → Create → Blob).
      </p>
    );
  }

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setMsg(null);
    const list = Array.from(files);
    try {
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        const label = list.length > 1 ? `${i + 1}/${list.length} · ` : "";
        setProgress(`${label}${file.name}: 0%`);
        const safe = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-");
        const blob = await upload(`social/post-${postId}/${safe}`, file, {
          access: "public",
          handleUploadUrl: "/api/social/upload",
          multipart: file.size > 20 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => setProgress(`${label}${file.name}: ${Math.round(percentage)}%`),
        });
        const r = await attachUploadedMediaAction(postId, {
          url: blob.url,
          pathname: blob.pathname,
          contentType: blob.contentType ?? file.type,
          size: file.size,
          name: file.name,
        });
        if (!r.ok) throw new Error(r.message);
      }
      setMsg({ ok: true, text: list.length > 1 ? `${list.length} arquivos anexados.` : "Arquivo anexado." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error && e.message ? `Falha no upload: ${e.message}` : "Falha no upload." });
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {media.length > 0 && (
        <ol className="flex flex-wrap gap-2">
          {media.map((m, i) => (
            <li key={m.id} className="flex w-[4.5rem] flex-col gap-1">
              <span className="relative block h-[5.5rem] w-full overflow-hidden rounded border border-border">
                <Thumb m={m} />
                <span className="absolute left-0.5 top-0.5 rounded bg-paper/90 px-1 text-[10px] font-semibold tabular-nums">{i + 1}</span>
              </span>
              <span className="flex items-center justify-between">
                <button
                  type="button"
                  disabled={pending || i === 0}
                  onClick={() => run(() => moveMediaAction(m.id, -1))}
                  className="cursor-pointer rounded p-0.5 text-ink-muted hover:bg-black/[0.05] disabled:opacity-30"
                  aria-label={`Mover o arquivo ${i + 1} para antes`}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                {confirmId === m.id ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => removeMediaAction(m.id), () => setConfirmId(null))}
                    className="cursor-pointer rounded bg-coral px-1 text-[10px] font-semibold text-white"
                  >
                    Remover
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(m.id)}
                    className="cursor-pointer rounded p-0.5 text-ink-muted hover:bg-black/[0.05] hover:text-coral"
                    aria-label={`Remover o arquivo ${i + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending || i === media.length - 1}
                  onClick={() => run(() => moveMediaAction(m.id, 1))}
                  className="cursor-pointer rounded p-0.5 text-ink-muted hover:bg-black/[0.05] disabled:opacity-30"
                  aria-label={`Mover o arquivo ${i + 1} para depois`}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf"
          className="sr-only"
          id={`upload-${postId}`}
          onChange={(e) => onFiles(e.target.files)}
        />
        <Button variant="outline" size="sm" disabled={!!progress || pending} onClick={() => inputRef.current?.click()}>
          {progress ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {progress ? "Enviando..." : "Subir arquivos"}
        </Button>
        <div className="flex min-w-[16rem] flex-1 gap-1.5">
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="ou cole um link público (Drive, Canva...)"
            className="h-8 text-[12.5px]"
            aria-label="Link do arquivo"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={pending || !!progress || !/^https?:\/\//.test(link.trim())}
            onClick={() => run(() => attachMediaFromUrlAction(postId, link), (r) => r.ok && setLink(""))}
          >
            <Link2 className="h-3.5 w-3.5" /> {pending ? "Copiando..." : "Copiar"}
          </Button>
        </div>
      </div>
      {progress && <p className="text-[12px] tabular-nums text-ink-muted">{progress}</p>}
      <p className="text-[11.5px] text-ink-faint">
        Imagens na ordem do carrossel, vídeo (MP4/MOV) ou PDF. Ficam guardados no cockpit, com link permanente.
      </p>
      <Feedback msg={msg} />
    </div>
  );
}
