import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { Token } from "./Common";

export type TFarmStorage = {
  storage: {
    farms: MichelsonMap<MichelsonMapKey, unknown>;
    referrers: MichelsonMap<MichelsonMapKey, unknown>;
    users_info: MichelsonMap<MichelsonMapKey, unknown>;
    votes: MichelsonMap<MichelsonMapKey, unknown>;
    candidates: MichelsonMap<MichelsonMapKey, unknown>;
    qsgov: Token;
    qsgov_lp: Token;
    admin: string;
    pending_admin: string;
    burner: string;
    proxy_minter: string;
    baker_registry: string;
    farms_count: number;
  };
  t_farm_lambdas: MichelsonMap<MichelsonMapKey, unknown>;
};
