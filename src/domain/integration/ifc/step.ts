import type { StepEntity, StepValue } from './types';
import { decodeStepString } from './stringEncoding';

export function parseIfcEntities(content: string): Map<number, StepEntity> {
  const dataMatch = content.match(/DATA;([\s\S]*?)ENDSEC;/i);
  if (!dataMatch) throw new Error('IFC DATA section was not found.');

  const statements = splitIfcStatements(dataMatch[1]);
  const entities = new Map<number, StepEntity>();

  for (const statement of statements) {
    const match = statement.match(/^#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([\s\S]*)\)$/i);
    if (!match) continue;

    const [, rawId, rawType, rawArgs] = match;
    const parsed = parseStepList(`(${rawArgs})`);
    entities.set(Number(rawId), {
      id: Number(rawId),
      type: rawType.toUpperCase(),
      args: parsed,
    });
  }

  return entities;
}

function splitIfcStatements(content: string): string[] {
  const statements: string[] = [];
  let buffer = '';
  let depth = 0;
  let inString = false;

  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    const next = content[index + 1];
    buffer += char;

    if (char === '\'' && next === '\'') {
      buffer += next;
      index++;
      continue;
    }

    if (char === '\'') {
      inString = !inString;
      continue;
    }

    if (inString) continue;
    if (char === '(') depth++;
    if (char === ')') depth--;

    if (char === ';' && depth === 0) {
      const statement = buffer.trim().slice(0, -1).trim();
      if (statement.length > 0) statements.push(statement);
      buffer = '';
    }
  }

  return statements;
}

function parseStepList(source: string): StepValue[] {
  const parser = createStepParser(source);
  const value = parser.parseValue();
  if (!Array.isArray(value)) {
    throw new Error('STEP arguments must be a list.');
  }
  parser.skipWhitespace();
  return value;
}

function createStepParser(source: string) {
  let index = 0;

  const skipWhitespace = () => {
    while (index < source.length && /\s/.test(source[index])) index++;
  };

  const parseString = () => {
    index++;
    let value = '';
    while (index < source.length) {
      const char = source[index];
      const next = source[index + 1];
      if (char === '\'' && next === '\'') {
        value += '\'';
        index += 2;
        continue;
      }
      if (char === '\'') {
        index++;
        break;
      }
      value += char;
      index++;
    }
    return decodeStepString(value);
  };

  const parseWord = () => {
    const start = index;
    while (index < source.length && /[A-Z0-9_\-.]/i.test(source[index])) index++;
    return source.slice(start, index);
  };

  const parseList = (): StepValue[] => {
    index++;
    const values: StepValue[] = [];
    while (index < source.length) {
      skipWhitespace();
      if (source[index] === ')') {
        index++;
        break;
      }
      values.push(parseValue());
      skipWhitespace();
      if (source[index] === ',') index++;
    }
    return values;
  };

  const parseValue = (): StepValue => {
    skipWhitespace();
    const char = source[index];

    if (char === '(') return parseList();
    if (char === '\'') return parseString();
    if (char === '$' || char === '*') {
      index++;
      return null;
    }
    if (char === '#') {
      index++;
      return { ref: Number(parseWord()) };
    }
    if (char === '.') {
      index++;
      const value = parseWord();
      if (source[index] === '.') index++;
      return value;
    }

    const word = parseWord();
    skipWhitespace();
    if (word && source[index] === '(') {
      const values = parseList();
      return {
        typedType: word.toUpperCase(),
        value: values.length === 1 ? values[0] : values,
      };
    }
    const number = Number(word);
    return Number.isFinite(number) ? number : word;
  };

  return { parseValue, skipWhitespace };
}

export function asRef(value: StepValue | undefined): number | null {
  return isRef(value) ? value.ref : null;
}

export function asRefList(value: StepValue | undefined): number[] {
  return Array.isArray(value) ? value.map((item) => asRef(item)).filter((item): item is number => item !== null) : [];
}

export function asString(value: StepValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

export function asNumber(value: StepValue | undefined): number | null {
  if (isTypedValue(value)) return asNumber(value.value);
  return typeof value === 'number' ? value : null;
}

export function asNumberList(value: StepValue | undefined): number[] {
  return Array.isArray(value) ? value.map((item) => asNumber(item)).filter((item): item is number => item !== null) : [];
}

function isRef(value: StepValue | undefined): value is { ref: number } {
  return typeof value === 'object' && value !== null && 'ref' in value;
}

function isTypedValue(value: StepValue | undefined): value is import('./types').StepTypedValue {
  return typeof value === 'object' && value !== null && 'typedType' in value;
}
