import { MichelsonMap } from "@taquito/michelson-encoder";

import { NewFarmParams } from "../test/types/TFarm";

export const farms: NewFarmParams[] = [
  {
    fees: {
      harvest_fee: 5000000000000000,
      withdrawal_fee: 0,
    },
    stake_params: {
      staked_token: {
        fA2: { token: "KT1DaP41e8fk4BsRB2pPk1HXuX3R47dp7mnU", id: 0 },
      },
      is_v1_lp: true,
    },
    token_info: MichelsonMap.fromLiteral({
      name: Buffer.from("TS/TEZ Staking Share").toString("hex"),
      symbol: Buffer.from("QSHR").toString("hex"),
      decimals: Buffer.from("6").toString("hex"),
    }),
    reward_token: {
      fA2: { token: "KT1A2E72tR1abahQgBNi9Lw3LqRDL5eGjjbU", id: 0 },
    },
    paused: false,
    timelock: 0,
    start_time: String(Date.now() / 1000 + 1),
    end_time: String(Date.now() / 1000 + 2592000),
    reward_per_second: 771604940000000,
  },
  {
    fees: {
      harvest_fee: 5000000000000000,
      withdrawal_fee: 0,
    },
    stake_params: {
      staked_token: {
        fA12: "KT1Dr8Qf9at75uEvwN4QnGTNFfPMAr8KL4kK",
      },
      is_v1_lp: true,
    },
    token_info: MichelsonMap.fromLiteral({
      name: Buffer.from("FA12 Staking Share").toString("hex"),
      symbol: Buffer.from("QSHR").toString("hex"),
      decimals: Buffer.from("6").toString("hex"),
    }),
    reward_token: {
      fA2: { token: "KT1A2E72tR1abahQgBNi9Lw3LqRDL5eGjjbU", id: 0 },
    },
    paused: false,
    timelock: 0,
    start_time: String(Date.now() / 1000 + 1),
    end_time: String(Date.now() / 1000 + 2592000),
    reward_per_second: 771604940000000,
  },
];
