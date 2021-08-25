import { MichelsonMap } from "@taquito/michelson-encoder";

module.exports = {
  storage: {
    farms: MichelsonMap.fromLiteral({}),
    referrers: MichelsonMap.fromLiteral({}),
    qsgov: {
      token: null,
      id: "0",
      is_fa2: true,
    },
    qsgov_pool: null,
    admin: null,
    pending_admin: null,
    burner: null,
    proxy_minter: null,
    baker_registry: null,
    farms_count: "0",
  },
  t_farm_lambdas: MichelsonMap.fromLiteral({}),
};
