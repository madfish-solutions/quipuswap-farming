import {
  TezosToolkit,
  TransactionOperation,
  OriginationOperation,
  Contract,
} from "@taquito/taquito";

import { execSync } from "child_process";

import fs from "fs";

import env from "../../env";

import { confirmOperation } from "../../scripts/confirmation";

import { getLigo } from "../../scripts/helpers";

import qFarmFunctions from "../../storage/json/QFarmFunctions.json";

import { QFarmStorage } from "../types/QFarm";

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
      this.storage[key] = await maps[key].reduce(async (prev, current) => {
        try {
          return {
            ...(await prev),
            [current]: await storage[key].get(current),
          };
        } catch (ex) {
          return {
            ...(await prev),
            [current]: 0,
          };
        }
      }, Promise.resolve({}));
    }
  }

  async setLambdas(): Promise<void> {
    const ligo: string = getLigo(true);

    for (const qFarmFunction of qFarmFunctions) {
      const stdout: Buffer = execSync(
        `${ligo} compile-parameter --michelson-format=json $PWD/contracts/main/q_farm.ligo main 'Setup_func(record index=${qFarmFunction.index}n; func=${qFarmFunction.name}; end)'`,
        { maxBuffer: 1024 * 500 }
      );
      const operation: TransactionOperation =
        await this.tezos.contract.transfer({
          to: this.contract.address,
          amount: 0,
          parameter: {
            entrypoint: "setup_func",
            value: JSON.parse(stdout.toString()).args[0],
          },
        });

      await confirmOperation(this.tezos, operation.hash);

      console.log(qFarmFunction.name);
    }

    console.log();
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

  async setRewardPerSecond(
    newRewardperSecond: number
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_reward_per_second(newRewardperSecond)
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
}