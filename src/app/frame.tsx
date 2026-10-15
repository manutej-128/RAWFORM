"use client";

import type { ReactNode } from "react";
import { Ambient } from "./ambient";

/**
 * The editorial frame: a hairline masthead, the page body, and a hairline
 * colophon, set over a blurred ambient backdrop. Shared by every screen so
 * the layout never shifts between steps.
 */
export function Frame({
  children,
  rightLabel = "A WRITING CHECK",
  onLogoClick,
}: {
  children: ReactNode;
  rightLabel?: string;
  onLogoClick?: () => void;
}) {
  return (
    <div className="relative min-h-screen text-black flex flex-col">
      <Ambient />

      <div className="page-wash relative z-10 min-h-screen flex flex-col">
        <div className="w-full max-w-[1100px] mx-auto px-5 sm:px-10 flex-1 flex flex-col">
          {/* Masthead */}
          <header className="pt-6">
            <div className="flex items-baseline justify-between pb-3">
              <button
                type="button"
                onClick={onLogoClick}
                className={`label text-black ${onLogoClick ? "cursor-pointer hover:opacity-60" : "cursor-default"} transition-opacity`}
              >
                RAWFORM
              </button>
              <span className="label text-black">{rightLabel}</span>
            </div>
            <div className="border-t border-black" />
          </header>

          {/* Body */}
          <main className="flex-1 flex flex-col">{children}</main>

          {/* Colophon */}
          <footer className="pb-7 pt-10">
            <div className="border-t border-neutral-300" />
            <div className="flex items-baseline justify-between pt-3 gap-4">
              <span className="label text-neutral-500">A PRODUCT BY ARCLUME</span>
              <span className="label text-neutral-500 text-right">
                YOUR WRITING IS NEVER STORED
              </span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
