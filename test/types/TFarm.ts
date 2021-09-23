import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

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

export type FarmData = {
  expectedShareReward: BigNumber;
  expectedUserPrevEarned: BigNumber;
  expectedUserEarned: BigNumber;
  expectedUserEarnedAfterHarvest: BigNumber;
  actualUserEarned: BigNumber;
  actualUserBurned: BigNumber;
  referralCommission: BigNumber;
};

export type Farm = {
  fees: TFees;
  upd: string;
  stake_params: StakeParams;
  reward_token: Token;
  timelock: number;
  current_delegated: string;
  current_candidate: string;
  paused: boolean;
  reward_per_second: number;
  reward_per_share: number;
  staked: number;
  start_time: string;
  end_time: string;
  fid: number;
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
