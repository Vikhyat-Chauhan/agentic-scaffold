"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { CATEGORIES, DEFAULT_PROFILE } from "@/lib/types";
import type { Category, Profile } from "@/lib/types";
import { CATEGORY_META } from "@/lib/categories";
import { cn } from "@/lib/utils";

const PRICE_PRESETS: { label: string; value: number | null }[] = [
  { label: "Free only", value: 0 },
  { label: "Under $25", value: 2500 },
  { label: "Under $75", value: 7500 },
  { label: "No limit", value: null },
];

// Sentinel so "No limit" (null) is distinguishable from "unset" in radio state.
const NO_LIMIT = "none";
const priceKey = (v: number | null) => (v === null ? NO_LIMIT : String(v));

export function ProfileForm() {
  const router = useRouter();
  const [interests, setInterests] = useState<Category[]>(DEFAULT_PROFILE.interests);
  const [vibe, setVibe] = useState(DEFAULT_PROFILE.vibe);
  const [priceMax, setPriceMax] = useState<string>(priceKey(DEFAULT_PROFILE.priceMaxCents));
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const { profile }: { profile: Profile } = await res.json();
        if (!active || !profile) return;
        if (Array.isArray(profile.interests)) setInterests(profile.interests);
        if (typeof profile.vibe === "string") setVibe(profile.vibe);
        setPriceMax(priceKey(profile.priceMaxCents ?? null));
      } catch {
        // Fall back to defaults already in state.
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const toggleInterest = (c: Category) =>
    setInterests((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const priceMaxCents = priceMax === NO_LIMIT ? null : Number(priceMax);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests, vibe, priceMaxCents }),
      });
      router.push("/");
    } catch {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-12">
      {/* Interests */}
      <Section
        n="01"
        title="What are you into?"
        hint="Pick the scenes you want surfaced. Choose as many as you like."
      >
        <div className="flex flex-wrap gap-2.5">
          {CATEGORIES.map((c) => {
            const meta = CATEGORY_META[c];
            const active = interests.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleInterest(c)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition-all duration-200",
                  active
                    ? "text-canvas"
                    : "border-border bg-surface text-text-secondary hover:border-border-2 hover:text-text-primary"
                )}
                style={
                  active
                    ? { backgroundColor: meta.accent, borderColor: meta.accent }
                    : undefined
                }
              >
                <span aria-hidden>{meta.emoji}</span>
                {meta.label}
                {active ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Vibe */}
      <Section
        n="02"
        title="Describe your perfect night out"
        hint="Free text. The more specific, the sharper your matches."
      >
        <textarea
          value={vibe}
          onChange={(e) => setVibe(e.target.value)}
          rows={5}
          placeholder="e.g. Intimate jazz shows, natural-wine bars, indie film screenings, and the occasional AI meetup…"
          className="w-full resize-none rounded-2xl border border-border bg-surface p-4 text-base leading-relaxed text-text-primary placeholder:text-text-tertiary transition-colors focus:border-border-2 focus:outline-none"
        />
      </Section>

      {/* Price ceiling */}
      <Section n="03" title="What's your spending ceiling?" hint="We'll downrank anything above it.">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {PRICE_PRESETS.map((p) => {
            const key = priceKey(p.value);
            const active = priceMax === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPriceMax(key)}
                aria-pressed={active}
                className={cn(
                  "rounded-xl border px-4 py-4 text-sm font-medium transition-all duration-200",
                  active
                    ? "border-text-primary bg-text-primary text-canvas"
                    : "border-border bg-surface text-text-secondary hover:border-border-2 hover:text-text-primary"
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-border pt-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to feed
        </Link>
        <button
          type="submit"
          disabled={saving || !loaded}
          className="flex items-center gap-2 rounded-full bg-text-primary px-7 py-3 text-sm font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            <>
              Save &amp; see my feed
              <Check className="h-4 w-4" aria-hidden />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function Section({
  n,
  title,
  hint,
  children,
}: {
  n: string;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-baseline gap-3">
        <span className="font-mono text-xs text-text-tertiary">{n}</span>
        <div>
          <h2 className="font-display text-2xl font-semibold text-text-primary">{title}</h2>
          <p className="mt-1 text-sm text-text-secondary">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
