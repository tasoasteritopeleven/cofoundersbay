'use strict';

const net = require('net');

function ensureStrictLocalPort({ port, label, host = '127.0.0.1', origin }) {
  const targetOrigin = origin ?? `http://localhost:${port}`;

  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();

    server.once('error', (error) => {
      if (error && error.code === 'EADDRINUSE') {
        reject(
          new Error(
            [
              `${label} must run on ${targetOrigin}.`,
              `Port ${port} is already in use.`,
              'Disconnect the existing process first:',
              `  PowerShell:  netstat -ano | findstr :${port}`,
              '               taskkill /F /PID <PID>',
              `Then start ${label} again so it binds to ${targetOrigin}.`,
            ].join('\n'),
          ),
        );
        return;
      }

      reject(error);
    });

    server.once('listening', () => {
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve();
      });
    });

    server.listen(port, host);
  });
}

/** True when something is already bound to host:port. */
function isPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();

    server.once('error', (error) => {
      if (error && error.code === 'EADDRINUSE') {
        resolve(true);
        return;
      }
      reject(error);
    });

    server.once('listening', () => {
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(false);
      });
    });

    server.listen(port, host);
  });
}

module.exports = {
  ensureStrictLocalPort,
  isPortInUse,
};
