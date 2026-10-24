"use client";

import { useEffect, useRef } from "react";
import { bookmarklet } from "./bookmarklet";

// React refuses javascript: URLs in href, so the link gets it after mounting, with this server's origin.
export function BookmarkletLink() {
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    link.current?.setAttribute("href", bookmarklet(window.location.origin));
  }, []);
  return (
    <a
      ref={link}
      onClick={(event) => event.preventDefault()}
      className="inline-flex min-h-11 cursor-grab items-center self-start rounded-[10px] bg-brand px-[18px] py-3 text-[15px] font-bold text-white no-underline hover:text-white"
    >
      Vetted: collect listing
    </a>
  );
}
