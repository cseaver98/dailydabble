"use client";

import { DailydabbleMenu, DailydabbleNav } from "@dailydabble/ui";
import { ReactNode, useEffect, useState } from "react";

type LegalPageShellProps = {
  title: string;
  updatedLabel: string;
  children: ReactNode;
};

export default function LegalPageShell({ title, updatedLabel, children }: LegalPageShellProps) {
  const [isDarkMode] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.localStorage.getItem("theme") !== "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    window.localStorage.setItem("theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  const mainClass = isDarkMode
    ? "min-h-screen bg-[radial-gradient(circle_at_top,_#1e293b_0%,_#111827_45%,_#030712_100%)] text-zinc-100"
    : "min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#f5f7fb_48%,_#edf1f8_100%)] text-zinc-900";
  const panelClass = isDarkMode
    ? "rounded-3xl border border-zinc-700 bg-zinc-900/85 p-6 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.9)] sm:p-8"
    : "rounded-3xl border border-zinc-300 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.25)] sm:p-8";
  const mutedTextClass = isDarkMode ? "text-zinc-400" : "text-zinc-500";
  const contentClass = isDarkMode ? "text-zinc-200" : "text-slate-700";

  return (
    <main className={mainClass}>
      <DailydabbleNav
        subtitle="Agegaple"
        rightContent={
          <DailydabbleMenu
            items={[
              { label: "Today", href: "/" },
              { label: "Archive games", href: "/archive" },
            ]}
          />
        }
        headerClassName={isDarkMode ? "bg-zinc-950/90 border-zinc-700" : "bg-white/90 border-zinc-300"}
        innerClassName="max-w-3xl px-5"
      />

      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-5 sm:py-10">
        <div className={panelClass}>
          <div className="space-y-2">
            <p className={`text-sm font-semibold uppercase tracking-[0.18em] ${mutedTextClass}`}>Agegaple</p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
            <p className={`text-sm ${mutedTextClass}`}>{updatedLabel}</p>
          </div>

          <section className={`mt-6 space-y-3 text-sm leading-6 sm:text-[15px] ${contentClass}`}>
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
