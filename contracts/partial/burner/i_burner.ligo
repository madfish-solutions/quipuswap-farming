type burn_type          is Burn             of (address * nat)

type use_type           is dex_action_type

type storage_type       is [@layout:comb] record [
  pool                    : address; (* LP token *)
  token                   : address; (* FA1.2 or FA2 token *)
]

type action_type        is
  Default

type return_type        is (list(operation) * storage_type)
