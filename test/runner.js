import path from 'path'
import esbuild from 'esbuild'
import plugin from 'node-stdlib-browser/helpers/esbuild/plugin'
import filelocPlugin from 'esbuild-plugin-fileloc'
import stdLibBrowser from 'node-stdlib-browser'
import glob from 'glob'

await esbuild.build({
  stdin: {
    contents: glob.sync('./test/*-test.js').map(f => `import '${f}'`).join('\n'),
    resolveDir: process.cwd()
  },
  bundle: true,
  inject: ['./node_modules/node-stdlib-browser/helpers/esbuild/shim.js'],
  loader: { '.css': 'text' },
  plugins: [plugin(stdLibBrowser), filelocPlugin.filelocPlugin()]
})
