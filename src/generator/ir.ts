/**
 * IR — the normalized intermediate representation the code generators consume.
 *
 * An OpenAPI document is parsed/dereferenced into this small, explicit shape so each emitter
 * (zod schemas, routes, openapi doc) reads a stable structure instead of raw OpenAPI sprawl.
 * Keeping the IR minimal is deliberate (Simplicity-First): only what the acceptance path needs.
 */

/** A property on an object schema. */
export interface IRProperty {
  readonly name: string;
  readonly schema: IRSchema;
  readonly required: boolean;
  /** A default ONLY survives on create-shaped schemas; PATCH schemas drop defaults (O-04/P-04). */
  readonly hasDefault: boolean;
  readonly defaultValue?: unknown;
}

/** A normalized JSON-schema-ish node. `kind` drives the Zod emitter. */
export interface IRSchema {
  readonly kind:
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "enum"
    | "array"
    | "object"
    | "unknown";
  readonly enumValues?: readonly string[];
  readonly items?: IRSchema;
  readonly properties?: readonly IRProperty[];
  readonly minLength?: number;
  /** Set when this object came from a named component (used to name the Zod export). */
  readonly refName?: string;
}

/** A path parameter (always string-typed in the fixture surface turbo generates). */
export interface IRPathParam {
  readonly name: string;
}

/** One operation = one route handler. */
export interface IROperation {
  readonly operationId: string;
  readonly method: "get" | "post" | "patch" | "put" | "delete";
  /** Express-free Hono path: `/pets/{petId}` → `/pets/:petId`. */
  readonly honoPath: string;
  readonly rawPath: string;
  readonly summary: string;
  readonly pathParams: readonly IRPathParam[];
  /** The request body schema, if any (POST/PATCH). */
  readonly requestSchema?: IRSchema;
  /** Whether this op is a PATCH/partial update — drives the no-default schema rule (P-04). */
  readonly isPartialUpdate: boolean;
  /** The 2xx response schema. */
  readonly responseSchema?: IRSchema;
  readonly responseStatus: number;
}

/** A named component schema, emitted once as a top-level Zod export. */
export interface IRNamedSchema {
  readonly name: string;
  readonly schema: IRSchema;
}

/** The whole service IR. */
export interface ServiceIR {
  readonly title: string;
  readonly version: string;
  readonly namedSchemas: readonly IRNamedSchema[];
  readonly operations: readonly IROperation[];
}
