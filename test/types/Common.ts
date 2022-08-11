import { BigNumber } from "bignumber.js";

export type FA12Token = string;

export type FA2Token = {
  token: string;
  id: number;
};
export type Tez = undefined;
export type Token = { tez: Tez } | { fa12: FA12Token } | { fa2: FA2Token };

export type PauseFarmParam = {
  fid: number;
  pause: boolean;
};

export type StakeParams = {
  staked_token: Token;
  is_v1_lp: boolean;
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
  claimed: number;
  prev_earned: number;
  prev_staked: number;
  allowances: string[];
};

export type WithdrawData = {
  actualUserWithdraw: BigNumber;
  wirthdrawCommission: BigNumber;
};

export type WithdrawFarmDepoParams = {
  fid: number;
  amt: number;
};

export type BanBakerParam = {
  baker: string;
  period: number;
};

export type Meta = {
  key: string;
  value: string;
};

export type UpdTokMetaParams = {
  token_id: number;
  token_info: Meta[];
};

export type IsV1LP = {
  fid: number;
  is_v1_lp: boolean;
};
