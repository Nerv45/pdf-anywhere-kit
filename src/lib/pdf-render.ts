/**
 * Browser-only PDF rasterizer used for page thumbnails and the preview mode.
 * Everything stays in memory — nothing is uploaded anywhere.
 */
type AnyPdfjs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<AnyPdfjs> | null = null;

async function getPdfjs(): Promise<AnyPdfjs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

const docCache = new Map<string, Promise<any>>();

function getDoc(docId: string, bytes: Uint8Array) {
  let cached = docCache.get(docId);
  if (!cached) {
    cached = (async () => {
      const pdfjs = await getPdfjs();
      return pdfjs.getDocument({ data: bytes.slice() }).promise;
    })();
    docCache.set(docId, cached);
  }
  return cached;
}

export function releaseDoc(docId: string) {
  const cached = docCache.get(docId);
  docCache.delete(docId);
  void cached?.then((doc) => doc.destroy?.()).catch(() => undefined);
}

export type RenderedPage = { dataUrl: string; width: number; height: number };

const imageCache = new Map<string, Promise<RenderedPage>>();

export function renderPage(
  docId: string,
  bytes: Uint8Array,
  pageIndex: number,
  targetWidth: number,
): Promise<RenderedPage> {
  const key = `${docId}:${pageIndex}:${targetWidth}`;
  let cached = imageCache.get(key);
  if (cached) return cached;

  cached = (async () => {
    const doc = await getDoc(docId, bytes);
    const page = await doc.getPage(pageIndex + 1);
    const base = page.getViewport({ scale: 1 });
    const scale = targetWidth / base.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    };
  })();

  imageCache.set(key, cached);
  return cached;
}