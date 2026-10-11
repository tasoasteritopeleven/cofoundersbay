import {
  canUseAction,
  getActionDeclaration,
  isDeclaredAction,
  type ActionParam,
  type ActionParamType,
} from '@cofounderbay/shared';

/**
 * Server-side enforcement for what a model is allowed to ask for.
 *
 * The catalogue offered to the model and the list checked here are the same
 * `ACTION_DECLARATIONS`, so "what the model was told it can do" and "what the
 * server will pass on" cannot drift apart. A model that invents a tool name,
 * omits a required argument, or sends the wrong type gets its call rejected
 * with a reason rather than forwarded.
 *
 * What this does NOT do, deliberately:
 *
 *   - It does not execute anything. Every executor lives in the web app,
 *     behind a confirmation the user gives, so an accepted call travels back as
 *     a *proposal*. `writes` is carried through precisely so a caller cannot
 *     treat a mutation as though it were a read.
 *   - It is not an authorisation check. Each endpoint keeps its own guards;
 *     this only stops a capability being conjured that was never declared,
 *     and one the caller's role was never offered (a declaration's `roles`
 *     mirrors its endpoint's `@Roles`, so this refuses early what the
 *     endpoint would refuse anyway).
 */

export type AcceptedToolCall = {
  name: string;
  args: Record<string, string | number | boolean>;
  /** True when confirming this call would reach a write endpoint. */
  writes: boolean;
  /** Arguments the model supplied that the declaration does not define. */
  droppedArgs: string[];
};

export type RejectedToolCall = {
  name: string;
  reason: string;
};

export type ToolCallReview = {
  accepted: AcceptedToolCall[];
  rejected: RejectedToolCall[];
};

/** Ollama and OpenAI both nest the call under `function`. */
type RawToolCall = {
  function?: { name?: unknown; arguments?: unknown };
  name?: unknown;
  arguments?: unknown;
};

function readName(raw: RawToolCall): string {
  const candidate = raw?.function?.name ?? raw?.name;
  return typeof candidate === 'string' ? candidate : '';
}

/**
 * Arguments arrive as an object from Ollama and as a JSON *string* from
 * OpenAI-compatible endpoints. A string that does not parse is treated as no
 * arguments at all, which then fails the required-argument check with a
 * specific reason instead of throwing here.
 */
function readArgs(raw: RawToolCall): Record<string, unknown> {
  const candidate = raw?.function?.arguments ?? raw?.arguments;

  if (typeof candidate === 'string') {
    try {
      const parsed = JSON.parse(candidate);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ? (candidate as Record<string, unknown>)
    : {};
}

function matchesType(value: unknown, type: ActionParamType): boolean {
  if (type === 'string') return typeof value === 'string';
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === 'boolean';
}

function validateParam(
  param: ActionParam,
  value: unknown,
): { ok: true; value?: string | number | boolean } | { ok: false; reason: string } {
  if (value === undefined || value === null || value === '') {
    if (param.required) return { ok: false, reason: `missing required argument "${param.name}"` };
    return { ok: true };
  }

  // Strict rather than coercing. A model that sends "3" for a number has
  // misread the schema, and silently coercing it hides that from the logs
  // where the catalogue would need fixing.
  if (!matchesType(value, param.type)) {
    return {
      ok: false,
      reason: `argument "${param.name}" must be ${param.type}, got ${typeof value}`,
    };
  }

  if (param.enumValues && !param.enumValues.includes(value as string)) {
    return {
      ok: false,
      reason: `argument "${param.name}" must be one of ${param.enumValues.join(', ')}`,
    };
  }

  return { ok: true, value: value as string | number | boolean };
}

/** Reviews one call. Exported so a caller can check a single proposal. */
export function reviewToolCall(raw: RawToolCall, role?: string | null): 
  | { ok: true; call: AcceptedToolCall }
  | { ok: false; rejection: RejectedToolCall } {
  const name = readName(raw);

  if (!name) {
    return { ok: false, rejection: { name: '', reason: 'tool call has no name' } };
  }
  if (!isDeclaredAction(name)) {
    return { ok: false, rejection: { name, reason: `"${name}" is not a declared capability` } };
  }

  const declaration = getActionDeclaration(name);
  if (!declaration) {
    // isDeclaredAction is the same source, so this is unreachable; kept because
    // returning a rejection is safer than asserting non-null on a model path.
    return { ok: false, rejection: { name, reason: `"${name}" has no declaration` } };
  }

  // `undefined` means the caller did not say (a check of the shape alone);
  // a known role, or `null` for none, is held to the declaration's `roles`.
  if (role !== undefined && !canUseAction(name, role)) {
    return { ok: false, rejection: { name, reason: `"${name}" is not available to this role` } };
  }

  const supplied = readArgs(raw);
  const args: Record<string, string | number | boolean> = {};

  for (const param of declaration.params) {
    const result = validateParam(param, supplied[param.name]);
    if (!result.ok) return { ok: false, rejection: { name, reason: result.reason } };
    if (result.value !== undefined) args[param.name] = result.value;
  }

  const declared = new Set(declaration.params.map((param) => param.name));
  const droppedArgs = Object.keys(supplied).filter((key) => !declared.has(key));

  return {
    ok: true,
    call: { name, args, writes: declaration.writes, droppedArgs },
  };
}

/**
 * Reviews whatever a provider put in `message.tool_calls`.
 *
 * Accepts a non-array without throwing: this is model output, and a malformed
 * shape should come back as "nothing was accepted" rather than as a 500. The
 * copilot has already been broken once by an AI response that was not the
 * shape the caller assumed (`1a309c6`, "stop a malformed AI-agents response
 * from crashing every page").
 */
export function reviewToolCalls(raw: unknown, role?: string | null): ToolCallReview {
  if (!Array.isArray(raw)) return { accepted: [], rejected: [] };

  const accepted: AcceptedToolCall[] = [];
  const rejected: RejectedToolCall[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      rejected.push({ name: '', reason: 'tool call is not an object' });
      continue;
    }
    const result = reviewToolCall(entry as RawToolCall, role);
    if (result.ok) accepted.push(result.call);
    else rejected.push(result.rejection);
  }

  return { accepted, rejected };
}
