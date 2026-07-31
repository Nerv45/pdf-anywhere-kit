import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

const PdfWorkspace = lazy(() =>
  import("@/components/pdf/PdfWorkspace").then((m) => ({ default: m.PdfWorkspace })),
);

const title = "Plotline — Local PDF Editor: Merge, Split, Rotate";
const description =
  "Merge, split, reorder, rotate and number PDF pages entirely in your browser. No uploads, no servers — built for documents as wide as blueprints and maps.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Fallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function Index() {
  return (
    <>
      <ClientOnly fallback={<Fallback />}>
        <Suspense fallback={<Fallback />}>
          <PdfWorkspace />
        </Suspense>
      </ClientOnly>
      <Toaster />
    </>
  );
}
