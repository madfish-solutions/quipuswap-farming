import { MichelsonMap } from "@taquito/michelson-encoder";

import { NewFarmParams } from "../test/types/TFarm";

const harvestFee = 5000000000000000; // 0.5%
const rewardPerSecond = 1169098400000000; // ≈100 tokens per day
const lifetime = 10510000; // ≈4 months
const fifteenMinutes = 900;

export const ithacanetFarms: NewFarmParams[] = [
  {
    fees: {
      harvest_fee: harvestFee,
      withdrawal_fee: 0,
    },
    stake_params: {
      staked_token: {
        fA2: { token: "KT1PDsZcMs7QuixpeGHTPpi14s2SF1RhiTSM", id: 0 },
      },
      is_v2_lp: true,
    },
    token_info: MichelsonMap.fromLiteral({
      name: Buffer.from("wWBTC/TEZ FA2 Staking Share").toString("hex"),
      symbol: Buffer.from("QSHR").toString("hex"),
      decimals: Buffer.from("6").toString("hex"),
    }),
    reward_token: {
      fA2: { token: "KT19363aZDTjeRyoDkSLZhCk62pS4xfvxo6c", id: 0 },
    },
    paused: false,
    timelock: 0,
    start_time: String(Math.ceil(Date.now() / 1000)),
    end_time: String(Math.floor(Date.now() / 1000) + lifetime + 1),
    reward_per_second: rewardPerSecond * 10 ** 3,
  },
  {
    fees: {
      harvest_fee: harvestFee,
      withdrawal_fee: 0,
    },
    stake_params: {
      staked_token: {
        fA12: "KT1W6RyVDyGLwazwfJCphcYwb4g2Ltr82ebg",
      },
      is_v2_lp: true,
    },
    token_info: MichelsonMap.fromLiteral({
      name: Buffer.from("Apple/TEZ FA12 Staking Share").toString("hex"),
      symbol: Buffer.from("QSHR").toString("hex"),
      decimals: Buffer.from("6").toString("hex"),
    }),
    reward_token: {
      fA2: { token: "KT19363aZDTjeRyoDkSLZhCk62pS4xfvxo6c", id: 0 },
    },
    paused: false,
    timelock: 0,
    start_time: String(Math.ceil(Date.now() / 1000)),
    end_time: String(Math.floor(Date.now() / 1000) + lifetime + 1),
    reward_per_second: rewardPerSecond * 10 ** 3,
  },
  {
    fees: {
      harvest_fee: harvestFee,
      withdrawal_fee: 0,
    },
    stake_params: {
      staked_token: {
        fA2: { token: "KT1PnmpVWmA5CBUsA5ZAx1HoDW67mPYurAL5", id: 19 },
      },
      is_v2_lp: false,
    },
    token_info: MichelsonMap.fromLiteral({
      name: Buffer.from("GOLD/QUIPU FA2 Staking Share").toString("hex"),
      symbol: Buffer.from("QSHR").toString("hex"),
      decimals: Buffer.from("6").toString("hex"),
    }),
    reward_token: {
      fA2: { token: "KT1XH2e9mwvZmR7NBcx1qwskZKxePtMwheak", id: 0 },
    },
    paused: false,
    timelock: 0,
    start_time: String(Math.ceil(Date.now() / 1000)),
    end_time: String(Math.floor(Date.now() / 1000) + lifetime + 1),
    reward_per_second: rewardPerSecond * 10 ** 10,
  },
  {
    fees: {
      harvest_fee: harvestFee,
      withdrawal_fee: 0,
    },
    stake_params: {
      staked_token: {
        fA2: { token: "KT1SMhGgVwhm2JQjU4hDcpt4w1p7brxxFRPD", id: 0 },
      },
      is_v2_lp: false,
    },
    token_info: MichelsonMap.fromLiteral({
      name: Buffer.from("wWBTC FA2 Staking Share").toString("hex"),
      symbol: Buffer.from("QSHR").toString("hex"),
      decimals: Buffer.from("8").toString("hex"),
    }),
    reward_token: {
      fA2: { token: "KT19363aZDTjeRyoDkSLZhCk62pS4xfvxo6c", id: 0 },
    },
    paused: false,
    timelock: 0,
    start_time: String(Math.ceil(Date.now() / 1000)),
    end_time: String(Math.floor(Date.now() / 1000) + lifetime + 1),
    reward_per_second: rewardPerSecond * 10 ** 3,
  },
  {
    fees: {
      harvest_fee: harvestFee,
      withdrawal_fee: 0,
    },
    stake_params: {
      staked_token: {
        fA12: "KT1BRxbKjhRabGSB6saqK6QrBenaSvFJSgHu",
      },
      is_v2_lp: false,
    },
    token_info: MichelsonMap.fromLiteral({
      name: Buffer.from("Apple FA12 Staking Share").toString("hex"),
      symbol: Buffer.from("QSHR").toString("hex"),
      decimals: Buffer.from("10").toString("hex"),
    }),
    reward_token: {
      fA2: { token: "KT19363aZDTjeRyoDkSLZhCk62pS4xfvxo6c", id: 0 },
    },
    paused: false,
    timelock: 0,
    start_time: String(Math.ceil(Date.now() / 1000)),
    end_time: String(Math.floor(Date.now() / 1000) + lifetime + 1),
    reward_per_second: rewardPerSecond * 10 ** 3,
  },
  {
    fees: {
      harvest_fee: harvestFee,
      withdrawal_fee: 0,
    },
    stake_params: {
      staked_token: {
        fA12: "KT1PzyU2nXYW8RkoFqmqWPFCA7bgC7yGNRoC",
      },
      is_v2_lp: false,
    },
    token_info: MichelsonMap.fromLiteral({
      name: Buffer.from("GOLD FA12 Staking Share").toString("hex"),
      symbol: Buffer.from("QSHR").toString("hex"),
      decimals: Buffer.from("10").toString("hex"),
    }),
    reward_token: {
      fA12: "KT1BRxbKjhRabGSB6saqK6QrBenaSvFJSgHu",
    },
    paused: false,
    timelock: 0,
    start_time: String(Math.ceil(Date.now() / 1000)),
    end_time: String(Math.floor(Date.now() / 1000) + fifteenMinutes + 1),
    reward_per_second: rewardPerSecond * 10 ** 10,
  },
];

export const hangzhounetFarms: NewFarmParams[] = [
  {
    fees: {
      harvest_fee: harvestFee,
      withdrawal_fee: 0,
    },
    stake_params: {
      staked_token: {
        fA2: { token: "KT1DaP41e8fk4BsRB2pPk1HXuX3R47dp7mnU", id: 0 },
      },
      is_v2_lp: true,
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
    reward_per_second: rewardPerSecond * 10 ** 3,
  },
  {
    fees: {
      harvest_fee: harvestFee,
      withdrawal_fee: 0,
    },
    stake_params: {
      staked_token: {
        fA12: "KT1Ds5C4KNLMi9g7hy4hf29GKfdR3MYSFaMn",
      },
      is_v2_lp: true,
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
    reward_per_second: rewardPerSecond * 10 ** 3,
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
      is_v2_lp: false,
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
    reward_per_second: rewardPerSecond * 10 ** 10,
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
      is_v2_lp: false,
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
    reward_per_second: rewardPerSecond * 10 ** 3,
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
      is_v2_lp: false,
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
    reward_per_second: rewardPerSecond * 10 ** 3,
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
      is_v2_lp: false,
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
    end_time: String(Math.floor(Date.now() / 1000) + fifteenMinutes + 1),
    reward_per_second: rewardPerSecond * 10 ** 10,
  },
];
