import { renderers, type RendererName, type RendererParams } from "./renderers/index";

export type Controller = {
  start(): void;
  stop(): void;
  destroy(): void;
};

type Options = {
  powerPreference?: GPUPowerPreference; // "low-power" | "high-performance"
  respectReducedMotion?: boolean;
  maxDpr?: number; // clamp DPR to avoid huge render targets (defaults to 3)
};

export async function createBackground<N extends RendererName>(
  canvas: HTMLCanvasElement,
  rendererName: N,
  params: Partial<RendererParams<N>> = {},
  opts: Options = {}
): Promise<Controller> {
  if (!("gpu" in navigator)) {
    throw new Error("WebGPU not supported in this browser (navigator.gpu missing).");
  }

  const descriptor = renderers[rendererName];
  const mergedParams = { ...descriptor.defaultParams, ...params } as RendererParams<N>;

  const powerPreference = opts.powerPreference ?? "low-power";
  const respectReducedMotion = opts.respectReducedMotion ?? true;
  const maxDpr = opts.maxDpr ?? 3;

  const prefersReducedMotion =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  const shouldAnimate = !respectReducedMotion || !prefersReducedMotion;

  // Pause when hidden to save power.
  let pausedByVisibility = document.hidden;
  const onVisibility = () => { pausedByVisibility = document.hidden; };
  document.addEventListener("visibilitychange", onVisibility, { passive: true });

  // --- WebGPU init ---
  const adapter = await navigator.gpu.requestAdapter({ powerPreference });
  if (!adapter) throw new Error("No WebGPU adapter available.");

  const device = await adapter.requestDevice();

  const context = canvas.getContext("webgpu") as GPUCanvasContext | null;
  if (!context) throw new Error("Could not get WebGPU canvas context.");

  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  const uniformBuffer = device.createBuffer({
    size: descriptor.uniformFloats * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
    ],
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  const shaderModule = device.createShaderModule({ code: descriptor.wgsl });

  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: { module: shaderModule, entryPoint: "vs_main" },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [{ format: presentationFormat }],
    },
    primitive: { topology: "triangle-list" },
  });

  // Reused every frame — avoids allocating a new Float32Array per tick.
  const uniformData = new Float32Array(descriptor.uniformFloats);

  let width = 1;
  let height = 1;
  let dpr = 1;

  function configure() {
    dpr = Math.max(1, Math.min(maxDpr, window.devicePixelRatio || 1));
    const cssW = Math.max(1, Math.floor(canvas.clientWidth));
    const cssH = Math.max(1, Math.floor(canvas.clientHeight));
    width = Math.max(1, Math.floor(cssW * dpr));
    height = Math.max(1, Math.floor(cssH * dpr));

    canvas.width = width;
    canvas.height = height;

    context.configure({ device, format: presentationFormat, alphaMode: "premultiplied" });
  }

  function drawFrame(timeSeconds: number) {
    descriptor.writeUniforms(uniformData, timeSeconds, width, height, dpr, mergedParams);
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const encoder = device.createCommandEncoder();
    const view = context.getCurrentTexture().createView();

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        { view, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: "clear", storeOp: "store" },
      ],
    });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3, 1, 0, 0);
    pass.end();

    device.queue.submit([encoder.finish()]);
  }

  const ro = new ResizeObserver(() => configure());
  ro.observe(document.documentElement);

  let rafId: number | null = null;
  let startTime = performance.now();

  const tick = () => {
    if (!pausedByVisibility) {
      drawFrame((performance.now() - startTime) / 1000);
    }
    rafId = requestAnimationFrame(tick);
  };

  function start() {
    if (rafId != null) return;
    startTime = performance.now();
    configure();
    if (shouldAnimate) {
      rafId = requestAnimationFrame(tick);
    } else {
      drawFrame(0);
    }
  }

  function stop() {
    if (rafId == null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  function destroy() {
    stop();
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    uniformBuffer.destroy();
  }

  configure();

  return { start, stop, destroy };
}
