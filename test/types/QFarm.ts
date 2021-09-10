import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { Fees, StakeParams, Token, FA2Token } from "./Common";

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
  referrer: string | undefined | null;
  rewards_receiver: string;
  candidate: string;
};

export type UserInfoType = {
  last_staked: string;
  staked: number;
  earned: number;
  prev_earned: number;
  used_votes: number;
};

export type Farm = {
  fees: Fees;
  upd: string;
  stake_params: StakeParams;
  reward_token: FA2Token;
  timelock: number;
  current_delegated: string;
  current_candidate: string;
  alloc_point: number;
  allocated: boolean;
  rps: number;
  staked: number;
  start_time: string;
  fid: number;
  total_votes: number;
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
      qs_pool: string;
    };
    qsgov: FA2Token;
    qsgov_lp: string;
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
