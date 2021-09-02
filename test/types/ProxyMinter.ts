import { Token } from "./Common";

export type MintParams = {
  receiver: string;
  amount: number;
};

export type ProxyMinterStorage = {
  farms: string[];
  qsgov: Token;
  admin: string;
  pending_admin: string;
};
