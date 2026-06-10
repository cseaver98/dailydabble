"use client";

import { useEffect, useRef, useState } from "react";

const loadedImageSources = new Set<string>();

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
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(() => (src ? loadedImageSources.has(src) : false));

  useEffect(() => {
    if (!src) {
      setIsLoaded(false);
      return;
    }

    if (loadedImageSources.has(src)) {
      setIsLoaded(true);
      return;
    }

    setIsLoaded(false);

    const image = imageRef.current;
    if (image && image.complete && image.naturalWidth > 0) {
      loadedImageSources.add(src);
      setIsLoaded(true);
    }
  }, [src]);

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
        ref={imageRef}
        src={src}
        alt={alt}
        className={`${className} transition-opacity duration-200 ${isLoaded ? "opacity-100" : "opacity-0"}`.trim()}
        onLoad={() => {
          loadedImageSources.add(src);
          setIsLoaded(true);
        }}
        onError={() => {
          setIsLoaded(true);
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
