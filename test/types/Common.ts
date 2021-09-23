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
  qs_pool: FA12Token;
};

export type DepositParams = {
  fid: number;
  amt: number;
  referrer: string | undefined | null;
  rewards_receiver: string;
  candidate: string;
};

export type WithdrawParams = {
  fid: number;
  amt: number;
  receiver: string;
  rewards_receiver: string;
};

export type HarvestParams = {
  fid: number;
  rewards_receiver: string;
};

export type UserInfoType = {
  last_staked: string;
  staked: number;
  earned: number;
  prev_earned: number;
  used_votes: number;
};

export type WithdrawData = {
  actualUserWithdraw: BigNumber;
  wirthdrawCommission: BigNumber;
};

export type WithdrawFarmDepoParams = {
  fid: number;
  amt: number;
};
