// useViewport.js — syncs visual viewport to CSS vars AND directly repositions
// fixed modals when the iOS keyboard opens/closes
import { useEffect } from "react";

export function useViewport() {
  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport;
      if (!vv) return;

      const height    = vv.height;
      const offsetTop = vv.offsetTop;

      // Update CSS vars (used by modal-overlay etc)
      document.documentElement.style.setProperty("--viewport-height",     `${height}px`);
      document.documentElement.style.setProperty("--viewport-offset-top", `${offsetTop}px`);

      // Directly reposition receipt-modal-wrap via inline style
      // Must use top + height (not bottom) because bottom is relative to
      // layout viewport which doesn't shrink when keyboard opens on iOS
      const wrap = document.querySelector(".receipt-modal-wrap");
      if (wrap) {
        // vv.height is already the visible area ABOVE the keyboard
        // vv.offsetTop is how far down the visual viewport has scrolled
        const wrapH = Math.round(height * 0.92);
        const wrapTop = offsetTop + height - wrapH;
        wrap.style.top    = `${wrapTop}px`;
        wrap.style.height = `${wrapH}px`;
        wrap.style.bottom = "auto";
      }
    };

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
