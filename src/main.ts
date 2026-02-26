import { createWebGPUProceduralBackground } from "./webgpuBackground";

const canvas = document.getElementById("bg") as HTMLCanvasElement;

const bg = await createWebGPUProceduralBackground(canvas, {
  powerPreference: "low-power",
  respectReducedMotion: true,
});

bg.start();

// Optional:
// window.addEventListener("blur", () => bg.stop());
// window.addEventListener("focus", () => bg.start());
