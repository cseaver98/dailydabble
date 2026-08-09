"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin/verble", label: "Verble" },
  { href: "/admin/agegaple", label: "Agegaple (Paused)" },
  { href: "/admin/doodle", label: "Doodle (Paused)" },
  { href: "/admin/moviedle", label: "Moviedle (Paused)" },
  { href: "/admin/yeardle", label: "Yeardle (Paused)" },
  { href: "/admin/equadle", label: "Equadle (Paused)" },
  { href: "/admin/sportle", label: "Sportle (Paused)" },
  { href: "/admin/email", label: "Email" },
];

export default function AdminShell({ children }) {
  const pathname = usePathname();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <p className="admin-brand">DailyDabble</p>
        <p className="admin-subtle">Admin</p>
        <nav className="admin-nav" aria-label="Game curation tabs">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || (tab.href === "/admin/verble" && pathname === "/admin");
            return (
              <Link key={tab.href} href={tab.href} className={`admin-nav-link${isActive ? " active" : ""}`}>
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
}
