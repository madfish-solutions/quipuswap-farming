import { TezosToolkit, OriginationOperation, Contract } from "@taquito/taquito";

import fs from "fs";

import env from "../../env";

import { confirmOperation } from "../../scripts/confirmation";

import { BurnerStorage } from "../types/Burner";

export class Burner {
  contract: Contract;
  storage: BurnerStorage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(
    burnerAddress: string,
    tezos: TezosToolkit
  ): Promise<Burner> {
    return new Burner(await tezos.contract.at(burnerAddress), tezos);
  }

  static async originate(
    tezos: TezosToolkit,
    storage: BurnerStorage
  ): Promise<Burner> {
    const artifacts: any = JSON.parse(
      fs.readFileSync(`${env.buildDir}/burner.json`).toString()
    );
    const operation: OriginationOperation = await tezos.contract
      .originate({
        code: artifacts.michelson,
        storage: storage,
      })
      .catch((e) => {
        console.error(JSON.stringify(e));

        return null;
      });

    await confirmOperation(tezos, operation.hash);

    return new Burner(
      await tezos.contract.at(operation.contractAddress),
      tezos
    );
  }

  async updateStorage(): Promise<void> {
    const storage: BurnerStorage = await this.contract.storage();

    this.storage = storage;
  }
}
