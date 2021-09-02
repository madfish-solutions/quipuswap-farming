import { MichelsonMap } from "@taquito/michelson-encoder";

import { QSFA2FactoryStorage } from "../../test/types/QSFA2Factory";

import { alice } from "../../scripts/sandbox/accounts";

export const qsFA2FactoryStorage: QSFA2FactoryStorage = {
  counter: 0,
  baker_validator: alice.pkh,
  token_list: MichelsonMap.fromLiteral({}),
  token_to_exchange: MichelsonMap.fromLiteral({}),
  dex_lambdas: MichelsonMap.fromLiteral({}),
  token_lambdas: MichelsonMap.fromLiteral({}),
  voters: MichelsonMap.fromLiteral({}),
  vetos: MichelsonMap.fromLiteral({}),
  votes: MichelsonMap.fromLiteral({}),
  user_rewards: MichelsonMap.fromLiteral({}),
  metadata: MichelsonMap.fromLiteral({}),
  ledger: MichelsonMap.fromLiteral({}),
};
