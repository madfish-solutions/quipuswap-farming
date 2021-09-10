import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

export type QSFA2DexStorage = {
  storage: {
    token_id: number;
    tez_pool: number;
    token_pool: number;
    token_address: string;
    baker_validator: string;
    total_supply: number;
    ledger: MichelsonMap<MichelsonMapKey, unknown>;
    voters: MichelsonMap<MichelsonMapKey, unknown>;
    vetos: MichelsonMap<MichelsonMapKey, unknown>;
    votes: MichelsonMap<MichelsonMapKey, unknown>;
    veto: number;
    last_veto: string;
    current_delegated: string | null | undefined;
    current_candidate: string | null | undefined;
    total_votes: number;
    reward: number;
    total_reward: number;
    reward_paid: number;
    reward_per_share: number;
    reward_per_sec: number;
    last_update_time: string;
    period_finish: string;
    user_rewards: MichelsonMap<MichelsonMapKey, unknown>;
  };
  dex_lambdas: MichelsonMap<MichelsonMapKey, unknown>;
  metadata: MichelsonMap<MichelsonMapKey, unknown>;
  token_lambdas: MichelsonMap<MichelsonMapKey, unknown>;
};
