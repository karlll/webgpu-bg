import type { RendererDescriptor } from "../renderer";

export type RotoZoomParams = {
  r: number;
  g: number;
  b: number;
  speed: number;
  scale: number;
  angle: number;
  p2: number;
  p3: number;
  p4: number;
  p5: number;
  p6: number;
  p7: number;
};

export const rotozoom: RendererDescriptor<RotoZoomParams> = {
  id: "rotozoom",

  defaultParams: {
    r: 0.2,
    g: 0.5,
    b: 0.9,
    speed: 1.0,
    scale: 1.0,
    angle: 0.1,
    p2: 0.9,
    p3: 0.148,
    p4: 0.628,
    p5: 2.4,
    p6: 0.7,
    p7: 7.0,
  },


  // Point this at your source image (place it in /public so Vite serves it).
  textureUrl: "/texture.png",

  // multiple of 16, so no padding fields are needed here.
  uniformFloats: 16,

  // 5. Fill buf[] in the exact same order as the WGSL struct below.
  writeUniforms(buf, time, width, height, dpr, p) {
    buf[0] = time;   buf[1] = width; buf[2] = height; buf[3] = dpr;
    buf[4] = p.r;    buf[5] = p.g;   buf[6] = p.b;    buf[7] = p.speed;
    buf[8] = p.scale; buf[9] = p.angle;  buf[10] = p.p2;   buf[11] = p.p3;
    buf[12] = p.p4; buf[13] = p.p5; buf[14] = p.p6; buf[15] = p.p7;
  },

  // UI hints for the pane builder.
  paramsMeta: {
    r:       { label: 'R param',      min: 0, max: 1, step: 0.01 },
    g:       { label: 'G param',      min: 0, max: 1, step: 0.01 },
    b:       { label: 'B param',      min: 0, max: 1, step: 0.01 },
    speed:   { label: 'Speed',        min: 0, max: 1, step: 0.01 },
    scale:   { label: 'Scale',        min: 0, max: 1, step: 0.01 },
    angle:      { label: 'start angle',          min: 0, max: 360, step: 0.01 },
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
  scale  : f32, angle     : f32, p2     : f32, p3     : f32, 
  p4     : f32, p5     : f32, p6     : f32, p7     : f32,
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

  // Formula from article by Nikolaos Papadopoulos, https://www.4rknova.com/blog/2016/11/01/plasma 

  let t = u.time * u.speed;
  const src_height = 256;
  let res = vec2<f32>(u.width, u.height);

    let x = fragCoord.x;
    let y = fragCoord.y;

    let rad = u.angle * (3.14159265 / 180.0) + t;
    let c   = cos(rad);
    let s   = sin(rad);
    let zoom = s + 1.0;          // oscillates 0× → 2× in sync with rotation

    // Same inverse rotation + zoom as the original
    let ru = (x * c - y * s) * zoom;
    let rv = (x * s + y * c) * zoom;

    // Replicate & 0xff  →  wrap to [0, 256)
    let u_px = f32(i32(floor(ru)) & 0xff);

    // Replicate % src_height with correct negative handling
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
