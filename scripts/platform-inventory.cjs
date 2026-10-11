const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const appRoot = 'apps/web/src/app/';
const sourceRoot = 'apps/web/src/';
const normalize = (value) => value.replace(/\\/g, '/');
const surfaceKinds = new Map([
  ['button', 'action'], ['Button', 'action'], ['IconButton', 'action'],
  ['a', 'link'], ['Link', 'link'], ['form', 'form'],
  ['Dialog', 'dialog'], ['AlertDialog', 'dialog'], ['Modal', 'dialog'],
  ['Drawer', 'drawer'], ['Sheet', 'drawer'], ['DropdownMenu', 'menu'],
  ['DropdownMenuItem', 'action'], ['Tabs', 'tabs'], ['TabsTrigger', 'tab'],
  ['input', 'input'], ['Input', 'input'], ['textarea', 'input'], ['Textarea', 'input'],
  ['Select', 'input'], ['Checkbox', 'input'], ['Switch', 'input'],
]);

function routeFromFile(file) {
  const parts = normalize(file).slice(appRoot.length).replace(/\/page\.[jt]sx?$/, '').replace(/^page\.[jt]sx?$/, '').split('/');
  return '/' + parts.filter((part) => part && !/^\([^.)][^/]*\)$/.test(part) && !part.startsWith('@')).join('/');
}

function pending() {
  return {
    status: 'not_tested', purpose: null, access: null, data: null,
    mutation: null, synchronization: null, states: null, ux: null,
    localization: null, ai: null, evidence: [],
  };
}

function decorators(node) {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : [];
}

function calls(node, name) {
  return decorators(node).map((decorator) => decorator.expression).filter((expression) =>
    ts.isCallExpression(expression) && expression.expression.getText() === name,
  );
}

function literal(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : null;
}

function resolveImport(file, specifier, sources) {
  const base = specifier.startsWith('@/') ? sourceRoot + specifier.slice(2)
    : specifier.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)) : null;
  if (!base) return null;
  return [base, ...['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'].map((suffix) => base + suffix)]
    .find((candidate) => Object.hasOwn(sources, candidate)) || null;
}

