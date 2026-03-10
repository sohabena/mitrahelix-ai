export const CHECKPOINT_EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.mitrahelix',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '__pycache__',
  '.venv',
  'venv',
  '.tox',
  'target',
  'vendor',
  '.cache',
  '.turbo',
  'coverage',
]);

export const CHECKPOINT_EXCLUDED_EXTENSIONS = new Set([
  '.pyc', '.pyo', '.class', '.o', '.obj',
  '.exe', '.dll', '.so', '.dylib', '.wasm',
  '.map', '.min.js', '.min.css',
  '.lock', '.log',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.svg',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
]);

export const MAX_FILE_SIZE_FOR_CHECKPOINT = 1_000_000;

export function shouldExcludeFromCheckpoint(relativePath: string): boolean {
  const parts = relativePath.split(/[\\/]/);
  for (const part of parts) {
    if (CHECKPOINT_EXCLUDED_DIRS.has(part)) return true;
  }
  const ext = relativePath.substring(relativePath.lastIndexOf('.'));
  return CHECKPOINT_EXCLUDED_EXTENSIONS.has(ext);
}
