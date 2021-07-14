function only_admin(
  const user            : address;
  const admin           : address)
                        : unit is
  block {
    if user =/= admin
    then failwith("Not-admin")
    else skip;
  } with unit

function only_pending_admin(
  const user            : address;
  const pending_admin   : address)
                        : unit is
  block {
    if user =/= pending_admin
    then failwith("Not-pending-admin")
    else skip;
  } with unit

function get_fa12_token_transfer_entrypoint(
  const token           : address)
                        : contract(fa12_transfer_type) is
  case (
    Tezos.get_entrypoint_opt("%transfer", token)
                        : option(contract(fa12_transfer_type))
  ) of
    Some(contr) -> contr
  | None -> (
    failwith("FA1.2/transfer-entrypoint-404")
                        : contract(fa12_transfer_type)
  )
  end

function get_fa2_token_transfer_entrypoint(
  const token           : address)
                        : contract(fa2_transfer_type) is
  case (
    Tezos.get_entrypoint_opt("%transfer", token)
                        : option(contract(fa2_transfer_type))
  ) of
    Some(contr) -> contr
  | None -> (
    failwith("FA2/transfer-entrypoint-404")
                        : contract(fa2_transfer_type)
  )
  end

function get_quipuswap_use_entrypoint(
  const pool            : address)
                        : contract(use_type) is
  case (
    Tezos.get_entrypoint_opt("%use", pool) : option(contract(use_type))
  ) of
    Some(contr) -> contr
  | None -> (failwith("QS/use-entrypoint-404") : contract(use_type))
  end

function get_qsqov_token_balance_of_entrypoint(
  const token           : address)
                        : contract(balance_of_type) is
  case (
    Tezos.get_entrypoint_opt("%balance_of", token)
                        : option(contract(balance_of_type))
  ) of
    Some(contr) -> contr
  | None -> (
    failwith("QSGOV/balance-of-entrypoint-404")
                        : contract(balance_of_type)
  )
  end
