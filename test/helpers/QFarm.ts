import {
  TransactionOperation,
  OriginationOperation,
  WalletOperationBatch,
  WalletParamsWithKind,
  WalletOperation,
  TezosToolkit,
  MichelsonMap,
  Contract,
  OpKind,
} from "@taquito/taquito";

import { BigNumber } from "bignumber.js";

import fs from "fs";

import env from "../../env";

import { confirmOperation } from "../../scripts/confirmation";

import qFarmFunctions from "../../build/lambdas/q_farm_lambdas.json";

import {
  WithdrawFarmDepoParams,
  UpdTokMetaParams,
  PauseFarmParam,
  WithdrawParams,
  DepositParams,
  HarvestParams,
  BanBakerParam,
  WithdrawData,
  UserInfoType,
  StakeParams,
} from "../types/Common";
import {
  NewRewardPerSecond,
  NewFarmParams,
  QFarmStorage,
  SetFeeParams,
  FarmData,
  QFees,
  Farm,
} from "../types/QFarm";
import { TransferParam, UpdateOperatorParam } from "test/types/FA2";

import { Utils, zeroAddress } from "./Utils";

export class QFarm {
  contract: Contract;
  storage: QFarmStorage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(qFarmAddress: string, tezos: TezosToolkit): Promise<QFarm> {
    return new QFarm(await tezos.contract.at(qFarmAddress), tezos);
  }

  static async originate(
    tezos: TezosToolkit,
    storage: QFarmStorage
  ): Promise<QFarm> {
    const artifacts: any = JSON.parse(
      fs.readFileSync(`${env.buildDir}/q_farm.json`).toString()
    );
    const operation: OriginationOperation = await tezos.contract
      .originate({
        code: artifacts.michelson,
        storage: storage,
      })
      .catch((e) => {
        console.error(e);

        return null;
      });

    await confirmOperation(tezos, operation.hash);

    return new QFarm(await tezos.contract.at(operation.contractAddress), tezos);
  }

  async updateStorage(maps = {}): Promise<void> {
    const storage: QFarmStorage = await this.contract.storage();

    this.storage = {
      storage: storage.storage,
      q_farm_lambdas: storage.q_farm_lambdas,
    };

    for (const key in maps) {
      this.storage.storage[key] = await maps[key].reduce(
        async (prev: any, current: any) => {
          try {
            return {
              ...(await prev),
              [current]: await storage.storage[key].get(current),
            };
          } catch (ex) {
            return {
              ...(await prev),
              [current]: 0,
            };
          }
        },
        Promise.resolve({})
      );
    }
  }

  async setLambdas(): Promise<void> {
    let batch1: WalletParamsWithKind[] = [];
    let batch2: WalletParamsWithKind[] = [];

    for (let i = 0; i < qFarmFunctions.length / 2; ++i) {
      batch1.push({
        kind: OpKind.TRANSACTION,
        to: this.contract.address,
        amount: 0,
        parameter: {
          entrypoint: "setup_func",
          value: qFarmFunctions[i],
        },
      });
    }

    for (let i = qFarmFunctions.length / 2; i < qFarmFunctions.length; ++i) {
      batch2.push({
        kind: OpKind.TRANSACTION,
        to: this.contract.address,
        amount: 0,
        parameter: {
          entrypoint: "setup_func",
          value: qFarmFunctions[i],
        },
      });
    }

    let batch: WalletOperationBatch = this.tezos.wallet.batch(batch1);
    let operation: WalletOperation = await batch.send();

    await confirmOperation(this.tezos, operation.opHash);

    batch = this.tezos.wallet.batch(batch2);
    operation = await batch.send();

    await confirmOperation(this.tezos, operation.opHash);
  }

