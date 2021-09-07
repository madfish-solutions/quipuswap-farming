import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { Fees, StakeParams, Token } from "./Common";

export type NewFarmParams = {
  fees: Fees;
  stake_params: StakeParams;
  reward_token: Token;
  paused: boolean;
  timelock: number;
  start_time: string;
  end_time: string;
  reward_per_second: number;
};

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
    baker_registry: string;
    farms_count: number;
  };
  t_farm_lambdas: MichelsonMap<MichelsonMapKey, unknown>;
};
