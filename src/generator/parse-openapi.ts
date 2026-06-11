/**
 * parse-openapi — dereference an OpenAPI document and normalize it into the ServiceIR.
 *
 * Uses `@apidevtools/swagger-parser` to validate + resolve `$ref`s (the one boundary where an
 * external library can throw → wrapped into a Result). Then walks paths/operations into the IR.
 */
import SwaggerParser from "@apidevtools/swagger-parser";
import { err, ok, type Result } from "../core/result.js";
import type {
  IRNamedSchema,
  IROperation,
  IRPathParam,
  IRProperty,
  IRSchema,
  ServiceIR,
} from "./ir.js";

/** Minimal structural view of the OpenAPI subset turbo generates from. */
interface OASchema {
  type?: string;
  enum?: string[];
  items?: OASchema;
  properties?: Record<string, OASchema>;
  required?: string[];
  default?: unknown;
  minLength?: number;
  title?: string;
}
interface OAMediaType {
  schema?: OASchema;
}
interface OABody {
  required?: boolean;
  content?: Record<string, OAMediaType>;
}
interface OAParam {
  name: string;
  in: string;
  required?: boolean;
}
interface OAResponse {
  content?: Record<string, OAMediaType>;
}
interface OAOperation {
  operationId?: string;
  summary?: string;
  parameters?: OAParam[];
  requestBody?: OABody;
  responses?: Record<string, OAResponse>;
}
interface OADoc {
  info?: { title?: string; version?: string };
  paths?: Record<string, Record<string, OAOperation>>;
  components?: { schemas?: Record<string, OASchema> };
}

const METHODS = ["get", "post", "patch", "put", "delete"] as const;
type Method = (typeof METHODS)[number];

function jsonMedia(content: Record<string, OAMediaType> | undefined): OASchema | undefined {
  if (!content) return undefined;
  return content["application/json"]?.schema ?? Object.values(content)[0]?.schema;
}

function normalizeSchema(s: OASchema | undefined): IRSchema {
  if (!s) return { kind: "unknown" };
  if (s.enum && s.enum.length > 0) {
    return { kind: "enum", enumValues: s.enum.map(String) };
  }
  switch (s.type) {
    case "string":
      return s.minLength !== undefined
        ? { kind: "string", minLength: s.minLength }
        : { kind: "string" };
    case "number":
      return { kind: "number" };
    case "integer":
      return { kind: "integer" };
    case "boolean":
      return { kind: "boolean" };
    case "array":
      return { kind: "array", items: normalizeSchema(s.items) };
    case "object":
    default: {
      if (s.properties) {
        const requiredSet = new Set(s.required ?? []);
        const properties: IRProperty[] = Object.entries(s.properties).map(([name, propSchema]) => ({
          name,
          schema: normalizeSchema(propSchema),
          required: requiredSet.has(name),
          hasDefault: propSchema.default !== undefined,
          ...(propSchema.default !== undefined ? { defaultValue: propSchema.default } : {}),
        }));
        return { kind: "object", properties };
      }
      return { kind: "unknown" };
    }
  }
}

function honoPathOf(rawPath: string): string {
  // OpenAPI `/pets/{petId}` → Hono `/pets/:petId` (Web-standard routing, no path-to-regexp — S-03).
  return rawPath.replace(/\{([^}]+)\}/g, ":$1");
}

function isPartial(method: Method, operationId: string): boolean {
  return method === "patch" || /(^|[_-])(patch|update)/i.test(operationId);
}

/**
 * Parse + dereference an OpenAPI doc (file path or object) into the ServiceIR.
 * The dereference call is the one place an external library may throw — wrapped at this boundary.
 */
export async function parseOpenApi(specPathOrObject: string | object): Promise<Result<ServiceIR, string>> {
  let doc: OADoc;
  try {
    // SwaggerParser.dereference validates AND resolves $refs, returning a fully-inlined doc.
    doc = (await SwaggerParser.dereference(specPathOrObject as never)) as unknown as OADoc;
  } catch (e) {
    return err(`OpenAPI parse/validate failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  const title = doc.info?.title ?? "service";
  const version = doc.info?.version ?? "1.0.0";

  const namedSchemas: IRNamedSchema[] = Object.entries(doc.components?.schemas ?? {}).map(
    ([name, schema]) => ({ name, schema: { ...normalizeSchema(schema), refName: name } }),
  );

  const operations: IROperation[] = [];
  for (const [rawPath, pathItem] of Object.entries(doc.paths ?? {})) {
    for (const method of METHODS) {
      const op = pathItem[method];
      if (!op) continue;
      const operationId = op.operationId ?? `${method}_${rawPath.replace(/[^a-zA-Z0-9]+/g, "_")}`;
      const pathParams: IRPathParam[] = (op.parameters ?? [])
        .filter((p) => p.in === "path")
        .map((p) => ({ name: p.name }));
      const requestSchemaRaw = jsonMedia(op.requestBody?.content);
      const successEntry = Object.entries(op.responses ?? {}).find(
        ([code]) => code.startsWith("2"),
      );
      const responseStatus = successEntry ? Number.parseInt(successEntry[0], 10) : 200;
      const responseSchemaRaw = jsonMedia(successEntry?.[1]?.content);

      operations.push({
        operationId,
        method,
        honoPath: honoPathOf(rawPath),
        rawPath,
        summary: op.summary ?? operationId,
        pathParams,
        ...(requestSchemaRaw ? { requestSchema: normalizeSchema(requestSchemaRaw) } : {}),
        isPartialUpdate: isPartial(method, operationId),
        ...(responseSchemaRaw ? { responseSchema: normalizeSchema(responseSchemaRaw) } : {}),
        responseStatus,
      });
    }
  }

  if (operations.length === 0) {
    return err("OpenAPI doc has no operations under .paths");
  }

  return ok({ title, version, namedSchemas, operations });
}
