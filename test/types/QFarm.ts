import { MichelsonMap } from "@taquito/michelson-encoder";

export type User = {
  last_staked: number;
  staked: number;
  earned: number;
  prev_earned: number;
  used_votes: number;
};

export type Fees = {
  harvest_fee: number;
  withdrawal_fee: number;
};

export type Token = {
  token: string;
  id: number;
  is_fa2: boolean;
};

export type StakeParams = {
  staked_token: Token;
  is_lp_staked_token: boolean;
  token: Token;
  qs_pool: string;
};

export type Timelock = {
  duration: number;
};

export type Farm = {
  users_info: MichelsonMap<string, User>;
  votes: MichelsonMap<string, string>;
  candidates: MichelsonMap<string, string>;
  fees: Fees;
  upd: number;
  stake_params: StakeParams;
  reward_token: Token;
  timelock: Timelock;
  current_delegated: string;
  current_candidate: string;
  paused: boolean;
  alloc_point: number;
  rps: number;
  start_time: number;
  fid: number;
  total_votes: number;
};

export type QFarmStorage = {
  storage: {
    farms: MichelsonMap<number, Farm>;
    referrers: MichelsonMap<string, string>;
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
  q_farm_lambdas: MichelsonMap<number, any>;
};
