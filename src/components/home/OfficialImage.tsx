"use client";

import { useEffect, useRef, useState } from "react";

type Props = { src: string | null; fallback: string; alt: string; className?: string };

// The notice's own photo, or the saved copy when the source doesn't load.
export function OfficialImage({ src, fallback, alt, className }: Props) {
  const [current, setCurrent] = useState(src ?? fallback);
  const image = useRef<HTMLImageElement>(null);

  // An image that failed before hydration never fires onError, so check once on mount.
  useEffect(() => {
    const element = image.current;
    if (element?.complete && element.naturalWidth === 0) setCurrent(fallback);
  }, [fallback]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={image}
      src={current}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setCurrent(fallback)}
      className={className}
    />
  );
}
