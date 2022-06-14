import path from 'path'
import esbuild from 'esbuild'
import plugin from 'node-stdlib-browser/helpers/esbuild/plugin'
import stdLibBrowser from 'node-stdlib-browser'

await esbuild.build({
  entryPoints: ['example/example.js'],
  bundle: true,
  watch: process.argv.includes('--watch'),
  outfile: 'example/bundle.js',
  inject: ['./node_modules/node-stdlib-browser/helpers/esbuild/shim.js'],
  plugins: [plugin(stdLibBrowser)]
})
