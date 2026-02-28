/**
 * Describes a self-contained background renderer.
 *
 * P — a flat Record<string, number> of all tunable parameters.
 *     All values end up as f32 uniforms, so colors are split into
 *     individual components (e.g. colAr, colAg, colAb).
 *
 * Uniform buffer layout (enforced by the engine):
 *   [0] time   [1] width   [2] height   [3] dpr   [4..] custom params
 *
 * The WGSL struct at @group(0) @binding(0) must declare these in the same
 * order. `uniformFloats` must be a multiple of 4 (pad with dummy fields if
 * needed so the struct size stays a multiple of 16 bytes).
 */
export type RendererDescriptor<P extends Record<string, number>> = {
  /** Unique identifier used to look up the renderer in the registry. */
  id: string;

  /** Default values for every renderer-specific parameter. */
  defaultParams: P;

  /** WGSL shader source. Must declare a uniform struct at group(0) binding(0)
   *  whose first 4 floats are time, width, height, dpr, followed by the
   *  custom params in the order they are written by `writeUniforms`. */
  wgsl: string;

  /** Total f32 count for the uniform buffer (must be a multiple of 4).
   *  Includes the 4 standard fields plus all custom params plus any padding. */
  uniformFloats: number;

  /** Called every frame. Fill `buf[0..uniformFloats)` with the data that
   *  matches the WGSL struct layout. `buf` is pre-allocated by the engine
   *  and reused across frames. */
  writeUniforms(
    buf: Float32Array,
    time: number,
    width: number,
    height: number,
    dpr: number,
    params: P,
  ): void;
};
