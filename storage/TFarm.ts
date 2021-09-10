import { MichelsonMap } from "@taquito/michelson-encoder";

import { TFarmStorage } from "../test/types/TFarm";

import { zeroAddress } from "test/helpers/Utils";

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
    },
    qsgov_lp: null,
    admin: null,
    pending_admin: zeroAddress,
    burner: null,
    baker_registry: null,
    farms_count: 0,
  },
  t_farm_lambdas: MichelsonMap.fromLiteral({}),
};
