import { z } from "zod";

// Minimal Zod -> JSON Schema converter sufficient for our schemas.
// Swap to the `zod-to-json-schema` package if the schema gets richer.

type JsonSchema = Record<string, unknown>;

export function zodToJsonSchema(schema: z.ZodTypeAny, _name: string): JsonSchema {
  return convert(schema);
}

function convert(schema: z.ZodTypeAny): JsonSchema {
  const def = schema._def;
  const description = (schema as unknown as { description?: string }).description;

  const wrap = (out: JsonSchema): JsonSchema => {
    if (description) out.description = description;
    return out;
  };

  if (schema instanceof z.ZodString) return wrap({ type: "string" });
  if (schema instanceof z.ZodNumber) {
    const out: JsonSchema = { type: "number" };
    for (const check of (def as { checks?: { kind: string; value?: number }[] }).checks ?? []) {
      if (check.kind === "int") out.type = "integer";
      if (check.kind === "min" && typeof check.value === "number") out.minimum = check.value;
      if (check.kind === "max" && typeof check.value === "number") out.maximum = check.value;
    }
    return wrap(out);
  }
  if (schema instanceof z.ZodBoolean) return wrap({ type: "boolean" });
  if (schema instanceof z.ZodEnum) {
    return wrap({ type: "string", enum: [...(def as { values: string[] }).values] });
  }
  if (schema instanceof z.ZodArray) {
    const inner = (def as { type: z.ZodTypeAny }).type;
    const out: JsonSchema = { type: "array", items: convert(inner) };
    const minLength = (def as { minLength?: { value: number } }).minLength?.value;
    const maxLength = (def as { maxLength?: { value: number } }).maxLength?.value;
    if (typeof minLength === "number") out.minItems = minLength;
    if (typeof maxLength === "number") out.maxItems = maxLength;
    return wrap(out);
  }
  if (schema instanceof z.ZodObject) {
    const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      const child = value as z.ZodTypeAny;
      properties[key] = convert(child);
      if (!(child instanceof z.ZodOptional) && !(child instanceof z.ZodDefault)) {
        required.push(key);
      }
    }
    return wrap({
      type: "object",
      properties,
      required,
      additionalProperties: false,
    });
  }
  if (schema instanceof z.ZodOptional) return convert((def as { innerType: z.ZodTypeAny }).innerType);
  if (schema instanceof z.ZodNullable) {
    const inner = convert((def as { innerType: z.ZodTypeAny }).innerType);
    const types = Array.isArray(inner.type) ? inner.type : [inner.type];
    return wrap({ ...inner, type: [...types, "null"] });
  }
  if (schema instanceof z.ZodDefault) return convert((def as { innerType: z.ZodTypeAny }).innerType);

  return wrap({});
}
