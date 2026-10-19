/**
 * Beam overlay page: shoots the beam out of the hands (grows from its origin),
 * holds, then fades. Gentle, single fade: no strobing (SPEC section 22).
 * Parameters come from the URL query, set by the main process.
 */

export {};

const params = new URLSearchParams(location.search);
const wrap = document.getElementById("wrap") as HTMLDivElement;
const img = document.getElementById("beam") as HTMLImageElement;
const facing = params.get("dir") === "left" ? "left" : "right";
const duration = Math.min(5000, Math.max(300, Number(params.get("dur")) || 1100));
const originFraction = Math.min(1, Math.max(0, Number(params.get("ox")) || 0));
const src = params.get("img") ?? "";

// Mirror the image about its own centre; grow the wrapper from the hands.
if (facing === "left") img.style.transform = "scaleX(-1)";
wrap.style.transformOrigin = `${originFraction * 100}% 50%`;

const GROW_MS = 180;
const FADE_MS = 350;

if (src.startsWith("file:")) {
  img.onload = () => {
    wrap.animate(
      [
        { transform: "scaleX(0.05)", opacity: 0.6, offset: 0 },
        { transform: "scaleX(1)", opacity: 1, offset: GROW_MS / duration },
        { transform: "scaleX(1)", opacity: 1, offset: 1 - FADE_MS / duration },
        { transform: "scaleX(1)", opacity: 0, offset: 1 },
      ],
      { duration, easing: "ease-out", fill: "forwards" }
    );
  };
  img.src = src;
}
