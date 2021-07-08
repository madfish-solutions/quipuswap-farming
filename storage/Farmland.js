const { MichelsonMap } = require("@taquito/michelson-encoder");

module.exports = {
  storage: {
    farms: MichelsonMap.fromLiteral({}),
    qugo_token: {
      token: null,
      id: "0",
    },
    admin: null,
    pending_admin: null,
    farms_count: "0",
    qugo_per_second: "0",
    total_alloc_point: "0",
  },
  farmland_lambdas: MichelsonMap.fromLiteral({}),
};
