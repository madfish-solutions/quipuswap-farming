import {
  TransactionOperation,
  OriginationOperation,
  WalletOperationBatch,
  WalletParamsWithKind,
  WalletOperation,
  TezosToolkit,
  Contract,
  OpKind,
} from "@taquito/taquito";

import { execSync } from "child_process";

import { BigNumber } from "bignumber.js";

import fs from "fs";

import env from "../../env";

import { confirmOperation } from "../../scripts/confirmation";

import { getLigo } from "../../scripts/helpers";

import tFarmFunctions from "../../storage/json/TFarmFunctions.json";

import {
  PauseFarmParam,
  WithdrawParams,
  DepositParams,
  HarvestParams,
  UserInfoType,
  WithdrawData,
  StakeParams,
} from "../types/Common";
import {
  WithdrawFarmDepoParams,
  NewFarmParams,
  SetFeeParams,
  TFarmStorage,
  FarmData,
  TFees,
  Farm,
} from "../types/TFarm";

import { Utils, zeroAddress } from "./Utils";

export class TFarm {
  contract: Contract;
  storage: TFarmStorage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(tFarmAddress: string, tezos: TezosToolkit): Promise<TFarm> {
    return new TFarm(await tezos.contract.at(tFarmAddress), tezos);
  }

  static async originate(
    tezos: TezosToolkit,
    storage: TFarmStorage
  ): Promise<TFarm> {
    const artifacts: any = JSON.parse(
      fs.readFileSync(`${env.buildDir}/t_farm.json`).toString()
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

    return new TFarm(await tezos.contract.at(operation.contractAddress), tezos);
  }

  async updateStorage(maps = {}): Promise<void> {
    const storage: TFarmStorage = await this.contract.storage();

    this.storage = {
      storage: storage.storage,
      t_farm_lambdas: storage.t_farm_lambdas,
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
    const ligo: string = getLigo(true);
    let params: WalletParamsWithKind[] = [];

    for (const tFarmFunction of tFarmFunctions) {
      const stdout: Buffer = execSync(
        `${ligo} compile-parameter --michelson-format=json $PWD/contracts/main/t_farm.ligo main 'Setup_func(record index=${tFarmFunction.index}n; func=${tFarmFunction.name}; end)'`,
        { maxBuffer: 1024 * 500 }
      );

      params.push({
        kind: OpKind.TRANSACTION,
        to: this.contract.address,
        amount: 0,
        parameter: {
          entrypoint: "setup_func",
          value: JSON.parse(stdout.toString()).args[0],
        },
      });

      console.log(tFarmFunction.name);
    }

    console.log();

    const batch: WalletOperationBatch = this.tezos.wallet.batch(params);
    const operation: WalletOperation = await batch.send();

    await confirmOperation(this.tezos, operation.opHash);
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

  async setBurner(newBurner: string): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_burner(newBurner)
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

  async burnXTZRewards(fid: number): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .burn_xtz_rewards(fid)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async claimFarmRewards(fid: number): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .claim_farm_rewards(fid)
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
}

export class TFarmUtils {
  static async getMockNewFarmParams(utils: Utils): Promise<NewFarmParams> {
    const time: string = String(
      Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000
    );
    const fees: TFees = {
      harvest_fee: 0,
      withdrawal_fee: 0,
    };
    const stakeParams: StakeParams = {
      staked_token: {
        fA12: zeroAddress,
      },
      is_lp_staked_token: false,
      token: {
        fA12: zeroAddress,
      },
      qs_pool: zeroAddress,
    };
    const newFarmParams: NewFarmParams = {
      fees: fees,
      stake_params: stakeParams,
      reward_token: {
        fA12: zeroAddress,
      },
      paused: false,
      timelock: 0,
      start_time: time,
      end_time: time,
      reward_per_second: 0,
    };

    return newFarmParams;
  }

  static getFarmData(
    initialFarm: Farm,
    finalFarm: Farm,
    initialFarmUserRecord: UserInfoType,
    finalFarmUserRecord: UserInfoType,
    precision: number,
    feePrecision: number
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
    const actualUserEarned: BigNumber = expectedUserEarned
      .div(precision)
      .integerValue(BigNumber.ROUND_DOWN)
      .multipliedBy(100 * feePrecision - finalFarm.fees.harvest_fee)
      .div(100)
      .integerValue(BigNumber.ROUND_DOWN)
      .div(feePrecision)
      .integerValue(BigNumber.ROUND_DOWN);
    const actualUserBurned: BigNumber = expectedUserEarned
      .div(precision)
      .integerValue(BigNumber.ROUND_DOWN);
    const referralCommission: BigNumber = expectedUserEarned
      .div(precision)
      .integerValue(BigNumber.ROUND_DOWN)
      .minus(actualUserEarned);

    return {
      expectedShareReward: expectedShareReward,
      expectedUserPrevEarned: expectedUserPrevEarned,
      expectedUserEarned: expectedUserEarned,
      expectedUserEarnedAfterHarvest: expectedUserEarnedAfterHarvest,
      actualUserEarned: actualUserEarned,
      actualUserBurned: actualUserBurned,
      referralCommission: referralCommission,
    };
  }

  static getWithdrawData(
    initialFarm: Farm,
    withdrawValue: number,
    feePrecision: number
  ): WithdrawData {
    const actualUserWithdraw: BigNumber = new BigNumber(withdrawValue)
      .multipliedBy(100 * feePrecision - initialFarm.fees.withdrawal_fee)
      .div(100)
      .integerValue(BigNumber.ROUND_DOWN)
      .div(feePrecision)
      .integerValue(BigNumber.ROUND_DOWN);
    const wirthdrawCommission: BigNumber = new BigNumber(withdrawValue).minus(
      actualUserWithdraw
    );

    return {
      actualUserWithdraw: actualUserWithdraw,
      wirthdrawCommission: wirthdrawCommission,
    };
  }
}
