import type { RendererDescriptor } from "../renderer";

export type PlasmaParams = {
  r: number;
  g: number;
  b: number;
  speed: number;
  scale: number;
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  p5: number;
  p6: number;
  p7: number;
};

export const plasma: RendererDescriptor<PlasmaParams> = {
  id: "plasma",

  defaultParams: {
    r: 0.2,
    g: 0.5,
    b: 0.9,
    speed: 1.0,
    scale: 1.0,
    p1: 0.1,
    p2: 0.9,
    p3: 0.148,
    p4: 0.628,
    p5: 2.4,
    p6: 0.7,
    p7: 7.0,
  },


  // multiple of 16, so no padding fields are needed here.
  uniformFloats: 16,

  // 5. Fill buf[] in the exact same order as the WGSL struct below.
  writeUniforms(buf, time, width, height, dpr, p) {
    buf[0] = time;   buf[1] = width; buf[2] = height; buf[3] = dpr;
    buf[4] = p.r;    buf[5] = p.g;   buf[6] = p.b;    buf[7] = p.speed;
    buf[8] = p.scale; buf[9] = p.p1;  buf[10] = p.p2;   buf[11] = p.p3;
    buf[12] = p.p4; buf[13] = p.p5; buf[14] = p.p6; buf[15] = p.p7;
  },

  // UI hints for the pane builder.
  paramsMeta: {
    r:       { label: 'R param',      min: 0, max: 1, step: 0.01 },
    g:       { label: 'G param',      min: 0, max: 1, step: 0.01 },
    b:       { label: 'B param',      min: 0, max: 1, step: 0.01 },
    speed:   { label: 'Speed',        min: 0, max: 1, step: 0.01 },
    scale:   { label: 'Scale',        min: 0, max: 1, step: 0.01 },
    p1:      { label: 'P1',          min: 0, max: 1, step: 0.01 },
    p2:      { label: 'P2',      min: 0, max: 1, step: 0.01 },
    p3:      { label: 'P3',      min: 0, max: 1, step: 0.001 },
    p4:      { label: 'P4',      min: 0, max: 1, step: 0.001 },
    p5:      { label: 'P5',      min: 0, max: 50, step: 0.1 },
    p6:      { label: 'P6',      min: 0, max: 50, step: 0.1 },
    p7:      { label: 'P7',      min: 0, max: 50, step: 0.1 },

  },


  wgsl: /* wgsl */ `
struct Uniforms {
  time   : f32, width  : f32, height : f32, dpr    : f32,
  r      : f32, g      : f32, b      : f32, speed  : f32,
  scale  : f32, p1     : f32, p2     : f32, p3     : f32, 
  p4     : f32, p5     : f32, p6     : f32, p7     : f32,
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

@fragment
fn fs_main(@builtin(position) fragCoord : vec4<f32>) -> @location(0) vec4<f32> {

  // Formula from article by Nikolaos Papadopoulos, https://www.4rknova.com/blog/2016/11/01/plasma 

  let t = u.time * u.speed;
  let res = vec2<f32>(u.width, u.height);
  let aspect_ratio = vec2<f32>(res.x / res.y, 1.0);
  let uv  = u.scale * fragCoord.xy / res * aspect_ratio * 4.0 + t * 0.3;
  let radial_dist = length(uv);

  let v_phase = u.p1 + cos(uv.y + sin(u.p3 - t)) + u.p5 * t;  
  let h_phase = u.p2 + sin(uv.x + cos(u.p4 + t)) - u.p6 * t;
  let plasma = u.p7 * cos(radial_dist + h_phase) * sin(v_phase + h_phase);
  
  return vec4<f32>(0.5 + 0.5 * cos(plasma + vec3(u.r, u.g, u.b)), 1.0);
  
}
`,
};
