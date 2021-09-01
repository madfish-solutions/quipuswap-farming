import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

export type FA12Storage = {
  total_supply: number;
  ledger: MichelsonMap<MichelsonMapKey, unknown>;
  metadata: MichelsonMap<MichelsonMapKey, unknown>;
  token_metadata: MichelsonMap<MichelsonMapKey, unknown>;
};
