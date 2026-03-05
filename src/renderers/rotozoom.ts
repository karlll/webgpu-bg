import type { RendererDescriptor } from "../renderer";

export type RotoZoomParams = {
  speed: number;
  scale: number;
  angle: number;
  swirl: number;
  wave: number;
  wave_f: number;
  pulse: number;
  pulse_f: number;
};

export const rotozoom: RendererDescriptor<RotoZoomParams> = {
  id: "rotozoom",

  defaultParams: {
    speed: 1.0,
    scale: 1.0,
    angle: 0.1,
    swirl: 0.01,
    wave: 0.0,
    wave_f: 0.02,
    pulse: 0.0,
    pulse_f: 5.0,
  },


  // Point this at your source image (place it in /public so Vite serves it).
  textureUrl: "/texture.png",

  uniformFloats: 12,

  // 5. Fill buf[] in the exact same order as the WGSL struct below.
  writeUniforms(buf, time, width, height, dpr, p) {
    buf[0] = time;   buf[1] = width; buf[2] = height; buf[3] = dpr;
     buf[4] = p.speed;
    buf[5] = p.scale; buf[6] = p.angle;  buf[7] = p.swirl; buf[8] = p.wave;
    buf[9] = p.wave_f; buf[10] = p.pulse; buf[11] = p.pulse_f;
  },

  // UI hints for the pane builder.
  paramsMeta: {
    speed:   { label: 'Speed',        min: 0, max: 1, step: 0.01 },
    scale:   { label: 'Scale',        min: 0, max: 10, step: 0.01 },
    angle:   { label: 'Start angle', min: 0, max: 360, step: 0.1 },
    swirl:   { label: 'Swirl',      min: -6,    max: 6,    step: 0.01 },
    wave:    { label: 'Wave amp',   min: 0,     max: 200,  step: 1 },
    wave_f:  { label: 'Wave freq',  min: 0,     max: 0.1,  step: 0.001 },
    pulse:   { label: 'Pulse amp',  min: 0,     max: 3,    step: 0.01 },
    pulse_f: { label: 'Pulse freq', min: 0,     max: 20,   step: 0.1 },
  },


  wgsl: /* wgsl */ `
struct Uniforms {
  time   : f32, width  : f32, height : f32, dpr    : f32,
  speed  : f32, scale  : f32, angle  : f32, swirl  : f32,
  wave   : f32, wave_f : f32, pulse  : f32, pulse_f: f32
}

@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var          src_texture: texture_2d<f32>;
@group(0) @binding(2) var          src_sampler: sampler;



@vertex
fn vs_main(@builtin(vertex_index) vid : u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0)
  );
  return vec4<f32>(pos[vid], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) fragCoord : vec4<f32>) -> @location(0) vec4<f32> {

  let t = u.time * u.speed;
  const src_height = 256;
  let res = vec2<f32>(u.width, u.height);

    let x = fragCoord.x;
    let y = fragCoord.y;

    let cx  = u.width  * 0.5;
    let cy  = u.height * 0.5;
    let dx  = x - cx;
    let dy  = y - cy;

    // wave pre-warp: sinusoidal displacement before rotation (wave=0 → no effect)
    let wdx = dx + u.wave * sin(dy * u.wave_f + t);
    let wdy = dy + u.wave * sin(dx * u.wave_f + t * 1.3);

    let dist = sqrt(wdx * wdx + wdy * wdy);
    let dist_norm = dist / (max(u.width, u.height) * 0.5);

    // per-pixel angle offset grows with distance from centre → swirl
    let rad = u.angle * (3.14159265 / 180.0) + t + dist_norm * u.swirl;
    let c   = cos(rad);
    let s   = sin(rad);
    // distance-modulated zoom pulse (pulse=0 → no effect)
    let zoom = s + u.scale + u.pulse * sin(dist_norm * u.pulse_f - t);

    // inverse rotation + zoom (relative to centre)
    let ru = (wdx * c - wdy * s) * zoom;
    let rv = (wdx * s + wdy * c) * zoom;

    // wrap to [0, 256)
    let u_px = f32(i32(floor(ru)) & 0xff);

    let v_raw    = i32(floor(rv)) % i32(src_height);
    let v_px     = f32(select(v_raw, v_raw + i32(src_height), v_raw < 0));

    // Normalize to [0, 1] UV space (+ 0.5 to sample pixel centres)
    let uv = vec2f(
        (u_px + 0.5) / 256.0,
        (v_px + 0.5) / src_height,
    );

    let color = textureSample(src_texture, src_sampler, uv);
    return vec4f(color.rgb * color.a, color.a); // premultiply for alphaMode:"premultiplied" canvas
}
`,
};
