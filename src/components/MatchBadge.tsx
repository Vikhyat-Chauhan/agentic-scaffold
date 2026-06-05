import { cn } from "@/lib/utils";

type Tier = { ring: string; text: string; glow: string; label: string };

function tierFor(score: number): Tier {
  if (score >= 85)
    return {
      ring: "#5ed4b4",
      text: "#9ff0d8",
      glow: "rgba(94, 212, 180, 0.35)",
      label: "Top match",
    };
  if (score >= 70)
    return {
      ring: "#7c9cff",
      text: "#b9caff",
      glow: "rgba(124, 156, 255, 0.30)",
      label: "Strong fit",
    };
  return {
    ring: "#9896a0",
    text: "#c9c7d0",
    glow: "rgba(152, 150, 160, 0.18)",
    label: "Worth a look",
  };
}

/** Color-graded score ring. Conic gradient fills proportional to the match score. */
export function MatchBadge({
  score,
  className,
  size = 52,
}: {
  score: number;
  className?: string;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const tier = tierFor(clamped);
  const deg = (clamped / 100) * 360;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Match score ${clamped} out of 100 — ${tier.label}`}
      title={`${tier.label} · ${clamped}% match`}
    >
      <div
        className="absolute inset-0 rounded-full transition-transform duration-300"
        style={{
          background: `conic-gradient(${tier.ring} ${deg}deg, rgba(255,255,255,0.07) ${deg}deg)`,
          boxShadow: `0 0 18px ${tier.glow}`,
        }}
      />
      <div
        className="absolute rounded-full bg-surface"
        style={{ inset: 4 }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span
          className="font-mono text-[15px] font-medium tabular-nums"
          style={{ color: tier.text }}
        >
          {clamped}
        </span>
        <span className="mt-[1px] font-mono text-[7px] uppercase tracking-widest2 text-text-tertiary">
          match
        </span>
      </div>
    </div>
  );
}
