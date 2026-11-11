// Test-only loader: uses the existing compiler, emits no files, never loads expo-sqlite.
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const cache = new Map();
module.exports = function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  cache.set(filename, loaded);
  const original = loaded.require.bind(loaded);
  loaded.require = request => {
    if (request.startsWith('.')) {
      const base = path.resolve(path.dirname(filename), request);
      for (const candidate of [`${base}.ts`, path.join(base, 'index.ts')]) {
        if (existsSync(candidate)) return load(candidate);
      }
    }
    return original(request);
  };
  loaded._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
};
