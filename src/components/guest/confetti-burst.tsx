"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";

export function ConfettiBurst() {
  useEffect(() => {
    const colors = ["#00F5FF", "#8B5CF6", "#FF2DAA", "#39FF14", "#F5C542"];
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.4 },
      colors,
      scalar: 0.9,
    });
    const timeout = setTimeout(() => {
      confetti({ particleCount: 60, spread: 120, origin: { y: 0.3 }, colors, scalar: 0.7 });
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  return null;
}
