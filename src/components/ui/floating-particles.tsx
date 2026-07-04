"use client";

const COLORS = ["var(--neon-cyan)", "var(--neon-purple)", "var(--neon-pink)", "var(--neon-gold)"];

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: (i * 53) % 100,
  size: 2 + (i % 4),
  duration: 14 + (i % 7) * 2,
  delay: (i % 10) * 1.3,
  color: COLORS[i % COLORS.length],
}));

export function FloatingParticles() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {PARTICLES.map((p) => (
        <span
          key={p.id}
          className="particle"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            boxShadow: `0 0 6px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}
