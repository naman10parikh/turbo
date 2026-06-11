/**
 * emit-zod — turn IR schemas into Zod 4 source strings.
 *
 * THE load-bearing rule (O-04 / P-04 / S-02): a PATCH/partial-update body gets a DEDICATED schema
 * with NO `.default()`s. Zod 4 `.default()` fires on `undefined` even under `.partial()`, so reusing
 * a defaulted create-schema for PATCH silently overwrites omitted fields. The `dropDefaults` flag
 * below is how the generator guarantees the create-schema and the patch-schema are distinct objects.
 */
import type { IRProperty, IRSchema } from "./ir.js";

/** Emit a Zod expression for a single (non-object) schema node. */
function emitLeaf(s: IRSchema): string {
  switch (s.kind) {
    case "string":
      return s.minLength !== undefined ? `z.string().min(${s.minLength})` : "z.string()";
    case "number":
      return "z.number()";
    case "integer":
      return "z.number().int()";
    case "boolean":
      return "z.boolean()";
    case "enum": {
      const vals = (s.enumValues ?? []).map((v) => JSON.stringify(v)).join(", ");
      return `z.enum([${vals}])`;
    }
    case "array":
      return `z.array(${emitSchema(s.items ?? { kind: "unknown" }, false)})`;
    case "object":
      return emitObject(s, false);
    case "unknown":
    default:
      return "z.unknown()";
  }
}

/** Emit one property line. `dropDefaults` removes `.default()` (the PATCH rule). */
function emitProperty(p: IRProperty, dropDefaults: boolean): string {
  let expr = emitSchema(p.schema, dropDefaults);
  if (!dropDefaults && p.hasDefault) {
    expr += `.default(${JSON.stringify(p.defaultValue)})`;
  }
  // Required fields with a default are still "present" at runtime; optional-no-default → .optional().
  if (!p.required && !(p.hasDefault && !dropDefaults)) {
    expr += ".optional()";
  }
  return `  ${JSON.stringify(p.name)}: ${expr},`;
}

function emitObject(s: IRSchema, dropDefaults: boolean): string {
  const props = s.properties ?? [];
  if (props.length === 0) return "z.object({})";
  const lines = props.map((p) => emitProperty(p, dropDefaults)).join("\n");
  return `z.object({\n${lines}\n})`;
}

/** Emit a Zod expression for any schema node. `dropDefaults` cascades into objects. */
export function emitSchema(s: IRSchema, dropDefaults: boolean): string {
  if (s.kind === "object") return emitObject(s, dropDefaults);
  return emitLeaf(s);
}

/**
 * Emit a named, exported Zod schema. For a partial-update (PATCH) shape, defaults are dropped
 * AND `.partial()` is applied to a no-default base — the dedicated PATCH schema (P-04 guard).
 */
export function emitNamedSchema(
  exportName: string,
  schema: IRSchema,
  opts: { partial: boolean },
): string {
  if (opts.partial) {
    // Dedicated PATCH schema: build the base WITHOUT defaults, then `.partial()` it.
    const base = emitSchema(schema, /* dropDefaults */ true);
    return `export const ${exportName} = ${base}.partial();`;
  }
  return `export const ${exportName} = ${emitSchema(schema, /* dropDefaults */ false)};`;
}
