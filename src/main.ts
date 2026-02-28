import { createBackground } from "./webgpuBackground";

const canvas = document.getElementById("bg") as HTMLCanvasElement;

const bg = await createBackground(
  canvas,
  "perlinNoise1",
  // renderer-specific params (all optional, defaults apply):
  // { speed: 0.2, colAr: 0.2, colAg: 0.5, colAb: 0.9 },
  {},
  { powerPreference: "low-power", respectReducedMotion: true }
);

bg.start();
