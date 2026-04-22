import { useCallback, useEffect, useState, type RefObject } from "react";

export type FloatingSelectorPlacement = "auto" | "top" | "bottom";

export interface FloatingSelectorPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "top" | "bottom";
}

interface UseFloatingSelectorPositionOptions {
  placement?: FloatingSelectorPlacement;
  offset?: number;
  maxPanelHeight?: number;
  minPanelHeight?: number;
  viewportPadding?: number;
}

const DEFAULT_VIEWPORT_PADDING = 16;
const DEFAULT_MIN_PANEL_HEIGHT = 140;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function collectScrollableAncestors(element: HTMLElement | null) {
  const ancestors: Element[] = [];
  let current: HTMLElement | null = element?.parentElement ?? null;

  while (current) {
    if (current.scrollHeight > current.clientHeight || current.scrollWidth > current.clientWidth) {
      ancestors.push(current);
    }
    current = current.parentElement;
  }

  return ancestors;
}

export function useFloatingSelectorPosition(
  anchorRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  {
    placement = "auto",
    offset = 8,
    maxPanelHeight = 320,
    minPanelHeight = DEFAULT_MIN_PANEL_HEIGHT,
    viewportPadding = DEFAULT_VIEWPORT_PADDING,
  }: UseFloatingSelectorPositionOptions = {},
) {
  const [position, setPosition] = useState<FloatingSelectorPosition>({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: maxPanelHeight,
    placement: "bottom",
  });

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor || typeof window === "undefined") {
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;

    const preferredPlacement =
      placement === "auto"
        ? spaceBelow < minPanelHeight && spaceAbove > spaceBelow
          ? "top"
          : "bottom"
        : placement;

    const nextPlacement =
      preferredPlacement === "top"
        ? spaceAbove > viewportPadding
          ? "top"
          : "bottom"
        : spaceBelow > viewportPadding
          ? "bottom"
          : "top";

    const availableSpace = Math.max(
      minPanelHeight,
      nextPlacement === "bottom" ? spaceBelow - offset : spaceAbove - offset,
    );
    const nextMaxHeight = clamp(availableSpace, minPanelHeight, maxPanelHeight);
    const nextWidth = Math.max(rect.width, 220);
    const nextLeft = clamp(
      rect.left,
      viewportPadding,
      viewportWidth - viewportPadding - nextWidth,
    );
    const nextTop =
      nextPlacement === "bottom"
        ? clamp(
            rect.bottom + offset,
            viewportPadding,
            viewportHeight - viewportPadding - nextMaxHeight,
          )
        : clamp(
            rect.top - nextMaxHeight - offset,
            viewportPadding,
            viewportHeight - viewportPadding - nextMaxHeight,
          );

    setPosition({
      top: nextTop,
      left: nextLeft,
      width: nextWidth,
      maxHeight: nextMaxHeight,
      placement: nextPlacement,
    });
  }, [anchorRef, maxPanelHeight, minPanelHeight, offset, placement, viewportPadding]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePosition();

    const scrollables = collectScrollableAncestors(anchorRef.current);
    const reposition = () => updatePosition();

    scrollables.forEach((scrollable) => {
      scrollable.addEventListener("scroll", reposition, { passive: true });
    });
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, { passive: true });

    return () => {
      scrollables.forEach((scrollable) => {
        scrollable.removeEventListener("scroll", reposition);
      });
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition);
    };
  }, [anchorRef, isOpen, updatePosition]);

  return {
    position,
    updatePosition,
  };
}
