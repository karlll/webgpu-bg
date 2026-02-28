import type { RendererDescriptor } from "../renderer";

export type PerlinNoise1Params = {
  // Base (dark) background colour
  baseR: number; baseG: number; baseB: number;
  // Primary colour (blue end)
  colAr: number; colAg: number; colAb: number;
  // Secondary colour (pink end)
  colBr: number; colBg: number; colBb: number;
  // Animation speed multiplier
  speed: number;
  // padding to reach a multiple of 4 floats (4 standard + 10 params + 2 pad = 16)
  _pad0: number; _pad1: number;
};

export const perlinNoise1: RendererDescriptor<PerlinNoise1Params> = {
  id: "perlinNoise1",

  defaultParams: {
    baseR: 0.06, baseG: 0.08, baseB: 0.12,
    colAr: 0.10, colAg: 0.35, colAb: 0.85,
    colBr: 0.85, colBg: 0.25, colBb: 0.55,
    speed: 0.15,
    _pad0: 0, _pad1: 0,
  },

  // 4 standard + 10 params + 2 padding = 16 floats = 64 bytes
  uniformFloats: 16,

  writeUniforms(buf, time, width, height, dpr, p) {
    buf[0] = time;   buf[1] = width; buf[2] = height; buf[3] = dpr;
    buf[4] = p.baseR; buf[5] = p.baseG; buf[6] = p.baseB;
    buf[7] = p.colAr; buf[8] = p.colAg; buf[9] = p.colAb;
    buf[10] = p.colBr; buf[11] = p.colBg; buf[12] = p.colBb;
    buf[13] = p.speed;
    // buf[14], buf[15] — padding, remain 0
  },

  wgsl: /* wgsl */ `
struct Uniforms {
  time  : f32, width : f32, height : f32, dpr   : f32,
  baseR : f32, baseG : f32, baseB  : f32,
  colAr : f32, colAg : f32, colAb  : f32,
  colBr : f32, colBg : f32, colBb  : f32,
  speed : f32, _pad0 : f32, _pad1  : f32,
}

@group(0) @binding(0) var<uniform> u : Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) vid : u32) -> @builtin(position) vec4<f32> {
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
  let uv  = fragCoord.xy / res;
  let p   = (uv - 0.5) * vec2<f32>(res.x / res.y, 1.0);

  let t = u.time * u.speed;

  let n = fbm(p * 3.0 + vec2<f32>( t, -t));
  let m = fbm(p * 6.0 + vec2<f32>(-t * 0.7, t * 0.9));

  let base = vec3<f32>(u.baseR, u.baseG, u.baseB);
  let colA = vec3<f32>(u.colAr, u.colAg, u.colAb);
  let colB = vec3<f32>(u.colBr, u.colBg, u.colBb);

  let band = smoothstep(0.25, 0.75, n);
  var col  = base + mix(colA, colB, band) * 0.55;

  col += (m - 0.5) * 0.15;

  let r = length(p);
  col *= smoothstep(1.2, 0.2, r);

  let g = hash(floor(fragCoord.xy)) - 0.5;
  col += g * 0.02;

  return vec4<f32>(col, 1.0);
}
`,
};
