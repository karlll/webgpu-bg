type Controller = {
  start(): void;
  stop(): void;
  destroy(): void;
};

type Options = {
  powerPreference?: WebGPUPowerPreference; // "low-power" | "high-performance"
  respectReducedMotion?: boolean;
  maxDpr?: number; // clamp DPR to avoid huge render targets (defaults to 3)
};

export async function createWebGPUProceduralBackground(
  canvas: HTMLCanvasElement,
  opts: Options = {}
): Promise<Controller> {
  if (!("gpu" in navigator)) {
    throw new Error("WebGPU not supported in this browser (navigator.gpu missing).");
  }

  const powerPreference = opts.powerPreference ?? "low-power";
  const respectReducedMotion = opts.respectReducedMotion ?? true;
  const maxDpr = opts.maxDpr ?? 3;

  const prefersReducedMotion =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  const shouldAnimate = !respectReducedMotion || !prefersReducedMotion;

  // Pause when hidden to save power.
  let pausedByVisibility = document.hidden;
  const onVisibility = () => {
    pausedByVisibility = document.hidden;
  };
  document.addEventListener("visibilitychange", onVisibility, { passive: true });

  // --- WebGPU init ---
  const adapter = await navigator.gpu.requestAdapter({ powerPreference });
  if (!adapter) throw new Error("No WebGPU adapter available.");

  const device = await adapter.requestDevice();

  const context = canvas.getContext("webgpu") as GPUCanvasContext | null;
  if (!context) throw new Error("Could not get WebGPU canvas context.");

  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  // Uniforms: time, width, height, dpr (4 floats)
  const uniformBuffer = device.createBuffer({
    size: 4 * 4,
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

  const shaderModule = device.createShaderModule({ code: wgslFullscreenProcedural });

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

    context.configure({
      device,
      format: presentationFormat,
      alphaMode: "premultiplied",
    });
  }

  function drawFrame(timeSeconds: number) {
    // Update uniforms
    device.queue.writeBuffer(
      uniformBuffer,
      0,
      new Float32Array([timeSeconds, width, height, dpr])
    );

    const encoder = device.createCommandEncoder();
    const view = context.getCurrentTexture().createView();

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    // Fullscreen triangle (no vertex buffers)
    pass.draw(3, 1, 0, 0);
    pass.end();

    device.queue.submit([encoder.finish()]);
  }

  // Resize handling
  const resize = () => configure();
  const ro = new ResizeObserver(resize);
  ro.observe(document.documentElement);

  // Animation loop
  let rafId: number | null = null;
  let startTime = performance.now();

  const tick = () => {
    if (pausedByVisibility) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    const t = (performance.now() - startTime) / 1000;
    drawFrame(t);
    rafId = requestAnimationFrame(tick);
  };

  function start() {
    if (rafId != null) return;
    startTime = performance.now();
    configure();
    if (shouldAnimate) {
      rafId = requestAnimationFrame(tick);
    } else {
      // Reduced-motion: render a single frame
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
    // Other resources will be GC’d; explicitly destroy dynamic textures/buffers if you add them.
  }

  // Initial config (so first draw works even before start in some setups)
  configure();

  return { start, stop, destroy };
}

const wgslFullscreenProcedural = /* wgsl */ `
struct Uniforms {
  time : f32,
  width : f32,
  height : f32,
  dpr : f32,
};

@group(0) @binding(0) var<uniform> u : Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) vid : u32) -> @builtin(position) vec4<f32> {
  // Fullscreen triangle:
  // (-1,-1), (3,-1), (-1,3)
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0)
  );
  return vec4<f32>(pos[vid], 0.0, 1.0);
}

fn hash(p: vec2<f32>) -> f32 {
  let h = dot(p, vec2<f32>(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

fn noise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let a = hash(i);
  let b = hash(i + vec2<f32>(1.0, 0.0));
  let c = hash(i + vec2<f32>(0.0, 1.0));
  let d = hash(i + vec2<f32>(1.0, 1.0));
  let u2 = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u2.x) + (c - a) * u2.y * (1.0 - u2.x) + (d - b) * u2.x * u2.y;
}

fn fbm(p: vec2<f32>) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var x = p;
  for (var i = 0; i < 5; i = i + 1) {
    v += a * noise(x);
    x = x * 2.02;
    a *= 0.5;
  }
  return v;
}

@fragment
fn fs_main(@builtin(position) fragCoord : vec4<f32>) -> @location(0) vec4<f32> {
  let res = vec2<f32>(u.width, u.height);
  let uv = fragCoord.xy / res; // 0..1
  let p = (uv - 0.5) * vec2<f32>(res.x / res.y, 1.0);

  let t = u.time * 0.15;

  // Two layers for richer structure
  let n = fbm(p * 3.0 + vec2<f32>( t, -t));
  let m = fbm(p * 6.0 + vec2<f32>(-t * 0.7, t * 0.9));

  let base = vec3<f32>(0.06, 0.08, 0.12);
  let colA = vec3<f32>(0.10, 0.35, 0.85);
  let colB = vec3<f32>(0.85, 0.25, 0.55);

  let band = smoothstep(0.25, 0.75, n);
  var col = base + mix(colA, colB, band) * 0.55;

  // Contrast / lighting
  col += (m - 0.5) * 0.15;

  // Vignette
  let r = length(p);
  col *= smoothstep(1.2, 0.2, r);

  // Grain: stable per pixel
  let g = hash(floor(fragCoord.xy)) - 0.5;
  col += g * 0.02;

  return vec4<f32>(col, 1.0);
}
`;
