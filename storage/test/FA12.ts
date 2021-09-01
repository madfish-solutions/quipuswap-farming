import { MichelsonMap } from "@taquito/michelson-encoder";

import { FA12Storage } from "../../test/types/FA12";

import { alice, bob } from "../../scripts/sandbox/accounts";

const totalSupply: number = 100_000_000_000;

export const fa12torage: FA12Storage = {
  total_supply: totalSupply,
  ledger: MichelsonMap.fromLiteral({
    [alice.pkh]: {
      balance: totalSupply / 2,
      allowances: MichelsonMap.fromLiteral({}),
    },
    [bob.pkh]: {
      balance: totalSupply / 2,
      allowances: MichelsonMap.fromLiteral({}),
    },
  }),
  metadata: MichelsonMap.fromLiteral({}),
  token_metadata: MichelsonMap.fromLiteral({}),
};
