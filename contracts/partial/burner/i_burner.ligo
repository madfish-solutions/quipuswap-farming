type burn_type          is Burn             of (address * nat)

type storage_type       is [@layout:comb] record [
  (* QS GOV token LP address *)
  qsgov_lp                : address;
  (* QS GOV token *)
  qsgov                   : token_type;
]

type burn_callback_type is list(bal_response_type)

type action_type        is
  Default
| Burn_callback           of burn_callback_type

type return_type        is (list(operation) * storage_type)
