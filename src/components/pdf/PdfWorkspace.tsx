import { useCallback, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import JSZip from "jszip";
import {
  CheckSquare,
  Download,
  Eye,
  FileDown,
  FilePlus2,
  Files,
  GripVertical,
  Hash,
  Loader2,
  RotateCcw,
  RotateCw,
  Scissors,
  ShieldCheck,
  Square,
  Trash2,
  Undo2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PageThumb } from "./PageThumb";
import { PreviewDialog } from "./PreviewDialog";
import {
  buildPdf,
  downloadBlob,
  downloadPdf,
  extractRange,
  loadDocument,
  splitToSinglePages,
  type LoadedDoc,
  type PageItem,
} from "@/lib/pdf-engine";
import { releaseDoc } from "@/lib/pdf-render";

export function PdfWorkspace() {
  const [docs, setDocs] = useState<LoadedDoc[]>([]);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [numbering, setNumbering] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [range, setRange] = useState({ from: "1", to: "1" });
  const dragPage = useRef<string | null>(null);
  const dragDoc = useRef<string | null>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const baseName = docs[0]?.name ?? "document";

  const ingest = useCallback(async (files: File[]) => {
    const pdfs = files.filter(
      (file) => file.type === "application/pdf" || /\.pdf$/i.test(file.name),
    );
    if (pdfs.length === 0) {
      toast.error("Only PDF files are supported.");
      return;
    }
    setBusy("Reading files");
    try {
      for (const file of pdfs) {
        const { doc, pages: docPages } = await loadDocument(file);
        setDocs((prev) => [...prev, doc]);
        setPages((prev) => [...prev, ...docPages]);
      }
      toast.success(
        pdfs.length === 1 ? `Loaded ${pdfs[0]!.name}` : `Loaded ${pdfs.length} documents`,
      );
    } catch {
      toast.error("That file couldn't be read as a PDF.");
    } finally {
      setBusy(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: ingest,
    accept: { "application/pdf": [".pdf"] },
    noClick: true,
    noKeyboard: true,
  });

  const targets = (pageId?: string) =>
    pageId ? [pageId] : selected.length > 0 ? selected : pages.map((p) => p.id);

  const rotate = (delta: number, pageId?: string) => {
    const ids = new Set(targets(pageId));
    setPages((prev) =>
      prev.map((page) =>
        ids.has(page.id) ? { ...page, rotation: (((page.rotation + delta) % 360) + 360) % 360 } : page,
      ),
    );
  };

  const removePages = (pageId?: string) => {
    const ids = new Set(targets(pageId));
    if (ids.size === pages.length && !pageId) {
      toast.error("You can't delete every page.");
      return;
    }
    setPages((prev) => prev.filter((page) => !ids.has(page.id)));
    setSelected((prev) => prev.filter((id) => !ids.has(id)));
    toast.success(`${ids.size} page${ids.size > 1 ? "s" : ""} removed`);
  };

  const toggleSelect = (pageId: string) =>
    setSelected((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId],
    );

  const removeDoc = (docId: string) => {
    setDocs((prev) => prev.filter((doc) => doc.id !== docId));
    setPages((prev) => prev.filter((page) => page.docId !== docId));
    releaseDoc(docId);
  };

  const reorderPages = (targetId: string) => {
    const sourceId = dragPage.current;
    dragPage.current = null;
    if (!sourceId || sourceId === targetId) return;
    setPages((prev) => {
      const next = [...prev];
      const from = next.findIndex((p) => p.id === sourceId);
      const to = next.findIndex((p) => p.id === targetId);
      if (from < 0 || to < 0) return prev;
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(to, 0, moved);
      return next;
    });
  };

  const reorderDocs = (targetId: string) => {
    const sourceId = dragDoc.current;
    dragDoc.current = null;
    if (!sourceId || sourceId === targetId) return;
    let order: string[] = [];
    setDocs((prev) => {
      const next = [...prev];
      const from = next.findIndex((d) => d.id === sourceId);
      const to = next.findIndex((d) => d.id === targetId);
      if (from < 0 || to < 0) return prev;
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(to, 0, moved);
      order = next.map((d) => d.id);
      return next;
    });
    if (order.length > 0) {
      setPages((prev) =>
        [...prev].sort((a, b) => order.indexOf(a.docId) - order.indexOf(b.docId)),
      );
    }
  };

  const withBusy = async (label: string, task: () => Promise<void>) => {
    setBusy(label);
    try {
      await task();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Processing failed.");
    } finally {
      setBusy(null);
    }
  };

  const applyAndSave = () =>
    withBusy("Building PDF", async () => {
      const bytes = await buildPdf(pages, docs, { numbering });
      const name = docs.length > 1 ? `${baseName}-merged.pdf` : `${baseName}-edited.pdf`;
      downloadPdf(bytes, name);
      toast.success(`Saved ${name}`);
    });

  const saveRange = () =>
    withBusy("Extracting range", async () => {
      const from = Number(range.from);
      const to = Number(range.to);
      if (!Number.isFinite(from) || !Number.isFinite(to)) throw new Error("Enter a valid range.");
      const bytes = await extractRange(pages, docs, from, to, { numbering });
      downloadPdf(bytes, `${baseName}-p${from}-${to}.pdf`);
      toast.success("Range extracted");
    });

  const splitAll = () =>
    withBusy("Splitting pages", async () => {
      const files = await splitToSinglePages(pages, docs, baseName);
      const zip = new JSZip();
      for (const file of files) zip.file(file.name, file.bytes);
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `${baseName}-pages.zip`);
      toast.success(`${files.length} single-page PDFs zipped`);
    });

  const scopeLabel = selected.length > 0 ? `${selected.length} selected` : "all pages";
  const hasFiles = docs.length > 0;

  return (
    <div {...getRootProps()} className="relative min-h-screen">
      <input {...getInputProps()} />

      {isDragActive && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-primary/10 backdrop-blur-[2px]">
          <div className="rounded-lg border-2 border-dashed border-primary bg-card px-6 py-4 font-display font-semibold text-primary shadow-panel">
            Drop PDFs to load them locally
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1700px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-md bg-primary font-display text-sm font-bold text-primary-foreground">
              PL
            </span>
            <div className="leading-tight">
              <h1 className="text-base font-semibold">Plotline</h1>
              <p className="font-mono text-[11px] text-muted-foreground">
                local-only PDF workbench
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground sm:inline-flex">
              <ShieldCheck className="size-3.5 text-primary" /> 0 bytes leave this device
            </span>
            <Button variant="outline" size="sm" onClick={open}>
              <FilePlus2 className="size-4" /> Add PDFs
            </Button>
          </div>
        </div>
      </header>

      {!hasFiles ? (
        <main className="blueprint-grid mx-auto flex min-h-[calc(100vh-61px)] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
          <button
            type="button"
            onClick={open}
            className="group w-full rounded-xl border-2 border-dashed border-border bg-card/80 px-6 py-14 shadow-panel transition-colors hover:border-primary"
          >
            <UploadCloud className="mx-auto size-10 text-primary transition-transform group-hover:-translate-y-0.5" />
            <h2 className="mt-5 text-xl font-semibold">Drop PDFs anywhere</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Merge, split, reorder, rotate and number pages — including wide blueprints and
              geodetic maps. Everything is processed in your browser.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              <Files className="size-4" /> Select files
            </span>
          </button>
          {busy && (
            <p className="mt-6 inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> {busy}…
            </p>
          )}
        </main>
      ) : (
        <main className="mx-auto flex max-w-[1700px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
          <aside className="lg:sticky lg:top-[77px] lg:h-fit lg:w-72 lg:shrink-0">
            <div className="space-y-5 rounded-xl border border-border bg-card p-4 shadow-panel">
              <section className="space-y-2">
                <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                  Documents · drag to reorder
                </h2>
                <ul className="space-y-1.5">
                  {docs.map((doc, index) => (
                    <li
                      key={doc.id}
                      draggable
                      onDragStart={() => (dragDoc.current = doc.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => reorderDocs(doc.id)}
                      className="flex cursor-grab items-center gap-2 rounded-md border border-border bg-secondary/60 px-2 py-1.5 active:cursor-grabbing"
                    >
                      <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">
                        {doc.name}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {doc.pageCount}p
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDoc(doc.id)}
                        aria-label={`Remove ${doc.name}`}
                        className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <Separator />

              <section className="space-y-2">
                <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                  Edit · {scopeLabel}
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => rotate(-90)}>
                    <RotateCcw className="size-4" /> 90° left
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => rotate(90)}>
                    <RotateCw className="size-4" /> 90° right
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => rotate(180)}>
                    <Undo2 className="size-4" /> 180°
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => removePages()}>
                    <Trash2 className="size-4" /> Delete
                  </Button>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      setSelected(selected.length === pages.length ? [] : pages.map((p) => p.id))
                    }
                  >
                    {selected.length === pages.length ? (
                      <Square className="size-4" />
                    ) : (
                      <CheckSquare className="size-4" />
                    )}
                    {selected.length === pages.length ? "Clear" : "Select all"}
                  </Button>
                </div>
                <label className="flex items-center justify-between rounded-md border border-border bg-secondary/60 px-3 py-2">
                  <span className="flex items-center gap-2 text-xs font-medium">
                    <Hash className="size-4 text-primary" /> Auto page numbers
                  </span>
                  <Switch checked={numbering} onCheckedChange={setNumbering} />
                </label>
              </section>

              <Separator />

              <section className="space-y-2">
                <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                  Export
                </h2>
                <Button className="w-full" onClick={applyAndSave} disabled={!!busy}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  {docs.length > 1 ? "Merge & download" : "Apply & save"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={splitAll}
                  disabled={!!busy}
                >
                  <Scissors className="size-4" /> Split to ZIP
                </Button>
                <div className="flex items-center gap-1.5">
                  <Input
                    aria-label="Range start page"
                    value={range.from}
                    inputMode="numeric"
                    onChange={(event) => setRange((r) => ({ ...r, from: event.target.value }))}
                    className="h-9 text-center font-mono text-xs"
                  />
                  <span className="font-mono text-xs text-muted-foreground">to</span>
                  <Input
                    aria-label="Range end page"
                    value={range.to}
                    inputMode="numeric"
                    onChange={(event) => setRange((r) => ({ ...r, to: event.target.value }))}
                    className="h-9 text-center font-mono text-xs"
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="size-9 shrink-0"
                    aria-label="Download page range"
                    onClick={saveRange}
                    disabled={!!busy}
                  >
                    <FileDown className="size-4" />
                  </Button>
                </div>
              </section>
            </div>
          </aside>

          <section className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">
                {pages.length} page{pages.length === 1 ? "" : "s"}
                <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                  drag thumbnails to reorder
                </span>
              </h2>
              {busy && (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> {busy}…
                </span>
              )}
            </div>

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {pages.map((page, index) => {
                const doc = docs.find((d) => d.id === page.docId);
                if (!doc) return null;
                const isSelected = selectedSet.has(page.id);
                return (
                  <li
                    key={page.id}
                    draggable
                    onDragStart={() => (dragPage.current = page.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => reorderPages(page.id)}
                    className={`group relative overflow-hidden rounded-lg border bg-card shadow-page transition-colors ${
                      isSelected ? "border-primary ring-2 ring-primary/30" : "border-border"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSelect(page.id)}
                      className="block w-full cursor-pointer"
                      aria-pressed={isSelected}
                    >
                      <PageThumb
                        docId={doc.id}
                        bytes={doc.bytes}
                        pageIndex={page.index}
                        rotation={page.rotation}
                        className="aspect-[4/3] w-full bg-surface p-3 [&_img]:bg-card [&_img]:shadow-page"
                      />
                    </button>

                    <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                        {doc.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewIndex(index)}
                        aria-label={`Preview page ${index + 1}`}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <Eye className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => rotate(90, page.id)}
                        aria-label={`Rotate page ${index + 1}`}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <RotateCw className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removePages(page.id)}
                        aria-label={`Delete page ${index + 1}`}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </main>
      )}

      {previewIndex !== null && (
        <PreviewDialog
          pages={pages}
          docs={docs}
          activeIndex={Math.min(previewIndex, pages.length - 1)}
          onNavigate={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </div>
  );
}