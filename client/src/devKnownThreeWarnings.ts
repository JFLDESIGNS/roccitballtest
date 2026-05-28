import { setConsoleFunction } from 'three';

/** Noisy but harmless while on three r183+ and @react-three/fiber 9.x */
const SUPPRESSED_THREE_WARNINGS = [
  'Clock: This module has been deprecated',
];

/** FBX materials reference maps three.js does not implement */
const SUPPRESSED_CONSOLE_WARN_PREFIXES = [
  'THREE.FBXLoader:',
  'using deprecated parameters for the initialization function',
];

function isSuppressedDeprecatedInitWarn(message: string): boolean {
  return message.includes(
    'using deprecated parameters for the initialization function',
  );
}

function isSuppressedFbxTextureWarn(message: string): boolean {
  return (
    SUPPRESSED_CONSOLE_WARN_PREFIXES.some((p) => message.startsWith(p)) &&
    message.includes('map is not supported in three.js')
  );
}

let installed = false;

function formatShaderErrorParams(params: unknown[]): string {
  return params
    .map((param) => {
      if (typeof param === 'string') return param;
      if (param && typeof param === 'object') {
        try {
          return JSON.stringify(param, null, 2);
        } catch {
          return String(param);
        }
      }
      return String(param ?? '');
    })
    .filter(Boolean)
    .join('\n');
}

/** Dev-only: keep the loading screen console readable */
export function installDevKnownThreeWarningFilters(): void {
  if (!import.meta.env.DEV || installed) return;
  installed = true;

  setConsoleFunction((type, message, ...params) => {
    if (
      type === 'warn' &&
      typeof message === 'string' &&
      SUPPRESSED_THREE_WARNINGS.some((s) => message.includes(s))
    ) {
      return;
    }
    if (type === 'warn') console.warn(message, ...params);
    else if (type === 'error') {
      console.error(message, ...params);
      if (typeof message === 'string' && message.includes('Shader Error')) {
        const details = formatShaderErrorParams(params);
        if (details) {
          console.error('[Three shader diagnostics]\n' + details);
        }
      }
    }
    else console.log(message, ...params);
  });

  const nativeWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const head = typeof args[0] === 'string' ? args[0] : String(args[0] ?? '');
    if (isSuppressedFbxTextureWarn(head)) return;
    if (isSuppressedDeprecatedInitWarn(head)) return;
    nativeWarn(...args);
  };
}
