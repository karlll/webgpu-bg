import { Pane } from "tweakpane";
import type { ParamMeta } from "./renderer";

/**
 * Builds a Tweakpane panel bound to a live params object.
 *
 * The params object is mutated in place by the controls; since the render
 * loop reads params every frame, changes are reflected immediately with no
 * additional wiring.
 *
 * @param params  The live params object exposed by the Controller.
 * @param meta    Optional per-key UI hints from the renderer descriptor.
 * @param title   Panel title (defaults to "Parameters").
 */
export function buildPane<P extends Record<string, number>>(
  params: P,
  meta?: Partial<Record<keyof P, ParamMeta>>,
  title = "Parameters"
): Pane {
  const pane = new Pane({ title });

  for (const key of Object.keys(params) as (keyof P & string)[]) {
    const m = meta?.[key];
    if (m?.hidden) continue;

    const opts: Record<string, unknown> = {};
    if (m?.label !== undefined) opts.label = m.label;
    if (m?.min   !== undefined) opts.min   = m.min;
    if (m?.max   !== undefined) opts.max   = m.max;
    if (m?.step  !== undefined) opts.step  = m.step;

    pane.addBinding(params, key, opts);
  }

  return pane;
}
