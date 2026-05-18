"use client";

import { useEffect } from "react";

// iOS Safari ignores `user-scalable=no` / `maximum-scale=1` on the viewport
// meta tag since iOS 10, so the meta-tag lock in `app/layout.tsx` is not
// enough on its own. This component attaches the JS gesture/touch listeners
// that actually block pinch-zoom across the whole app. Double-tap-zoom is
// handled by `touch-action: manipulation` on `html` in `globals.css`.
export function MobileZoomLock() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const blockGesture = (e: Event) => {
      e.preventDefault();
    };

    const blockMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };

    document.addEventListener("gesturestart", blockGesture);
    document.addEventListener("gesturechange", blockGesture);
    document.addEventListener("gestureend", blockGesture);
    document.addEventListener("touchmove", blockMultiTouch, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", blockGesture);
      document.removeEventListener("gesturechange", blockGesture);
      document.removeEventListener("gestureend", blockGesture);
      document.removeEventListener("touchmove", blockMultiTouch);
    };
  }, []);

  return null;
}
