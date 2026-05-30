"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";

interface SlimLoaderProps {
  isVisible: boolean;
  className?: string;
}

export const SlimLoader = React.memo(function SlimLoader({
  isVisible,
  className,
}: SlimLoaderProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: 1, scaleY: 1 }}
          exit={{ opacity: 0, scaleY: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute top-0 left-0 right-0 z-30 h-0.5 w-full origin-top overflow-hidden bg-gray-100"
        >
          <motion.div
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              repeat: Infinity,
              ease: "linear",
              duration: 1.2,
            }}
            className="h-full w-1/3 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
});
