// =============================================================================
// RENDERER TEMPLATE — copy this file and customise to create a new renderer.
//
// Checklist:
//  1. Define a Params type — one key per tunable value (all must be numbers).
//  2. Fill in defaultParams with sensible starting values.
//  3. Set uniformFloats = 4 (standard) + number-of-params, rounded up to a
//     multiple of 4. Add _padN fields to the struct if you need padding.
//  4. Write the WGSL shader. The uniform struct must match the layout written
//     by writeUniforms: first time/width/height/dpr, then your custom fields.
//  5. Implement writeUniforms to fill buf[] in the same order as the struct.
//  6. Add paramsMeta entries so the pane builder can create labelled sliders.
//  7. Register the renderer in src/renderers/index.ts.
// =============================================================================

import type { RendererDescriptor } from "../renderer";

// 1. Params — one key per tunable uniform value.
export type CircleParams = {
  r: number;
  g: number;
  b: number;
  radius: number; // 0..1, fraction of the shorter screen dimension
};

export const circle: RendererDescriptor<CircleParams> = {
  id: "circle",

  // 2. Default values shown on first load.
  defaultParams: {
    r: 1.0,
    g: 1.0,
    b: 1.0,
    radius: 0.4,
  },

  // 3. Total f32 count: 4 standard + 4 params = 8 floats = 32 bytes.
  //    32 is a multiple of 16, so no padding fields are needed here.
  uniformFloats: 8,

  // 5. Fill buf[] in the exact same order as the WGSL struct below.
  writeUniforms(buf, time, width, height, dpr, p) {
    buf[0] = time;   buf[1] = width; buf[2] = height; buf[3] = dpr;
    buf[4] = p.r;    buf[5] = p.g;   buf[6] = p.b;    buf[7] = p.radius;
  },

  // 6. UI hints for the pane builder.
  paramsMeta: {
    r:      { label: 'R',      min: 0, max: 1, step: 0.01 },
    g:      { label: 'G',      min: 0, max: 1, step: 0.01 },
    b:      { label: 'B',      min: 0, max: 1, step: 0.01 },
    radius: { label: 'Radius', min: 0, max: 1, step: 0.01 },
  },

  // 4. WGSL shader. Struct members must match writeUniforms order exactly.
  wgsl: /* wgsl */ `
struct Uniforms {
  time   : f32, width  : f32, height : f32, dpr    : f32,
  r      : f32, g      : f32, b      : f32, radius : f32,
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
  let res    = vec2<f32>(u.width, u.height);
  let center = res * 0.5;
  let dist   = length(fragCoord.xy - center);

  // Radius in pixels: u.radius is 0..1, scaled to half the shorter dimension.
  let r_px = u.radius * min(u.width, u.height) * 0.5;

  // Smooth 1.5-pixel edge for anti-aliasing.
  let inside = 1.0 - smoothstep(r_px - 1.5, r_px + 1.5, dist);

  let col = vec3<f32>(u.r, u.g, u.b) * inside;
  return vec4<f32>(col, 1.0);
}
`,
};
