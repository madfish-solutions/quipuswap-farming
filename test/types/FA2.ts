import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

export type OperatorParam = {
  owner: string;
  operator: string;
  token_id: number;
};

export type UpdateOperatorParam =
  | { add_operator: OperatorParam }
  | { remove_operator: OperatorParam };

export type Minter = {
  minter: string;
  share: number;
};

export type MintGovTokenParams = {
  receiver: string;
  amount: number;
};

export type BalanceRequest = {
  owner: string;
  token_id: number;
};

export type BalanceResponse = {
  request: BalanceRequest;
  balance: number;
};

export type FA2Storage = {
  account_info: MichelsonMap<MichelsonMapKey, unknown>;
  token_info: MichelsonMap<MichelsonMapKey, unknown>;
  metadata: MichelsonMap<MichelsonMapKey, unknown>;
  token_metadata: MichelsonMap<MichelsonMapKey, unknown>;
  minters_info: MichelsonMap<MichelsonMapKey, unknown>;
  last_token_id: number;
  admin: string;
  permit_counter: number;
  permits: MichelsonMap<MichelsonMapKey, unknown>;
  default_expiry: number;
  total_minter_shares: number;
};
