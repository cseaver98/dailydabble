"use client";

import { useState } from "react";

type AsyncImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  overlayClassName?: string;
  spinnerClassName?: string;
  onError?: () => void;
};

export default function AsyncImage({
  src,
  alt,
  className = "",
  wrapperClassName = "",
  overlayClassName = "",
  spinnerClassName = "",
  onError,
}: AsyncImageProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const isLoaded = Boolean(src && loadedSrc === src);

  if (!src) {
    return null;
  }

  return (
    <div
      className={`relative ${wrapperClassName}`.trim()}
      aria-busy={!isLoaded}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={src}
        alt={alt}
        className={`${className} transition-opacity duration-200 ${isLoaded ? "opacity-100" : "opacity-0"}`.trim()}
        onLoad={() => {
          setLoadedSrc(src);
        }}
        onError={() => {
          setLoadedSrc(src);
          onError?.();
        }}
      />
      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
          isLoaded ? "opacity-0" : "opacity-100"
        } ${overlayClassName}`.trim()}
        aria-hidden="true"
      >
        <span
          className={`inline-flex h-10 w-10 animate-spin rounded-full border-[3px] border-current border-t-transparent ${
            spinnerClassName || ""
          }`.trim()}
        />
      </div>
    </div>
  );
}
