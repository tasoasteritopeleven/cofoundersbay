'use strict';

const supportedMajors = new Set([20, 22, 25]);

function ensureSupportedNode(target = 'this workspace') {
  if (process.env.CFB_SKIP_NODE_CHECK === '1') {
    return;
  }

  const major = Number.parseInt(process.versions.node.split('.')[0], 10);

  if (supportedMajors.has(major)) {
    return;
  }

  const supported = Array.from(supportedMajors).join(' or ');

  console.error(
    [
      `Unsupported Node.js runtime for ${target}: ${process.version}.`,
      `Use Node ${supported} for this repository.`,
      'This guard prevents unstable Next.js dev/build behavior such as missing chunks, stale manifests, and broken page loads.',
      'Set CFB_SKIP_NODE_CHECK=1 only if you intentionally need to bypass the safeguard.',
    ].join(' '),
  );

  process.exit(1);
}

if (require.main === module) {
  ensureSupportedNode(process.argv[2] ?? 'this workspace');
}

module.exports = {
  ensureSupportedNode,
};
