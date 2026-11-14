import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSession } from "@/lib/auth";

/**
 * Autoriza o upload direto do navegador para o Vercel Blob (fotos, vídeos e
 * PDFs dos posts). O arquivo não passa pelo servidor do cockpit, então não
 * esbarra no limite de tamanho das funções. Depois do upload, a tela chama
 * attachUploadedMediaAction para ligar o arquivo ao post.
 */

export const dynamic = "force-dynamic";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "video/quicktime", "video/webm", "application/pdf"];

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Conecte o Blob ao projeto na Vercel." }, { status: 503 });
  }
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("social/")) throw new Error("Caminho inválido");
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: 500 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha no upload" }, { status: 400 });
  }
}
