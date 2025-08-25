import { build } from 'tsup'

await build({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  outDir: 'dist',
  target: 'node20',
  splitting: false,
  sourcemap: false,
  minify: false,
})
