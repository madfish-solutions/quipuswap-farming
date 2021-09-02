import { TezosToolkit, OriginationOperation, Contract } from "@taquito/taquito";

import fs from "fs";

import { confirmOperation } from "../../scripts/confirmation";

import { QSFA12FactoryStorage } from "../types/QSFA12Factory";

export class QSFA12Factory {
  contract: Contract;
  storage: QSFA12FactoryStorage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(
    qsFA12FactoryAddress: string,
    tezos: TezosToolkit
  ): Promise<QSFA12Factory> {
    return new QSFA12Factory(
      await tezos.contract.at(qsFA12FactoryAddress),
      tezos
    );
  }

  static async originate(
    tezos: TezosToolkit,
    storage: QSFA12FactoryStorage
  ): Promise<QSFA12Factory> {
    const artifacts: any = JSON.parse(
      fs.readFileSync(`test/contracts/qs_fa12_factory.json`).toString()
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

    return new QSFA12Factory(
      await tezos.contract.at(operation.contractAddress),
      tezos
    );
  }

  async updateStorage(maps = {}): Promise<void> {
    const storage: QSFA12FactoryStorage = await this.contract.storage();

    this.storage = storage;

    for (const key in maps) {
      this.storage[key] = await maps[key].reduce(
        async (prev: any, current: any) => {
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
        },
        Promise.resolve({})
      );
    }
  }
}
