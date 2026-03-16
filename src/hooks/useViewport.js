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
      // CSS vars on fixed elements are unreliable on iOS Safari when keyboard is open
      const wrap = document.querySelector(".receipt-modal-wrap");
      if (wrap) {
        const maxH = Math.round(height * 0.92);
        wrap.style.height = `${maxH}px`;
        // Keep it pinned to the bottom of the visual viewport
        wrap.style.bottom = "0px";
        wrap.style.top    = "auto";
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
