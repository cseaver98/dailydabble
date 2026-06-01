"use client";

import { useEffect, useRef, useState } from "react";

type EditorialContext = { description?: string | null };

export default function EditorialDrawer({ editorialContext }: { editorialContext?: EditorialContext | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }

      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const description = String(editorialContext?.description || "").trim();

  return (
    <div ref={containerRef} className="editorial-drawer">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="editorial-drawer-trigger"
        aria-expanded={isOpen}
      >
        <p className="editorial-drawer-label">Editorial content</p>
        <span className={`editorial-drawer-arrow ${isOpen ? "open" : ""}`} aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 14 12 8l6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {isOpen ? (
        <div className="editorial-drawer-popover">
          <div className="editorial-drawer-head">
            <p className="editorial-drawer-headline">Editorial content</p>
            <button type="button" onClick={() => setIsOpen(false)} className="editorial-drawer-close">
              Close
            </button>
          </div>
          <div className="editorial-drawer-content">
            {description ? <p><span className="editorial-field-label">Description:</span> {description}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
