import {
  TezosToolkit,
  OriginationOperation,
  WalletOperationBatch,
  WalletOperation,
  Contract,
  OpKind,
} from "@taquito/taquito";

import { execSync } from "child_process";

import fs from "fs";

import env from "../../env";

import { confirmOperation } from "../../scripts/confirmation";

import { getLigo } from "../../scripts/helpers";

import tFarmFunctions from "../../storage/json/TFarmFunctions.json";

import { TFarmStorage } from "../types/TFarm";

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
    let params: any[] = [];

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
}
