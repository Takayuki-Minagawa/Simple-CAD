/** DXF generations are shared by several AutoCAD releases; there is no AC2015. */
export const DXF_VERSIONS = {
  AC1015: 'AutoCAD 2000 (AC1015)',
  AC1027: 'AutoCAD 2015–2017 (DXF 2013 / AC1027)',
  AC1032: 'AutoCAD 2018+ (DXF 2018 / AC1032)',
} as const;

export type DxfVersion = keyof typeof DXF_VERSIONS;
export const DEFAULT_DXF_VERSION: DxfVersion = 'AC1032';

export function isDxfVersion(value: string): value is DxfVersion {
  return Object.hasOwn(DXF_VERSIONS, value);
}

export function describeDxfVersion(version?: string): string {
  if (!version) return 'Unknown / 不明';
  if (isDxfVersion(version)) return DXF_VERSIONS[version];
  const legacy: Record<string, string> = {
    AC1006: 'R10',
    AC1009: 'R11/R12',
    AC1012: 'R13',
    AC1014: 'R14',
    AC1015: '2000',
    AC1018: '2004',
    AC1021: '2007',
    AC1024: '2010',
  };
  return legacy[version] ? `AutoCAD ${legacy[version]} (${version})` : version;
}

/** Modern DXF is UTF-8; older Japanese drawings commonly use ANSI_932. */
export function decodeDxfBytes(bytes: Uint8Array): string {
  const probe = new TextDecoder('latin1').decode(bytes);
  if (probe.startsWith('AutoCAD Binary DXF')) {
    throw new Error('バイナリDXFは未対応です。CADでテキストDXFとして保存してください。');
  }
  const version = probe.match(/\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(AC\d+)/)?.[1];
  const codePage = probe.match(/\$DWGCODEPAGE\s*\r?\n\s*3\s*\r?\n\s*([^\r\n]+)/)?.[1].trim();
  // UTF-8 is mandatory starting with the AutoCAD 2007 DXF generation.
  if (version && Number(version.slice(2)) >= 1021) {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  const encodings: Record<string, string> = {
    ANSI_932: 'shift_jis',
    ANSI_936: 'gbk',
    ANSI_949: 'euc-kr',
    ANSI_950: 'big5',
    ANSI_1250: 'windows-1250',
    ANSI_1251: 'windows-1251',
    ANSI_1252: 'windows-1252',
    ANSI_1253: 'windows-1253',
    ANSI_1254: 'windows-1254',
    ANSI_1255: 'windows-1255',
    ANSI_1256: 'windows-1256',
    ANSI_1257: 'windows-1257',
    ANSI_1258: 'windows-1258',
    UTF_8: 'utf-8',
  };
  if (codePage && encodings[codePage]) {
    return new TextDecoder(encodings[codePage], { fatal: true }).decode(bytes);
  }
  // No guess that could silently corrupt labels: accept only valid UTF-8.
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
