"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { CommandPalette } from "@/widgets/layout/command-palette";
import { AuthBootstrap } from "@/app/providers/auth-bootstrap";
import { GlobalHotkeys } from "@/app/providers/global-hotkeys";

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
      <AuthBootstrap />
      <GlobalHotkeys />
      {shouldRenderPalette ? (
        <CommandPalette
          isOpen={isPaletteOpen}
          onOpenChange={setIsPaletteOpen}
        />
      ) : null}
      {children}
    </>
  );
}
