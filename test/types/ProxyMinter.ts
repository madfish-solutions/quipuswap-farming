import { FA2Token } from "./Common";

export type MintParams = {
  receiver: string;
  amount: number;
};

export type ProxyMinterStorage = {
  farms: string[];
  qsgov: FA2Token;
  admin: string;
  pending_admin: string;
};
