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

/** Decode STEP \X2\ / \X4\ sequences and doubled literal backslashes. */
export function decodeStepString(value: string): string {
  let result = '';
  let index = 0;

  while (index < value.length) {
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
