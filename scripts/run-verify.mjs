import { build } from 'esbuild'

const entry = process.argv[2]
if (!entry) throw new Error('Usage: node scripts/run-verify.mjs <entry.ts>')

const result = await build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'warning',
  plugins: [{
    name: 'vue-stub',
    setup(build) {
      build.onResolve({ filter: /\.vue$/ }, args => ({ path: args.path, namespace: 'vue-stub' }))
      build.onLoad({ filter: /.*/, namespace: 'vue-stub' }, () => ({ contents: 'export default {}', loader: 'js' }))
    },
  }],
})

const code = result.outputFiles[0]?.text ?? ''
const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
await import(url)
