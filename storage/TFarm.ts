import { MichelsonMap } from "@taquito/michelson-encoder";

import { TFarmStorage } from "../test/types/TFarm";

export const tFarmStorage: TFarmStorage = {
  storage: {
    farms: MichelsonMap.fromLiteral({}),
    referrers: MichelsonMap.fromLiteral({}),
    users_info: MichelsonMap.fromLiteral({}),
    votes: MichelsonMap.fromLiteral({}),
    candidates: MichelsonMap.fromLiteral({}),
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
    baker_registry: null,
    farms_count: 0,
  },
  t_farm_lambdas: MichelsonMap.fromLiteral({}),
};
