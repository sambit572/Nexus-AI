/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  transform: {},                 // no Babel - we run Jest with --experimental-vm-modules for native ESM
  testMatch: ["**/tests/**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  testTimeout: 20000,            // mongodb-memory-server's first download/boot can be slow
  verbose: true
};
