"use client";

import dynamic from "next/dynamic";

/** Konva needs the browser: these load only on the client. */
export const FlyerEditorClient = dynamic(() => import("./flyer-editor").then((m) => m.FlyerEditor), {
  ssr: false,
  loading: () => <div className="grid h-dvh place-items-center text-sm text-muted">Loading the editor…</div>
});

export const ScenePreviewClient = dynamic(() => import("./flyer-canvas").then((m) => m.ScenePreview), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-black/10" />
});
