import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const packageRoot = resolve(dirname(require.resolve('@huggingface/transformers')), '..');
const destination = new URL('../public/studio/vendor/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const name of ['transformers.min.js', 'ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']) {
  await copyFile(join(packageRoot, 'dist', name), new URL(name, destination));
}
