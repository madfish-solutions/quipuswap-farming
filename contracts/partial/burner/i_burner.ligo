type burn_type          is Burn             of (address * nat)

type storage_type       is [@layout:comb] record [
  (* QS GOV token LP on Quipuswap DEX *)
  qsgov_lp                : address;
  pool_id                 : nat;
  (* QS GOV token *)
  qsgov                   : fa2_type;
]

type burn_callback_type is list(bal_response_type)

type action_type        is
  Default
| Burn_callback           of burn_callback_type

type return_type        is (list(operation) * storage_type)
