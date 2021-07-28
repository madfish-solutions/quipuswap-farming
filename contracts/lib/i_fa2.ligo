type token_id_type      is nat (* Token ID *)

type transfer_dst_type  is [@layout:comb] record [
  (* Recipient of tokens *)
  to_                     : address;
  (* Token ID *)
  token_id                : token_id_type;
  (* Number of tokens to transfer *)
  amount                  : nat;
]

type fa2_send_type      is [@layout:comb] record [
  (* Sender of tokens *)
  from_                   : address;
  (* Transactions *)
  txs                     : list(transfer_dst_type);
]

type fa2_transfer_type  is
FA2_transfer_type         of list(fa2_send_type) (* Transfers list *)

type bal_request_type   is [@layout:comb] record [
  (* Owner of tokens *)
  owner                   : address;
  (* Token ID *)
  token_id                : token_id_type;
]

type bal_response_type  is [@layout:comb] record [
  (* Balance of request *)
  request                 : bal_request_type;
  (* Balance of tokens *)
  balance                 : nat;
]

type balance_of_type    is [@layout:comb] record [
  (* Balance of requests *)
  requests                : list(bal_request_type);
  (* Callback *)
  callback                : contract(list(bal_response_type));
]
