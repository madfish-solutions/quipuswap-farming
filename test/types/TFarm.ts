import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { StakeParams, Token, FA2Token } from "./Common";

export type TFees = {
  harvest_fee: number;
  withdrawal_fee: number;
};

export type SetFeeParams = {
  fid: number;
  fees: TFees;
};

export type NewFarmParams = {
  fees: TFees;
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
    qsgov: FA2Token;
    qsgov_lp: string;
    admin: string;
    pending_admin: string;
    burner: string;
    baker_registry: string;
    farms_count: number;
  };
  t_farm_lambdas: MichelsonMap<MichelsonMapKey, unknown>;
};
