"use client";

import dynamic from "next/dynamic";
import { ReactNode, useEffect, useRef, useState } from "react";

const LazyCommandPalette = dynamic(
  () => import("@/widgets/layout/command-palette").then((module) => ({ default: module.CommandPalette })),
  { ssr: false }
);
const LazyAuthBootstrap = dynamic(
  () => import("@/app/providers/auth-bootstrap").then((module) => ({ default: module.AuthBootstrap })),
  { ssr: false, loading: () => null }
);
const LazyGlobalHotkeys = dynamic(
  () => import("@/app/providers/global-hotkeys").then((module) => ({ default: module.GlobalHotkeys })),
  { ssr: false, loading: () => null }
);

export function GlobalProviders({ children }: { children: ReactNode }) {
  const [shouldRenderPalette, setShouldRenderPalette] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const shouldRenderPaletteRef = useRef(false);

  useEffect(() => {
    shouldRenderPaletteRef.current = shouldRenderPalette;
  }, [shouldRenderPalette]);

  useEffect(() => {
    const ensurePaletteVisible = () => {
      if (!shouldRenderPaletteRef.current) {
        shouldRenderPaletteRef.current = true;
        setShouldRenderPalette(true);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        ensurePaletteVisible();
        setIsPaletteOpen((open) => !open);
      }
    };

    const handleOpen = () => {
      ensurePaletteVisible();
      setIsPaletteOpen(true);
    };

    const handleToggle = () => {
      ensurePaletteVisible();
      setIsPaletteOpen((open) => !open);
    };

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("app:command-palette:open", handleOpen);
    window.addEventListener("app:command-palette:toggle", handleToggle);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("app:command-palette:open", handleOpen);
      window.removeEventListener("app:command-palette:toggle", handleToggle);
    };
  }, []);

  return (
    <>
      <LazyAuthBootstrap />
      <LazyGlobalHotkeys />
      {shouldRenderPalette ? (
        <LazyCommandPalette
          isOpen={isPaletteOpen}
          onOpenChange={setIsPaletteOpen}
        />
      ) : null}
      {children}
    </>
  );
}
