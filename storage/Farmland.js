const { MichelsonMap } = require("@taquito/michelson-encoder");

module.exports = {
  storage: {
    farms: MichelsonMap.fromLiteral({}),
    referrers: MichelsonMap.fromLiteral({}),
    qsgov: {
      token: null,
      id: "0",
    },
    admin: null,
    pending_admin: null,
    burner: null,
    proxy_minter: null,
    farms_count: "0",
    qsgov_per_second: "0",
    total_alloc_point: "0",
    min_qs_gov_output: "0",
  },
  farmland_lambdas: MichelsonMap.fromLiteral({}),
};
