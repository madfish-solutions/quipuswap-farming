import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

export type QSFA2FactoryStorage = {
  counter: number;
  baker_validator: string;
  token_list: MichelsonMap<MichelsonMapKey, unknown>;
  token_to_exchange: MichelsonMap<MichelsonMapKey, unknown>;
  dex_lambdas: MichelsonMap<MichelsonMapKey, unknown>;
  token_lambdas: MichelsonMap<MichelsonMapKey, unknown>;
  voters: MichelsonMap<MichelsonMapKey, unknown>;
  vetos: MichelsonMap<MichelsonMapKey, unknown>;
  votes: MichelsonMap<MichelsonMapKey, unknown>;
  user_rewards: MichelsonMap<MichelsonMapKey, unknown>;
  metadata: MichelsonMap<MichelsonMapKey, unknown>;
  ledger: MichelsonMap<MichelsonMapKey, unknown>;
};
