// The completion mark keeps the doorway silhouette but still gets a short,
// visible motion so the success state feels intentional.
"use client";

import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

export function CelebrationMark({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  const shared = { duration: 0.9, ease: EASE };

  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="ArkivGate vinculado"
      className={className}
      fill="none"
    >
      <title>ArkivGate vinculado</title>
      <motion.g
        initial={reduce ? false : { scale: 0.84, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={shared}
        style={{ transformOrigin: "50% 50%" }}
      >
        <rect x="8" y="6" width="26" height="52" rx="6" fill="currentColor" />
        <rect x="16" y="14" width="12" height="36" rx="2.5" fill="var(--paper, #f6f1e8)" />
      </motion.g>
      <motion.path
        d="M28 12L50 16V48L28 52V12Z"
        fill="currentColor"
        initial={reduce ? false : { x: 10, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...shared, delay: 0.2 }}
      />
      <motion.circle
        cx="35.5"
        cy="32"
        r="2.25"
        fill="var(--paper, #f6f1e8)"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.5 }}
      />
    </svg>
  );
}
