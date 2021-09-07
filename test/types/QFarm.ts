import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { Fees, StakeParams, Token } from "./Common";

export type SetAllocPointParams = {
  fid: number;
  alloc_point: number;
};

export type NewFarmParams = {
  fees: Fees;
  stake_params: StakeParams;
  timelock: number;
  alloc_point: number;
  start_time: string;
};

export type DepositParams = {
  fid: number;
  amt: number;
  referrer?: string;
  rewards_receiver: string;
  candidate: string;
};

export type QFarmStorage = {
  storage: {
    farms: MichelsonMap<MichelsonMapKey, unknown>;
    referrers: MichelsonMap<MichelsonMapKey, unknown>;
    users_info: MichelsonMap<MichelsonMapKey, unknown>;
    votes: MichelsonMap<MichelsonMapKey, unknown>;
    candidates: MichelsonMap<MichelsonMapKey, unknown>;
    temp: {
      min_qs_gov_output: number;
      token: Token;
      qs_pool: Token;
    };
    qsgov: Token;
    qsgov_lp: Token;
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
