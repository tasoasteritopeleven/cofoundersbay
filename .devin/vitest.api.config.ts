import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const ts = require('typescript');

export default {
  root: fileURLToPath(new URL('../apps/api/', import.meta.url)),
  resolve: {
    // Same reason as the web config: `dist` is gitignored and these tests do
    // not run through turbo, so the shared package is read from source. No API
    // test previously reached a module that imports it, so this resolution had
    // never actually been exercised.
    alias: {
      '@cofounderbay/shared': fileURLToPath(new URL('../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  plugins: [
    {
      name: 'nestjs-typescript-decorators',
      enforce: 'pre' as const,
      transform(source: string, id: string) {
        if (!id.endsWith('.ts') || id.includes('/node_modules/')) return;
        const result = ts.transpileModule(source, {
          fileName: id,
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
            sourceMap: true,
            inlineSources: true,
          },
        });
        return { code: result.outputText, map: result.sourceMapText };
      },
    },
  ],
  test: {
    environment: 'node',
    pool: 'forks',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
};
