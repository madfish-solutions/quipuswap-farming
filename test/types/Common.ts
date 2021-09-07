export type Token = {
  token: string;
  id: number;
  is_fa2: boolean;
};

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
  qs_pool: Token;
};
