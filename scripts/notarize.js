// CJS shim for electron-builder afterSign when the repo root uses "type": "module".
// This file is treated as CommonJS by virtue of scripts/package.json setting { "type": "commonjs" }.
module.exports = require('./notarize.cjs');
