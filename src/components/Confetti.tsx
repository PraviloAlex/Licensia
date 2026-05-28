import { useEffect, useRef } from "react";

const COLORS = ["#69edb3", "#7db8ff", "#ffb869", "#ff9c9c", "#c4aaff", "#8be6ff"];

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

interface ConfettiProps {
  active: boolean;
  originX?: number;
  originY?: number;
}

export function Confetti({ active, originX = 50, originY = 40 }: ConfettiProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastActive = useRef(false);

  useEffect(() => {
    if (!active || lastActive.current) return;
    lastActive.current = true;

    const container = containerRef.current;
    if (!container) return;

    const count = 28;
    const particles: HTMLDivElement[] = [];

    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "confetti-particle";

      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const size = Math.round(randomBetween(6, 12));
      const x = originX + randomBetween(-18, 18);
      const delay = randomBetween(0, 0.18);
      const duration = randomBetween(0.7, 1.1);
      const spread = randomBetween(-60, 60);

      el.style.cssText = [
        `left:${x}%`,
        `top:${originY}%`,
        `width:${size}px`,
        `height:${size}px`,
        `background:${color}`,
        `border-radius:${Math.random() > 0.5 ? "50%" : "2px"}`,
        `animation-delay:${delay}s`,
        `animation-duration:${duration}s`,
        `--spread:${spread}px`,
      ].join(";");

      el.style.setProperty("--spread", `${spread}px`);
      container.appendChild(el);
      particles.push(el);
    }

    const cleanup = setTimeout(() => {
      particles.forEach((p) => p.remove());
      lastActive.current = false;
    }, 1400);

    return () => {
      clearTimeout(cleanup);
      particles.forEach((p) => p.remove());
      lastActive.current = false;
    };
  }, [active, originX, originY]);

  return <div ref={containerRef} className="confetti-root" aria-hidden="true" />;
}
