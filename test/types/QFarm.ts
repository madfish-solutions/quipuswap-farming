import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

import { StakeParams, FA2Token } from "./Common";

export type NewRewardPerSecond = {
  fid: number;
  reward_per_second: number;
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
  token_info: MichelsonMap<MichelsonMapKey, unknown>;
  paused: boolean;
  reward_per_second: number;
  timelock: number;
  start_time: string;
};

export type FarmData = {
  expectedShareReward: BigNumber;
  expectedUserPrevEarned: BigNumber;
  expectedUserEarned: BigNumber;
  expectedUserEarnedAfterHarvest: BigNumber;
  expectedUserBurnReward: BigNumber;
  burnAmount: BigNumber;
  actualUserEarned: BigNumber;
  actualUserBurned: BigNumber;
  referralCommission: BigNumber;
};

export type Farm = {
  fees: QFees;
  upd: string;
  stake_params: StakeParams;
  reward_token: FA2Token;
  timelock: number;
  current_delegated: string;
  next_candidate: string;
  paused: boolean;
  reward_per_second: number;
  reward_per_share: number;
  staked: number;
  claimed: number;
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
    banned_bakers: MichelsonMap<MichelsonMapKey, unknown>;
    token_metadata: MichelsonMap<MichelsonMapKey, unknown>;
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
