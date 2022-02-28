const { alice, dev } = require("./scripts/sandbox/accounts");

module.exports = {
  confirmationPollingTimeoutSecond: 500000,
  syncInterval: 0, // 0 for tests, 5000 for deploying
  confirmTimeout: 90000, // 90000 for tests, 180000 for deploying
  buildDir: "build",
  migrationsDir: "migrations",
  contractsDir: "contracts/main",
  ligoVersion: "0.35.0",
  network: "development",
  networks: {
    development: {
      rpc: "http://localhost:8732",
      network_id: "*",
      secretKey: alice.sk,
    },
    hangzhounet: {
      rpc: "https://hangzhounet.api.tez.ie/",
      port: 443,
      network_id: "*",
      secretKey: alice.sk,
    },
    mainnet: {
      rpc: "https://mainnet.smartpy.io",
      port: 443,
      network_id: "*",
      secretKey: dev.sk,
    },
  },
};
