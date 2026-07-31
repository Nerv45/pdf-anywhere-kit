import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PageThumb } from "./PageThumb";
import type { LoadedDoc, PageItem } from "@/lib/pdf-engine";

type Props = {
  pages: PageItem[];
  docs: LoadedDoc[];
  activeIndex: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
};

export function PreviewDialog({ pages, docs, activeIndex, onNavigate, onClose }: Props) {
  const page = pages[activeIndex];
  const doc = docs.find((d) => d.id === page?.docId);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onNavigate(Math.min(pages.length - 1, activeIndex + 1));
      if (event.key === "ArrowLeft") onNavigate(Math.max(0, activeIndex - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, pages.length, onClose, onNavigate]);

  if (!page || !doc) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-foreground/85 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 border-b border-background/15 px-4 py-3 text-background">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold">{doc.name}.pdf</p>
          <p className="font-mono text-xs opacity-70">
            Page {activeIndex + 1} of {pages.length} · rotation {page.rotation}°
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close preview">
          <X className="size-5" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 items-center gap-2 px-2 py-4 sm:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          disabled={activeIndex === 0}
          onClick={() => onNavigate(activeIndex - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-6" />
        </Button>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="max-h-full rounded-sm bg-card p-1 shadow-page">
            <PageThumb
              key={page.id}
              docId={doc.id}
              bytes={doc.bytes}
              pageIndex={page.index}
              rotation={page.rotation}
              width={1400}
              className="h-[70vh] w-[86vw] max-w-[1200px]"
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          disabled={activeIndex >= pages.length - 1}
          onClick={() => onNavigate(activeIndex + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-6" />
        </Button>
      </div>
    </div>
  );
}