import { useMemo } from "react";

const COLORS = ["#F4E04D", "#E8501F", "#E8341F", "#0B2B3C", "#8B7FD6"];

export function Confetti({ active }: { active: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.2 + Math.random() * 1.4,
        color: COLORS[i % COLORS.length],
        rotate: Math.random() * 360,
      })),
    [active]
  );

  if (!active) return null;

  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="wb-confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </>
  );
}
