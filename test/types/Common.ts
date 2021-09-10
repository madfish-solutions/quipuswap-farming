export type FA12Token = string;

export type FA2Token = {
  token: string;
  id: number;
};

export type Token = { fA12: FA12Token } | { fA2: FA2Token };

export type Fees = {
  harvest_fee: number;
  withdrawal_fee: number;
};

export type SetFeeParams = {
  fid: number;
  fees: Fees;
};

export type StakeParams = {
  staked_token: Token;
  is_lp_staked_token: boolean;
  token: Token;
  qs_pool: FA12Token;
};
