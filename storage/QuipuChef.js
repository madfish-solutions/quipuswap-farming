const { MichelsonMap } = require("@taquito/michelson-encoder");

module.exports = {
  storage: {
    tmp1: "0",
    tmp2: "0",
  },
  quipu_chef_lambdas: MichelsonMap.fromLiteral({}),
};