  async default(mutezAmount: number): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .default([])
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setAdmin(newAdmin: string): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_admin(newAdmin)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async confirmAdmin(): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .confirm_admin([])
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setFees(fees: SetFeeParams[]): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_fees(fees)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setRewardPerSecond(
    params: NewRewardPerSecond[]
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_reward_per_second(params)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setBurner(newBurner: string): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_burner(newBurner)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setProxyMinter(newProxyMinter: string): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_proxy_minter(newProxyMinter)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setBakerRegistry(
    newBakerRegistry: string
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_baker_registry(newBakerRegistry)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async banBakers(params: BanBakerParam[]): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .ban_bakers(params)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async addNewFarm(
    newFarmParams: NewFarmParams
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .add_new_farm(...Utils.destructObj(newFarmParams))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async pauseFarms(
    pauseFarmParams: PauseFarmParam[]
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .pause_farms(pauseFarmParams)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async deposit(depositParams: DepositParams): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .deposit(...Utils.destructObj(depositParams))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async withdraw(
    withdrawParams: WithdrawParams
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .withdraw(...Utils.destructObj(withdrawParams))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async harvest(harvestParams: HarvestParams): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .harvest(...Utils.destructObj(harvestParams))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async burnTEZRewards(fid: number): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .burn_tez_rewards(fid)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async burnFarmRewards(fid: number): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .burn_farm_rewards(fid)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async withdrawFarmDepo(
    params: WithdrawFarmDepoParams
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .withdraw_farm_depo(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async transfer(params: TransferParam[]): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .transfer(params)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async updateOperators(
    params: UpdateOperatorParam[]
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .update_operators(params)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async updateTokenMetadata(
    params: UpdTokMetaParams
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .update_token_metadata(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }
}

export class QFarmUtils {
  static async getMockNewFarmParams(utils: Utils): Promise<NewFarmParams> {
    const fees: QFees = {
      harvest_fee: 0,
      withdrawal_fee: 0,
      burn_reward: 0,
    };
    const stakeParams: StakeParams = {
      staked_token: {
        fA2: {
          token: zeroAddress,
          id: 0,
        },
      },
      is_lp_staked_token: false,
      qs_pool: zeroAddress,
    };
    const newFarmParams: NewFarmParams = {
      fees: fees,
      stake_params: stakeParams,
      token_info: MichelsonMap.fromLiteral({}),
      paused: false,
      reward_per_second: 0,
      timelock: 0,
      start_time: String(
        Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000
      ),
    };

    return newFarmParams;
  }

  static getFarmData(
    initialFarm: Farm,
    finalFarm: Farm,
    initialFarmUserRecord: UserInfoType,
    finalFarmUserRecord: UserInfoType,
    precision: number
  ): FarmData {
    const timeLeft: number =
      (Date.parse(finalFarm.upd) - Date.parse(initialFarm.upd)) / 1000;
    const newReward: BigNumber = new BigNumber(
      timeLeft * finalFarm.reward_per_second
    );
    const expectedShareReward: BigNumber = new BigNumber(
      initialFarm.reward_per_share
    ).plus(
      newReward.div(initialFarm.staked).integerValue(BigNumber.ROUND_DOWN)
    );
    const expectedUserPrevEarned: BigNumber = expectedShareReward.multipliedBy(
      finalFarmUserRecord.staked
    );
    const expectedUserEarned: BigNumber = new BigNumber(
      initialFarmUserRecord.earned
    ).plus(
      expectedShareReward
        .multipliedBy(initialFarmUserRecord.staked)
        .minus(initialFarmUserRecord.prev_earned)
    );
    const expectedUserEarnedAfterHarvest: BigNumber = expectedUserEarned.minus(
      expectedUserEarned
        .div(precision)
        .integerValue(BigNumber.ROUND_DOWN)
        .multipliedBy(precision)
    );
    const actualUserBurned: BigNumber = expectedUserEarned
      .div(precision)
      .integerValue(BigNumber.ROUND_DOWN);
    const referralCommission: BigNumber = expectedUserEarned
      .div(precision)
      .integerValue(BigNumber.ROUND_DOWN)
      .multipliedBy(initialFarm.fees.harvest_fee)
      .dividedBy(precision)
      .integerValue(BigNumber.ROUND_DOWN);
    const actualUserEarned: BigNumber = expectedUserEarned
      .div(precision)
      .integerValue(BigNumber.ROUND_DOWN)
      .minus(referralCommission);
    const expectedUserBurnReward: BigNumber = expectedUserEarned
      .div(precision)
      .integerValue(BigNumber.ROUND_DOWN)
      .multipliedBy(initialFarm.fees.burn_reward)
      .dividedBy(precision)
      .integerValue(BigNumber.ROUND_DOWN);
    const burnAmount: BigNumber = expectedUserEarned
      .div(precision)
      .integerValue(BigNumber.ROUND_DOWN)
      .minus(expectedUserBurnReward);

    return {
      expectedShareReward: expectedShareReward,
      expectedUserPrevEarned: expectedUserPrevEarned,
      expectedUserEarned: expectedUserEarned,
      expectedUserEarnedAfterHarvest: expectedUserEarnedAfterHarvest,
      expectedUserBurnReward: expectedUserBurnReward,
      burnAmount: burnAmount,
      actualUserEarned: actualUserEarned,
      actualUserBurned: actualUserBurned,
      referralCommission: referralCommission,
    };
  }

  static getWithdrawData(
    initialFarm: Farm,
    withdrawValue: number,
    precision: number
  ): WithdrawData {
    const wirthdrawCommission: BigNumber = new BigNumber(withdrawValue)
      .multipliedBy(initialFarm.fees.withdrawal_fee)
      .dividedBy(precision)
      .integerValue(BigNumber.ROUND_DOWN);
    const actualUserWithdraw: BigNumber = new BigNumber(withdrawValue).minus(
      wirthdrawCommission
    );

    return {
      actualUserWithdraw: actualUserWithdraw,
      wirthdrawCommission: wirthdrawCommission,
    };
  }
}
