"use client";

/**
 * Lightweight animation wrappers using framer-motion's LazyMotion + m API.
 * This approach lazy-loads animation features on first use, reducing the initial 
 * bundle from ~130KB to ~5KB. Features are loaded async via domAnimation.
 */

import { LazyMotion, domAnimation, m, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode, useState, useRef } from "react";

// ==========================================
// 0. LAZY MOTION PROVIDER (wrap once at app root or per-subtree)
// ==========================================
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}

function MotionFeatures({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}

// ==========================================
// 1. FADE IN ANIMATION
// ==========================================
interface FadeInProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  delay?: number;
  duration?: number;
}

export function FadeIn({ children, delay = 0, duration = 0.5, className, ...props }: FadeInProps) {
  return (
    <MotionFeatures>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
        className={className}
        {...props}
      >
        {children}
      </m.div>
    </MotionFeatures>
  );
}

// ==========================================
// 2. SLIDE UP ANIMATION
// ==========================================
interface SlideUpProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  delay?: number;
  duration?: number;
  yOffset?: number;
}

export function SlideUp({ children, delay = 0, duration = 0.5, yOffset = 20, className, ...props }: SlideUpProps) {
  return (
    <MotionFeatures>
      <m.div
        initial={{ opacity: 0, y: yOffset }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration, delay, type: "spring", damping: 25, stiffness: 200 }}
        className={className}
        {...props}
      >
        {children}
      </m.div>
    </MotionFeatures>
  );
}

// ==========================================
// 3. STAGGER CONTAINER ANIMATION
// ==========================================
interface StaggerContainerProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  staggerDelay?: number;
  delayChildren?: number;
}

export function StaggerContainer({
  children,
  staggerDelay = 0.1,
  delayChildren = 0,
  className,
  ...props
}: StaggerContainerProps) {
  return (
    <MotionFeatures>
      <m.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: {
              staggerChildren: staggerDelay,
              delayChildren: delayChildren,
            },
          },
        }}
        className={className}
        {...props}
      >
        {children}
      </m.div>
    </MotionFeatures>
  );
}

// ==========================================
// 4. STAGGER ITEM ANIMATION
// ==========================================
interface StaggerItemProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  yOffset?: number;
}

export function StaggerItem({ children, yOffset = 20, className, ...props }: StaggerItemProps) {
  return (
    <MotionFeatures>
      <m.div
        variants={{
          hidden: { opacity: 0, y: yOffset },
          show: {
            opacity: 1,
            y: 0,
            transition: { type: "spring", damping: 25, stiffness: 200 },
          },
        }}
        className={className}
        {...props}
      >
        {children}
      </m.div>
    </MotionFeatures>
  );
}

// ==========================================
// 5. SCALE BUTTON ANIMATION (For Micro-interactions)
// ==========================================
interface ScaleButtonProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  scaleDown?: number;
}

export function ScaleButton({ children, scaleDown = 0.95, className, ...props }: ScaleButtonProps) {
  return (
    <MotionFeatures>
      <m.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: scaleDown }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        className={cn(
          "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] inline-block",
          className
        )}
        {...props}
      >
        {children}
      </m.div>
    </MotionFeatures>
  );
}

// ==========================================
// 5.5 MAGNETIC BUTTON
// ==========================================
interface MagneticButtonProps extends HTMLMotionProps<"button"> {
  children: ReactNode;
  magneticPull?: number;
}

export function MagneticButton({ children, magneticPull = 0.2, className, ...props }: MagneticButtonProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLButtonElement>(null);

  const handleMouse = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    setPosition({ x: middleX * magneticPull, y: middleY * magneticPull });
  };

  const reset = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <MotionFeatures>
      <m.button
        ref={ref}
        onMouseMove={handleMouse}
        onMouseLeave={reset}
        animate={{ x: position.x, y: position.y }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, mass: 0.5 }}
        className={cn(
          "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          className
        )}
        {...props}
      >
        {children}
      </m.button>
    </MotionFeatures>
  );
}

// ==========================================
// 6. GLASS CARD HOVER (For iOS Cards)
// ==========================================
interface GlassHoverCardProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
}

export function GlassHoverCard({ children, className, ...props }: GlassHoverCardProps) {
  return (
    <MotionFeatures>
      <m.div
        whileHover={{
          y: -4,
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.12)",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={cn("glass-card", className)}
        {...props}
      >
        {children}
      </m.div>
    </MotionFeatures>
  );
}

// ==========================================
// 7. ULTRA-MODERN GLOW CARD
// ==========================================
interface GlowCardProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  glowColor?: string;
  glowOpacity?: number;
}

export function GlowCard({
  children,
  glowColor = "var(--accent)",
  glowOpacity = 0.15,
  className,
  ...props
}: GlowCardProps) {
  return (
    <MotionFeatures>
      <m.div
        whileHover="hover"
        className={cn("relative rounded-xl bg-white", className)}
        {...props}
      >
        <m.div
          variants={{ hover: { opacity: 1, filter: "blur(12px)" } }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 z-0 rounded-xl pointer-events-none"
          style={{
            background: `linear-gradient(45deg, transparent, ${glowColor}, transparent)`,
            opacity: glowOpacity,
            margin: "-1px",
          }}
        />
        <div className="relative z-10 h-full w-full rounded-xl border border-[var(--border-soft)] bg-white border-opacity-50">
          {children}
        </div>
      </m.div>
    </MotionFeatures>
  );
}
