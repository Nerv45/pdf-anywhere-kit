import { useEffect, useState } from "react";
import { FileWarning, Loader2 } from "lucide-react";
import { renderPage } from "@/lib/pdf-render";

type Props = {
  docId: string;
  bytes: Uint8Array;
  pageIndex: number;
  rotation: number;
  width?: number;
  className?: string;
};

export function PageThumb({
  docId,
  bytes,
  pageIndex,
  rotation,
  width = 420,
  className = "",
}: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setSrc(null);
    setFailed(false);
    renderPage(docId, bytes, pageIndex, width)
      .then((result) => {
        if (active) setSrc(result.dataUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [docId, bytes, pageIndex, width]);

  const quarterTurn = rotation === 90 || rotation === 270;

  return (
    <div
      className={`flex items-center justify-center overflow-hidden ${className}`}
      aria-label={`Page ${pageIndex + 1} preview`}
    >
      {src ? (
        <img
          src={src}
          alt={`Page ${pageIndex + 1}`}
          loading="lazy"
          className="max-h-full max-w-full object-contain transition-transform duration-300"
          style={{
            transform: `rotate(${rotation}deg)`,
            maxWidth: quarterTurn ? "72%" : "100%",
            maxHeight: quarterTurn ? "72%" : "100%",
          }}
        />
      ) : failed ? (
        <FileWarning className="size-5 text-muted-foreground" />
      ) : (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}