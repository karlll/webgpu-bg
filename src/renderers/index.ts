import type { RendererDescriptor } from "../renderer";
import { perlinNoise1 } from "./perlinNoise1";

export const renderers = { perlinNoise1 } as const;

export type RendererName = keyof typeof renderers;

/** Extracts the params type for a given renderer name. */
export type RendererParams<N extends RendererName> =
  (typeof renderers)[N] extends RendererDescriptor<infer P> ? P : never;
