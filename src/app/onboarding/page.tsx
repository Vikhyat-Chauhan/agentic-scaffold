"use client";

import { ProfileForm } from "@/components/ProfileForm";

export default function OnboardingPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <header className="mb-14">
        <p className="font-mono text-xs uppercase tracking-widest2 text-text-tertiary">
          Tune your taste
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-text-primary text-balance sm:text-5xl">
          Tell us what a great night looks like.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-text-secondary">
          Afoot ranks every event in the city against your taste. Adjust anything below and your
          feed re-ranks instantly.
        </p>
      </header>

      <ProfileForm />
    </main>
  );
}
