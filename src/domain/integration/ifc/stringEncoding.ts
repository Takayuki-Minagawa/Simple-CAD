/**
 * Encode a JavaScript string for an ISO 10303-21 / IFC STEP quoted string.
 *
 * Printable ASCII is kept readable, apostrophes are doubled, literal
 * backslashes are doubled, BMP characters use \X2\ UTF-16 code units and
 * supplementary characters use \X4\ UCS-4 code points.
 */
export function encodeStepString(value: string): string {
  let result = '';
  let mode: 'X2' | 'X4' | null = null;

  const closeMode = () => {
    if (mode) result += '\\X0\\';
    mode = null;
  };

  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint >= 0x20 && codePoint <= 0x7e) {
      closeMode();
      if (character === "'") result += "''";
      else if (character === '\\') result += '\\\\';
      else result += character;
      continue;
    }

    const nextMode = codePoint <= 0xffff ? 'X2' : 'X4';
    if (mode !== nextMode) {
      closeMode();
      result += `\\${nextMode}\\`;
      mode = nextMode;
    }
    result += codePoint.toString(16).toUpperCase().padStart(nextMode === 'X2' ? 4 : 8, '0');
  }
  closeMode();
  return result;
}

const STEP_CODE_PAGE_LABELS: Record<string, string> = {
  A: 'iso-8859-1',
  B: 'iso-8859-2',
  C: 'iso-8859-3',
  D: 'iso-8859-4',
  E: 'iso-8859-5',
  F: 'iso-8859-6',
  G: 'iso-8859-7',
  H: 'iso-8859-8',
  I: 'iso-8859-9',
};

function decodeCodePageByte(page: string, byte: number): string | null {
  const label = STEP_CODE_PAGE_LABELS[page];
  if (!label) return null;
  try {
    return new TextDecoder(label, { fatal: true }).decode(Uint8Array.of(byte));
  } catch {
    return null;
  }
}

/**
 * Decode ISO 10303-21 strings, including modern X escapes and the legacy
 * `\PA\`..`\PI\` code-page / `\S\c` high-byte form. Unknown or malformed
 * directives remain literal rather than being silently discarded.
 */
export function decodeStepString(value: string): string {
  let result = '';
  let index = 0;
  let codePage: string | null = 'A';

  while (index < value.length) {
    if (
      value[index] === '\\' &&
      value[index + 1] === 'P' &&
      value[index + 3] === '\\'
    ) {
      const selectedPage = value[index + 2];
      if (STEP_CODE_PAGE_LABELS[selectedPage]) {
        codePage = selectedPage;
      } else {
        // Keep unsupported page selections and all subsequent S escapes
        // literal until a supported page is selected; guessing a character
        // set would silently corrupt IFC names and identifiers.
        result += value.slice(index, index + 4);
        codePage = null;
      }
      index += 4;
      continue;
    }

    if (value.startsWith('\\S\\', index) && index + 3 < value.length) {
      const sourceCode = value.charCodeAt(index + 3);
      const decoded =
        codePage !== null && sourceCode <= 0x7f
          ? decodeCodePageByte(codePage, sourceCode + 0x80)
          : null;
      if (decoded !== null) {
        result += decoded;
        index += 4;
        continue;
      }
      // Preserve the complete directive if the selected code page cannot
      // safely represent it, allowing callers to diagnose/reprocess the data.
      result += value.slice(index, index + 4);
      index += 4;
      continue;
    }

    if (value.startsWith('\\X2\\', index) || value.startsWith('\\X4\\', index)) {
      const width = value[index + 2] === '2' ? 4 : 8;
      const bodyStart = index + 4;
      const end = value.indexOf('\\X0\\', bodyStart);
      if (end >= 0) {
        const body = value.slice(bodyStart, end);
        if (body.length > 0 && body.length % width === 0 && /^[0-9A-Fa-f]+$/.test(body)) {
          let decoded = '';
          let valid = true;
          for (let offset = 0; offset < body.length; offset += width) {
            const codePoint = Number.parseInt(body.slice(offset, offset + width), 16);
            if (
              !Number.isFinite(codePoint) ||
              codePoint > 0x10ffff ||
              (width === 8 && codePoint >= 0xd800 && codePoint <= 0xdfff)
            ) {
              valid = false;
              break;
            }
            decoded += width === 4
              ? String.fromCharCode(codePoint)
              : String.fromCodePoint(codePoint);
          }
          if (valid) {
            result += decoded;
            index = end + 4;
            continue;
          }
        }
      }
    }

    // Legacy one-byte hexadecimal STEP escape.
    if (value.startsWith('\\X\\', index) && /^[0-9A-Fa-f]{2}/.test(value.slice(index + 3, index + 5))) {
      result += String.fromCharCode(Number.parseInt(value.slice(index + 3, index + 5), 16));
      index += 5;
      continue;
    }

    if (value.startsWith('\\\\', index)) {
      result += '\\';
      index += 2;
      continue;
    }

    result += value[index];
    index++;
  }

  return result;
}
