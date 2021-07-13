type token_id_type      is nat (* Token ID *)

type transfer_dst_type  is [@layout:comb] record [
  to_                     : address; (* Recipient of tokens *)
  token_id                : token_id_type; (* Token ID *)
  amount                  : nat; (* Number of tokens to transfer *)
]

type fa2_send_type      is [@layout:comb] record [
  from_                   : address; (* Sender of tokens *)
  txs                     : list(transfer_dst_type); (* Transactions *)
]

type fa2_transfer_type  is
FA2_transfer_type         of list(fa2_send_type) (* Transfers list *)

type bal_request_type   is [@layout:comb] record [
  owner                   : address; (* Owner of tokens *)
  token_id                : token_id_type; (* Token ID *)
]

type bal_response_type  is [@layout:comb] record [
  request                 : bal_request_type; (* Balance of request *)
  balance                 : nat; (* Balance of tokens *)
]

type balance_type       is [@layout:comb] record [
  requests                : list(bal_request_type); (* Balance of requests *)
  callback                : contract(list(bal_response_type)); (* Callback *)
]
