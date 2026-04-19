"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface DeferredSectionProps {
  children: ReactNode;
  fallback: ReactNode;
  className?: string;
  once?: boolean;
  rootMargin?: string;
}

export function DeferredSection({
  children,
  fallback,
  className,
  once = true,
  rootMargin = "240px",
}: DeferredSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const shouldShowImmediately = typeof IntersectionObserver === "undefined";
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    if (shouldShowImmediately) {
      const timer = window.setTimeout(() => {
        setIsVisible(true);
        setHasBeenVisible(true);
      }, 0);

      return () => window.clearTimeout(timer);
    }

    if (once && hasBeenVisible) {
      return;
    }

    const node = ref.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          setHasBeenVisible(true);
          if (once) {
            observer.disconnect();
          }
          return;
        }

        if (!once) {
          setIsVisible(false);
        }
      },
      { rootMargin }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [hasBeenVisible, once, rootMargin, shouldShowImmediately]);

  const shouldRenderChildren = once ? hasBeenVisible || isVisible : isVisible;

  return (
    <div ref={ref} className={className}>
      {shouldRenderChildren ? children : fallback}
    </div>
  );
}
