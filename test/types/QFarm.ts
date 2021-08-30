import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { Token } from "./Common";

export type Fees = {
  harvest_fee: number;
  withdrawal_fee: number;
};

export type StakeParams = {
  staked_token: Token;
  is_lp_staked_token: boolean;
  token: Token;
  qs_pool: string;
};

export type NewFarmParams = {
  fees: Fees;
  stake_params: StakeParams;
  paused: boolean;
  timelock: number;
  alloc_point: number;
  start_time: string;
};

export type QFarmStorage = {
  storage: {
    farms: MichelsonMap<MichelsonMapKey, unknown>;
    referrers: MichelsonMap<MichelsonMapKey, unknown>;
    temp: {
      min_qs_gov_output: number;
      token: Token;
      qs_pool: string;
    };
    qsgov: Token;
    qsgov_pool: string;
    admin: string;
    pending_admin: string;
    burner: string;
    proxy_minter: string;
    baker_registry: string;
    farms_count: number;
    qsgov_per_second: number;
    total_alloc_point: number;
  };
  q_farm_lambdas: MichelsonMap<MichelsonMapKey, unknown>;
};
