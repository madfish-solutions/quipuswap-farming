import { MichelsonMap } from "@taquito/michelson-encoder";

import { QFarmStorage } from "../test/types/QFarm";

import { zeroAddress } from "../test/helpers/Utils";

export const qFarmStorage: QFarmStorage = {
  storage: {
    farms: MichelsonMap.fromLiteral({}),
    referrers: MichelsonMap.fromLiteral({}),
    users_info: MichelsonMap.fromLiteral({}),
    votes: MichelsonMap.fromLiteral({}),
    candidates: MichelsonMap.fromLiteral({}),
    banned_bakers: MichelsonMap.fromLiteral({}),
    token_metadata: MichelsonMap.fromLiteral({}),
    qsgov: {
      token: null,
      id: 0,
    },
    qsgov_lp: null,
    admin: null,
    pending_admin: zeroAddress,
    burner: null,
    proxy_minter: null,
    baker_registry: null,
    farms_count: 0,
  },
  q_farm_lambdas: MichelsonMap.fromLiteral({}),
};
