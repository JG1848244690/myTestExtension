/**
 * 极简 schema 校验器
 *
 * 设计动机：
 * - zod 引入 ~50KB 依赖，MV3 CSP 下要谨慎
 * - 当前数据形状稳定，手写校验性价比更高
 * - API 与 zod 一致（safeParse / parse），后续可平滑切换
 */

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface Validator<T> {
  safeParse: (input: unknown) => ValidationResult<T>;
  parse: (input: unknown) => T;
}

function makeValidator<T>(check: (input: unknown) => ValidationResult<T>): Validator<T> {
  return {
    safeParse: check,
    parse(input) {
      const r = check(input);
      if (!r.ok) throw new Error(r.error);
      return r.value;
    },
  };
}

/**
 * 对象字面量：保留字面量类型
 * 用法：object({ a: 'literal string' as const, b: 1 as const })
 */
export function object<S extends Record<string, Validator<any>>>(
  shape: S
): Validator<{ [K in keyof S]: S[K] extends Validator<infer R> ? R : never }> {
  return makeValidator((x) => {
    if (x === null || typeof x !== 'object') return { ok: false, error: 'expected object' };
    const obj = x as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key in shape) {
      const r = shape[key].safeParse(obj[key]);
      if (!r.ok) return { ok: false, error: key + ': ' + r.error };
      out[key] = r.value;
    }
    return { ok: true, value: out as never };
  });
}

export const v = {
  string: (): Validator<string> =>
    makeValidator((x) =>
      typeof x === 'string' ? { ok: true, value: x } : { ok: false, error: 'expected string' }
    ),

  number: (): Validator<number> =>
    makeValidator((x) =>
      typeof x === 'number' && Number.isFinite(x)
        ? { ok: true, value: x }
        : { ok: false, error: 'expected finite number' }
    ),

  boolean: (): Validator<boolean> =>
    makeValidator((x) =>
      typeof x === 'boolean' ? { ok: true, value: x } : { ok: false, error: 'expected boolean' }
    ),

  optional: <T>(inner: Validator<T>): Validator<T | undefined> =>
    makeValidator<T | undefined>((x) => {
      if (x === undefined || x === null) return { ok: true, value: undefined };
      return inner.safeParse(x);
    }),

  oneOf: <L extends string>(literals: readonly L[]): Validator<L> =>
    makeValidator<L>((x) =>
      literals.includes(x as L) ? { ok: true, value: x as L } : { ok: false, error: 'expected one of ' + literals.join('|') }
    ),

  array: <T>(inner: Validator<T>): Validator<T[]> =>
    makeValidator<T[]>((x) => {
      if (!Array.isArray(x)) return { ok: false, error: 'expected array' };
      const out: T[] = [];
      for (let i = 0; i < x.length; i++) {
        const r = inner.safeParse(x[i]);
        if (!r.ok) return { ok: false, error: 'array[' + i + ']: ' + r.error };
        out.push(r.value);
      }
      return { ok: true, value: out };
    }),

  object: object,
};

export function safeRead<T>(validator: Validator<T>, raw: unknown, fallback: T): T {
  const r = validator.safeParse(raw);
  if (!r.ok) {
    console.warn('[schema] read validation failed, using fallback:', r.error);
    return fallback;
  }
  return r.value;
}