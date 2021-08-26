import { TezosToolkit, OriginationOperation, Contract } from "@taquito/taquito";

import fs from "fs";

import env from "../../env";

import { confirmOperation } from "../../scripts/confirmation";

import { ProxyMinterStorage } from "../types/ProxyMinter";

export class ProxyMinter {
  contract: Contract;
  storage: ProxyMinterStorage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(
    proxyMinterAddress: string,
    tezos: TezosToolkit
  ): Promise<ProxyMinter> {
    return new ProxyMinter(await tezos.contract.at(proxyMinterAddress), tezos);
  }

  static async originate(
    tezos: TezosToolkit,
    storage: ProxyMinterStorage
  ): Promise<ProxyMinter> {
    const artifacts: any = JSON.parse(
      fs.readFileSync(`${env.buildDir}/proxy_minter.json`).toString()
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

    return new ProxyMinter(
      await tezos.contract.at(operation.contractAddress),
      tezos
    );
  }

  async updateStorage(): Promise<void> {
    const storage: ProxyMinterStorage = await this.contract.storage();

    this.storage = storage;
  }
}
