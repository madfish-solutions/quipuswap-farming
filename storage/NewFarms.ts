import { MichelsonMap } from "@taquito/michelson-encoder";

import { NewFarmParams } from "../test/types/TFarm";

const harvestFee = 5000000000000000; // 0.05%
const rewardPerSecond = 1169098400000000; // ≈100 tokens per day
const lifetime = 10510000; // ≈4 months
const fiveDays = 432000;

export const farms: NewFarmParams[] = [
  {
    fees: {
      harvest_fee: harvestFee,
      withdrawal_fee: 0,
    },
    stake_params: {
      staked_token: {
        fA2: { token: "KT1DaP41e8fk4BsRB2pPk1HXuX3R47dp7mnU", id: 0 },
      },
      is_v1_lp: true,
    },
    token_info: MichelsonMap.fromLiteral({
      name: Buffer.from("TOK/TEZ FA2 Staking Share").toString("hex"),
      symbol: Buffer.from("QSHR").toString("hex"),
      decimals: Buffer.from("6").toString("hex"),
    }),
    reward_token: {
      fA2: { token: "KT1A2E72tR1abahQgBNi9Lw3LqRDL5eGjjbU", id: 0 },
    },
    paused: false,
    timelock: 0,
    start_time: String(Math.ceil(Date.now() / 1000)),
    end_time: String(Math.floor(Date.now() / 1000) + lifetime + 1),
    reward_per_second: rewardPerSecond,
  },
  {
    fees: {
      harvest_fee: harvestFee,
      withdrawal_fee: 0,
    },
    stake_params: {
      staked_token: {
        fA12: "KT1Bbw7zHCVrxScig2YZfsHyhqd7s6vU693R",
      },
      is_v1_lp: true,
    },
    token_info: MichelsonMap.fromLiteral({
      name: Buffer.from("TOK/TEZ FA12 Staking Share").toString("hex"),
      symbol: Buffer.from("QSHR").toString("hex"),
      decimals: Buffer.from("6").toString("hex"),
    }),
    reward_token: {
      fA2: { token: "KT1A2E72tR1abahQgBNi9Lw3LqRDL5eGjjbU", id: 0 },
    },
    paused: false,
    timelock: 0,
    start_time: String(Math.ceil(Date.now() / 1000)),
    end_time: String(Math.floor(Date.now() / 1000) + lifetime + 1),
    reward_per_second: rewardPerSecond,
  },
  {
    fees: {
      harvest_fee: harvestFee,
      withdrawal_fee: 0,
    },
    stake_params: {
      staked_token: {
        fA2: { token: "KT1Ni6JpXqGyZKXhJCPQJZ9x5x5bd7tXPNPC", id: 19 },
      },
      is_v1_lp: false,
    },
    token_info: MichelsonMap.fromLiteral({
      name: Buffer.from("TOK/TOK FA2 Staking Share").toString("hex"),
      symbol: Buffer.from("QSHR").toString("hex"),
      decimals: Buffer.from("6").toString("hex"),
    }),
    reward_token: {
      fA12: "KT1QsWm7ir2oDH7jibxuyzQ4Xz5kFtXa8MHg",
    },
    paused: false,
    timelock: 0,
    start_time: String(Math.ceil(Date.now() / 1000)),
    end_time: String(Math.floor(Date.now() / 1000) + lifetime + 1),
    reward_per_second: rewardPerSecond,
  },
  {
    fees: {
      harvest_fee: harvestFee,
      withdrawal_fee: 0,
    },
    stake_params: {
      staked_token: {
        fA2: { token: "KT1UF2uAyzVWbvL9GkcEKL8yBwbd9sYCnXbP", id: 0 },
      },
      is_v1_lp: false,
    },
    token_info: MichelsonMap.fromLiteral({
      name: Buffer.from("Single FA2 Staking Share").toString("hex"),
      symbol: Buffer.from("QSHR").toString("hex"),
      decimals: Buffer.from("3").toString("hex"),
    }),
    reward_token: {
      fA2: { token: "KT1A2E72tR1abahQgBNi9Lw3LqRDL5eGjjbU", id: 0 },
    },
    paused: false,
    timelock: 0,
    start_time: String(Math.ceil(Date.now() / 1000)),
    end_time: String(Math.floor(Date.now() / 1000) + lifetime + 1),
    reward_per_second: rewardPerSecond,
  },
  {
    fees: {
      harvest_fee: harvestFee,
      withdrawal_fee: 0,
    },
    stake_params: {
      staked_token: {
        fA12: "KT1XagM9vnERYjraxfz8u43NCT3mGtFR7A8H",
      },
      is_v1_lp: false,
    },
    token_info: MichelsonMap.fromLiteral({
      name: Buffer.from("Single FA12 Staking Share").toString("hex"),
      symbol: Buffer.from("QSHR").toString("hex"),
      decimals: Buffer.from("10").toString("hex"),
    }),
    reward_token: {
      fA2: { token: "KT1A2E72tR1abahQgBNi9Lw3LqRDL5eGjjbU", id: 0 },
    },
    paused: false,
    timelock: 0,
    start_time: String(Math.ceil(Date.now() / 1000)),
    end_time: String(Math.floor(Date.now() / 1000) + lifetime + 1),
    reward_per_second: rewardPerSecond,
  },
  {
    fees: {
      harvest_fee: harvestFee,
      withdrawal_fee: 0,
    },
    stake_params: {
      staked_token: {
        fA12: "KT1XagM9vnERYjraxfz8u43NCT3mGtFR7A8H",
      },
      is_v1_lp: false,
    },
    token_info: MichelsonMap.fromLiteral({
      name: Buffer.from("Single FA12 Staking Share").toString("hex"),
      symbol: Buffer.from("QSHR").toString("hex"),
      decimals: Buffer.from("10").toString("hex"),
    }),
    reward_token: {
      fA12: "KT1QsWm7ir2oDH7jibxuyzQ4Xz5kFtXa8MHg",
    },
    paused: false,
    timelock: 0,
    start_time: String(Math.ceil(Date.now() / 1000)),
    end_time: String(Math.floor(Date.now() / 1000) + fiveDays + 1),
    reward_per_second: rewardPerSecond,
  },
];
