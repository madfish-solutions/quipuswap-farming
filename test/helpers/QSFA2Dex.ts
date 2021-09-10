import { TezosToolkit, Contract } from "@taquito/taquito";

import { QSFA2DexStorage } from "../types/QSFA2Dex";

export class QSFA2Dex {
  contract: Contract;
  storage: QSFA2DexStorage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(
    qsFA2DexAddress: string,
    tezos: TezosToolkit
  ): Promise<QSFA2Dex> {
    return new QSFA2Dex(await tezos.contract.at(qsFA2DexAddress), tezos);
  }

  async updateStorage(maps = {}): Promise<void> {
    const storage: QSFA2DexStorage = await this.contract.storage();

    this.storage = storage;

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
}
