"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Ambient backdrop: a heavily blurred, desaturated loop behind the page.
 * Purely decorative — fixed, non-interactive, muted, and hidden from
 * assistive tech. Falls back to the poster frame when video cannot play,
 * and stays off entirely for reduced-motion users.
 */
export function Ambient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [allowMotion, setAllowMotion] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setAllowMotion(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!allowMotion) {
      v.pause();
      return;
    }
    // Some browsers reject autoplay until the element is muted + inline.
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => undefined);
  }, [allowMotion]);

  // Pause while the tab is hidden so the loop costs nothing in the background.
  useEffect(() => {
    const onVisibility = () => {
      const v = videoRef.current;
      if (!v) return;
      if (document.hidden) v.pause();
      else if (allowMotion) v.play().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [allowMotion]);

  return (
    <div className="ambient" aria-hidden="true">
      <video
        ref={videoRef}
        className={`ambient-video ${ready ? "is-ready" : ""}`}
        src="/media/ambient.mp4"
        poster="/media/ambient-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        onCanPlay={() => setReady(true)}
      />
      <div className="ambient-veil" />
      <div className="ambient-grain" />
    </div>
  );
}
