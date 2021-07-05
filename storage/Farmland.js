const { MichelsonMap } = require("@taquito/michelson-encoder");

module.exports = {
  storage: {
    tmp1: "0",
    tmp2: "0",
  },
  farmland_lambdas: MichelsonMap.fromLiteral({}),
};
