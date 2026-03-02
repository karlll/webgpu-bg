import { createBackground } from "./webgpuBackground";
import { renderers } from "./renderers";
import { buildPane } from "./pane";

const canvas = document.getElementById("bg") as HTMLCanvasElement;

const rendererName = "plasma";

const bg = await createBackground(
  canvas,
  rendererName,
  {},
  { powerPreference: "low-power", respectReducedMotion: true }
);

bg.start();

buildPane(bg.params, renderers[rendererName].paramsMeta, rendererName);
