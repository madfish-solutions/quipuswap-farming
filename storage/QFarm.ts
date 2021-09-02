import { MichelsonMap } from "@taquito/michelson-encoder";

import { QFarmStorage } from "test/types/QFarm";

const zeroAddress = "tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg";

export const qFarmStorage: QFarmStorage = {
  storage: {
    farms: MichelsonMap.fromLiteral({}),
    referrers: MichelsonMap.fromLiteral({}),
    users_info: MichelsonMap.fromLiteral({}),
    votes: MichelsonMap.fromLiteral({}),
    candidates: MichelsonMap.fromLiteral({}),
    temp: {
      min_qs_gov_output: 0,
      token: {
        token: zeroAddress,
        id: 0,
        is_fa2: false,
      },
      qs_pool: {
        token: zeroAddress,
        id: 0,
        is_fa2: false,
      },
    },
    qsgov: {
      token: null,
      id: 0,
      is_fa2: false,
    },
    qsgov_lp: {
      token: null,
      id: 0,
      is_fa2: false,
    },
    admin: null,
    pending_admin: null,
    burner: null,
    proxy_minter: null,
    baker_registry: null,
    farms_count: 0,
    qsgov_per_second: 0,
    total_alloc_point: 0,
  },
  q_farm_lambdas: MichelsonMap.fromLiteral({}),
};
