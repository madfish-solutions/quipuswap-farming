type burn_type          is Burn             of (address * nat)

type storage_type       is [@layout:comb] record [
  qsgov_lp                : address; (* QS GOV token LP address *)
  qsgov                   : token_type; (* QS GOV token *)
]

type burn_callback_type is list(bal_response_type)

type action_type        is
  Default
| Burn_callback           of burn_callback_type

type return_type        is (list(operation) * storage_type)