function buildInventory(input) {
  const sources = Object.fromEntries(Object.entries(input).map(([file, text]) => [normalize(file), text]));
  const routes = [];
  const boundaries = [];
  const surfaces = [];
  const endpoints = [];
  const imports = new Map();
  const byFile = new Map();
  const diagnostics = [];
  const files = Object.keys(sources).sort().filter((file) => /\.[jt]sx?$/.test(file) && !/\.(test|spec)\.[jt]sx?$/.test(file));

  for (const file of files) {
    const source = ts.createSourceFile(file, sources[file], ts.ScriptTarget.Latest, true);
    diagnostics.push(...source.parseDiagnostics.map((diagnostic) => ({
      file, message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      line: source.getLineAndCharacterOfPosition(diagnostic.start || 0).line + 1,
    })));
    const localImports = [];
    const localSurfaces = [];
    const ordinals = new Map();
    if (file.startsWith(appRoot) && /\/page\.[jt]sx?$/.test(file)) {
      routes.push({ id: file, file, route: routeFromFile(file), surfaceIds: [], ...pending() });
    }
    if (file.startsWith(appRoot) && /\/(layout|loading|error|global-error|not-found)\.[jt]sx?$/.test(file)) {
      boundaries.push({ file, kind: path.posix.basename(file).split('.')[0], ...pending() });
    }

    function visit(node) {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const specifier = literal(node.moduleSpecifier);
        if (specifier) {
          const resolved = resolveImport(file, specifier, sources);
          if (resolved) localImports.push(resolved);
        }
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const specifier = literal(node.arguments[0]);
        const resolved = specifier && resolveImport(file, specifier, sources);
        if (resolved) localImports.push(resolved);
      }
      if (file.startsWith(sourceRoot) && (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node))) {
        const tag = node.tagName.getText(source);
        const kind = surfaceKinds.get(tag) || (/Modal$/.test(tag) ? 'dialog' : null);
        if (kind) {
          const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
          const explicit = attributes.find((attribute) => attribute.name.getText() === 'data-action-id');
          const ordinal = (ordinals.get(tag) || 0) + 1;
          ordinals.set(tag, ordinal);
          const position = source.getLineAndCharacterOfPosition(node.getStart(source));
          const actionId = explicit && literal(explicit.initializer);
          const id = `${file}#${tag}:${ordinal}`;
          surfaces.push({
            id, actionId: actionId || null, file, line: position.line + 1, column: position.character + 1,
            tag, kind, handlers: attributes.map((attribute) => attribute.name.getText()).filter((name) => /^on[A-Z]/.test(name)),
            hasSpread: node.attributes.properties.some(ts.isJsxSpreadAttribute),
            ...pending(),
          });
          localSurfaces.push(id);
        }
      }
      if (file.startsWith('apps/api/src/') && ts.isClassDeclaration(node)) {
        const controller = calls(node, 'Controller')[0];
        if (controller) {
          const prefix = literal(controller.arguments[0]);
          const classGuards = calls(node, 'UseGuards').flatMap((call) => call.arguments.map((argument) => argument.getText(source)));
          for (const member of node.members) {
            for (const verb of ['Get', 'Post', 'Put', 'Patch', 'Delete', 'Options', 'Head', 'All']) {
              for (const call of calls(member, verb)) {
                const suffix = call.arguments.length ? literal(call.arguments[0]) : '';
                const route = prefix !== null && suffix !== null ? '/' + [prefix, suffix].filter(Boolean).join('/') : null;
                const guards = [...classGuards, ...calls(member, 'UseGuards').flatMap((guard) => guard.arguments.map((argument) => argument.getText(source)))];
                endpoints.push({
                  id: `${file}#${member.name?.getText(source)}:${verb}`, file,
                  line: source.getLineAndCharacterOfPosition(member.getStart(source)).line + 1,
                  method: verb.toUpperCase(), path: route, guards,
                  declaration: call.getText(source), ...pending(),
                });
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    imports.set(file, localImports);
    byFile.set(file, localSurfaces);
  }

  for (const route of routes) {
    const visited = new Set();
    const pendingFiles = [route.file];
    let parent = path.posix.dirname(route.file);
    while (parent.startsWith(appRoot.slice(0, -1))) {
      for (const name of ['layout', 'template', 'loading', 'error', 'not-found']) {
        for (const extension of ['tsx', 'ts', 'jsx', 'js']) {
          const boundary = `${parent}/${name}.${extension}`;
          if (Object.hasOwn(sources, boundary)) pendingFiles.push(boundary);
        }
      }
      parent = path.posix.dirname(parent);
    }
    while (pendingFiles.length) {
      const file = pendingFiles.pop();
      if (visited.has(file)) continue;
      visited.add(file);
      route.surfaceIds.push(...byFile.get(file) || []);
      pendingFiles.push(...imports.get(file) || []);
    }
    route.surfaceIds.sort();
  }

  return {
    schemaVersion: 1,
    method: 'static_typescript_ast',
    limitations: [
      'Static presence and declared guards do not establish runtime functionality or authorization.',
      'Imported surfaces are candidates, not proof that every conditional branch renders on a route.',
      'Source-derived surface IDs may change when tag order changes; data-action-id is recorded separately.',
      'Computed routes, custom wrappers, portals, runtime-generated controls and remote content require manual review.',
      'Paths are controller-relative; global API prefixes and middleware are not inferred.',
    ],
    summary: { sourceFiles: files.length, routes: routes.length, boundaries: boundaries.length, surfaces: surfaces.length, endpoints: endpoints.length, verified: 0, parseErrors: diagnostics.length },
    routes, boundaries, surfaces, endpoints, diagnostics,
  };
}

function collectSources(root) {
  const sources = {};
  for (const relative of ['apps/web/src', 'apps/api/src']) {
    function walk(folder) {
      for (const entry of fs.readdirSync(path.join(root, folder), { withFileTypes: true })) {
        const file = `${folder}/${entry.name}`;
        if (entry.isDirectory()) walk(file);
        else if (entry.isFile() && /\.[jt]sx?$/.test(entry.name)) sources[file] = fs.readFileSync(path.join(root, file), 'utf8');
      }
    }
    walk(relative);
  }
  return sources;
}

if (require.main === module) {
  const inventory = buildInventory(collectSources(path.resolve(__dirname, '..')));
  process.stdout.write(JSON.stringify(process.argv.includes('--summary') ? inventory.summary : inventory, null, 2) + '\n');
  if (inventory.diagnostics.length) process.exitCode = 1;
}

module.exports = { buildInventory, collectSources, routeFromFile };
