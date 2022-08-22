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
      secretKey: dev.sk,
      qsgov: {
        token: "KT1VowcKqZFGhdcDZA3UN1vrjBLmxV5bxgfJ",
        id: 0,
      },
      qsgov_lp: "KT1DgpR6mXkbgyF3SdduyimNRy9GSR9TgRqp",
      admin: dev.pkh,
    },
    ithacanet: {
      rpc: "https://rpc.ithacanet.teztnets.xyz",
      port: 443,
      network_id: "*",
      secretKey: dev.sk,
      qsgov: {
        token: "KT1ArrmPA3QEtcqX4fmmKMjXA5Lm3DzBhscB",
        id: 0,
      },
      qsgov_lp: "KT1K16JFj1L5u4HqVtd4H8dnaBVUxvLG4mjR",
      admin: dev.pkh,
    },
    ghostnet: {
      rpc: "https://ghostnet.ecadinfra.com/",
      port: 443,
      network_id: "*",
      secretKey: dev.sk,
      qsgov: {
        token: "KT1K16JFj1L5u4HqVtd4H8dnaBVUxvLG4mjR",
        id: 0,
      },
      qsgov_lp: "KT1K16JFj1L5u4HqVtd4H8dnaBVUxvLG4mjR",
      admin: dev.pkh,
    },
    mainnet: {
      rpc: "https://mainnet.smartpy.io",
      port: 443,
      network_id: "*",
      secretKey: dev.sk,
    },
  },
};
