import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { StakeParams, Token, FA2Token } from "./Common";

export type RPS = {
  fid: number;
  rps: number;
};

export type QFees = {
  harvest_fee: number;
  withdrawal_fee: number;
  burn_reward: number;
};

export type SetFeeParams = {
  fid: number;
  fees: QFees;
};

export type NewFarmParams = {
  fees: QFees;
  stake_params: StakeParams;
  paused: boolean;
  qsgov_per_second: number;
  timelock: number;
  start_time: string;
};

export type UserInfoType = {
  last_staked: string;
  staked: number;
  earned: number;
  prev_earned: number;
  used_votes: number;
};

export type Farm = {
  fees: QFees;
  upd: string;
  stake_params: StakeParams;
  reward_token: FA2Token;
  timelock: number;
  current_delegated: string;
  current_candidate: string;
  paused: boolean;
  qsgov_per_second: number;
  rps: number;
  staked: number;
  start_time: string;
  fid: number;
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
  };
  q_farm_lambdas: MichelsonMap<MichelsonMapKey, unknown>;
};
