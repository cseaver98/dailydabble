"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin/agegaple", label: "Agegaple" },
  { href: "/admin/yelple", label: "Yelple" },
  { href: "/admin/doodle", label: "Doodle" },
  { href: "/admin/moviedle", label: "Moviedle" },
  { href: "/admin/yeardle", label: "Yeardle" },
  { href: "/admin/equadle", label: "Equadle" },
  { href: "/admin/sportle", label: "Sportle" },
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
            const isActive = pathname === tab.href || (tab.href === "/admin/agegaple" && pathname === "/admin");
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
