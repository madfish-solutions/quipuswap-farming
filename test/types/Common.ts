import { BigNumber } from "bignumber.js";

export type FA12Token = string;

export type FA2Token = {
  token: string;
  id: number;
};

export type Token = { fA12: FA12Token } | { fA2: FA2Token };

export type PauseFarmParam = {
  fid: number;
  pause: boolean;
};

export type StakeParams = {
  staked_token: Token;
  is_lp_staked_token: boolean;
  token: Token;
  qs_pool: FA12Token;
};

export type HarvestParams = {
  fid: number;
  rewards_receiver: string;
};

export type FarmData = {
  expectedShareReward: BigNumber;
  expectedUserPrevEarned: BigNumber;
  expectedUserEarned: BigNumber;
  expectedUserEarnedAfterHarvest: BigNumber;
  actualUserEarned: BigNumber;
  referralCommission: BigNumber;
};
