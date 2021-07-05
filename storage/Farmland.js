const { MichelsonMap } = require("@taquito/michelson-encoder");

module.exports = {
  storage: {
    farms: MichelsonMap.fromLiteral({}),
    users: MichelsonMap.fromLiteral({}),
    farms_count: "0",
    qugo_token: null,
    admin: null,
    pending_admin: null,
  },
  farmland_lambdas: MichelsonMap.fromLiteral({}),
};
