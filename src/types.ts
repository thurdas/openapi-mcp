export interface SchemaObject {
  $ref?: string;
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  enum?: unknown[];
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
}

export interface Parameter {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: SchemaObject;
}

export interface Operation {
  tags?: string[];
  summary?: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: { content?: { "application/json"?: { schema?: SchemaObject } } };
  responses?: Record<string, {
    description?: string;
    content?: { "application/json"?: { schema?: SchemaObject } };
  }>;
}

export interface OpenApiSpec {
  paths?: Record<string, Partial<Record<"get" | "post" | "put" | "patch" | "delete", Operation>>>;
  components?: { schemas?: Record<string, SchemaObject> };
}

export interface Endpoint {
  path: string;
  method: string;
  op: Operation;
}
