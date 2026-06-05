// Category presentation metadata — shared by UI. Accent colors tuned for a dark theme.
import type { Category } from "./types";

export const CATEGORY_META: Record<Category, { label: string; accent: string; emoji: string }> = {
  tech: { label: "Tech & Startups", accent: "#7c9cff", emoji: "💻" },
  music: { label: "Music", accent: "#ff6b9d", emoji: "🎵" },
  nightlife: { label: "Nightlife", accent: "#c084fc", emoji: "🌃" },
  food: { label: "Food & Drink", accent: "#ffb454", emoji: "🍷" },
  arts: { label: "Arts & Culture", accent: "#5ed4b4", emoji: "🎨" },
  outdoors: { label: "Outdoors", accent: "#4ade80", emoji: "🌲" },
  wellness: { label: "Wellness", accent: "#34d399", emoji: "🧘" },
  community: { label: "Community", accent: "#fbbf24", emoji: "🤝" },
  family: { label: "Family", accent: "#60a5fa", emoji: "👨‍👩‍👧" },
  learning: { label: "Learning", accent: "#a78bfa", emoji: "📚" },
  business: { label: "Business", accent: "#94a3b8", emoji: "💼" },
  other: { label: "Other", accent: "#94a3b8", emoji: "✨" },
};

export function categoryLabel(c: Category): string {
  return CATEGORY_META[c]?.label ?? c;
}

export function categoryAccent(c: Category): string {
  return CATEGORY_META[c]?.accent ?? "#94a3b8";
}
