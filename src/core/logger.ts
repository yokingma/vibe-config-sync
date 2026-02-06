import pc from 'picocolors';

export function logInfo(...args: unknown[]): void {
  console.log(pc.blue('[INFO]'), ...args);
}

export function logOk(...args: unknown[]): void {
  console.log(pc.green('[OK]'), ...args);
}

export function logWarn(...args: unknown[]): void {
  console.log(pc.yellow('[WARN]'), ...args);
}

export function logError(...args: unknown[]): void {
  console.error(pc.red('[ERROR]'), ...args);
}
