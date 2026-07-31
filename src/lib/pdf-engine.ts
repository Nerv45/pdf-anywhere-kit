import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

export type LoadedDoc = {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
};

export type PageItem = {
  id: string;
  docId: string;
  /** zero-based page index inside its source document */
  index: number;
  rotation: number;
};

export type BuildOptions = {
  numbering: boolean;
};

let uid = 0;
export const nextId = (prefix = "id") => `${prefix}-${Date.now().toString(36)}-${uid++}`;

export async function loadDocument(file: File): Promise<{ doc: LoadedDoc; pages: PageItem[] }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const parsed = await PDFDocument.load(bytes.slice(), { ignoreEncryption: true });
  const id = nextId("doc");
  const doc: LoadedDoc = {
    id,
    name: file.name.replace(/\.pdf$/i, ""),
    bytes,
    pageCount: parsed.getPageCount(),
  };
  const pages: PageItem[] = parsed.getPages().map((page, index) => ({
    id: nextId("pg"),
    docId: id,
    index,
    rotation: ((page.getRotation().angle % 360) + 360) % 360,
  }));
  return { doc, pages };
}

async function sourceMap(docs: LoadedDoc[], needed: Set<string>) {
  const map = new Map<string, PDFDocument>();
  for (const doc of docs) {
    if (!needed.has(doc.id)) continue;
    map.set(doc.id, await PDFDocument.load(doc.bytes.slice(), { ignoreEncryption: true }));
  }
  return map;
}

/** Assembles a new PDF from the current page list (order, rotation, deletions applied). */
export async function buildPdf(
  pages: PageItem[],
  docs: LoadedDoc[],
  options: BuildOptions,
): Promise<Uint8Array> {
  if (pages.length === 0) throw new Error("No pages left to save.");
  const sources = await sourceMap(docs, new Set(pages.map((p) => p.docId)));
  const out = await PDFDocument.create();

  for (const item of pages) {
    const source = sources.get(item.docId);
    if (!source) continue;
    const [copied] = await out.copyPages(source, [item.index]);
    if (!copied) continue;
    copied.setRotation(degrees(item.rotation));
    out.addPage(copied);
  }

  if (options.numbering) {
    const font = await out.embedFont(StandardFonts.Helvetica);
    const size = 10;
    out.getPages().forEach((page, i) => {
      const label = `${i + 1} / ${pages.length}`;
      const width = font.widthOfTextAtSize(label, size);
      const angle = ((page.getRotation().angle % 360) + 360) % 360;
      const { width: pw, height: ph } = page.getSize();
      const margin = 28;
      let x = pw - margin - width;
      let y = margin;
      if (angle === 90) {
        x = margin;
        y = margin;
      } else if (angle === 180) {
        x = margin;
        y = ph - margin;
      } else if (angle === 270) {
        x = pw - margin;
        y = ph - margin - width;
      }
      page.drawText(label, {
        x,
        y,
        size,
        font,
        color: rgb(0.25, 0.25, 0.28),
        rotate: degrees(angle),
      });
    });
  }

  return out.save();
}

/** Extracts a subset (by position in the current page list) into its own PDF. */
export async function extractRange(
  pages: PageItem[],
  docs: LoadedDoc[],
  from: number,
  to: number,
  options: BuildOptions,
): Promise<Uint8Array> {
  const start = Math.max(1, Math.min(from, to));
  const end = Math.min(pages.length, Math.max(from, to));
  return buildPdf(pages.slice(start - 1, end), docs, options);
}

/** One single-page PDF per page of the current document, as [filename, bytes]. */
export async function splitToSinglePages(
  pages: PageItem[],
  docs: LoadedDoc[],
  baseName: string,
): Promise<Array<{ name: string; bytes: Uint8Array }>> {
  const sources = await sourceMap(docs, new Set(pages.map((p) => p.docId)));
  const pad = String(pages.length).length;
  const files: Array<{ name: string; bytes: Uint8Array }> = [];

  for (let i = 0; i < pages.length; i++) {
    const item = pages[i];
    if (!item) continue;
    const source = sources.get(item.docId);
    if (!source) continue;
    const single = await PDFDocument.create();
    const [copied] = await single.copyPages(source, [item.index]);
    if (!copied) continue;
    copied.setRotation(degrees(item.rotation));
    single.addPage(copied);
    files.push({
      name: `${baseName}-page-${String(i + 1).padStart(pad, "0")}.pdf`,
      bytes: await single.save(),
    });
  }
  return files;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  downloadBlob(new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }), filename);
}