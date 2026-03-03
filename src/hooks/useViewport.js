// useViewport.js — keeps --viewport-height CSS var in sync with visual viewport
// This fixes iOS PWA keyboard-pushes-modal issue
import { useEffect } from "react";

export function useViewport() {
  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      // Set CSS vars so modals can position relative to visible area
      document.documentElement.style.setProperty("--viewport-height", `${vv.height}px`);
      document.documentElement.style.setProperty("--viewport-offset-top", `${vv.offsetTop}px`);
    };

    // Set initial value
    update();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    window.addEventListener("resize", update);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
      window.removeEventListener("resize", update);
    };
  }, []);
}
