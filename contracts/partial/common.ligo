function only_admin(
  const admin           : address)
                        : unit is
  block {
    if Tezos.sender =/= admin
    then failwith("Not-admin")
    else skip;
  } with unit

function only_pending_admin(
  const pending_admin   : address)
                        : unit is
  block {
    if Tezos.sender =/= pending_admin
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
  | None        -> (
    failwith("QSystem/fa12-transfer-entrypoint-404")
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
  | None        -> (
    failwith("QSystem/fa2-transfer-entrypoint-404")
                        : contract(fa2_transfer_type)
  )
  end

function get_fa12_token_approve_entrypoint(
  const token           : address)
                        : contract(fa12_approve_type) is
  case (
    Tezos.get_entrypoint_opt("%approve", token)
                        : option(contract(fa12_approve_type))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("QSystem/fa12-approve-entrypoint-404")
                        : contract(fa12_approve_type)
  )
  end

function get_fa2_token_approve_entrypoint(
  const token           : address)
                        : contract(fa2_approve_type) is
  case (
    Tezos.get_entrypoint_opt("%update_operators", token)
                        : option(contract(fa2_approve_type))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("QSystem/fa2-approve-entrypoint-404")
                        : contract(fa2_approve_type)
  )
  end

function get_fa12_token_balance_of_entrypoint(
  const token           : address)
                        : contract(fa12_balance_type) is
  case (
    Tezos.get_entrypoint_opt("%getBalance", token)
                        : option(contract(fa12_balance_type))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("QSystem/fa12-balance-of-entrypoint-404")
                        : contract(fa12_balance_type)
  )
  end

function get_fa2_token_balance_of_entrypoint(
  const token           : address)
                        : contract(balance_of_type) is
  case (
    Tezos.get_entrypoint_opt("%balance_of", token)
                        : option(contract(balance_of_type))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("QSystem/fa2-balance-of-entrypoint-404")
                        : contract(balance_of_type)
  )
  end

function get_quipuswap_use_entrypoint(
  const pool            : address)
                        : contract(use_type) is
  case (
    Tezos.get_entrypoint_opt("%use", pool) : option(contract(use_type))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("QSystem/quipuswap-use-entrypoint-404")
                        : contract(use_type)
  )
  end

function wrap_fa12_transfer_trx(
  const from_           : address;
  const to_             : address;
  const amt             : nat)
                        : fa12_transfer_type is
  FA12_transfer_type(from_, (to_, amt))

function wrap_fa2_transfer_trx(
  const from_           : address;
  const to_             : address;
  const amt             : nat;
  const id              : nat)
                        : fa2_transfer_type is
  FA2_transfer_type(list [
    record [
      from_ = from_;
      txs = list [
        record [
          to_ = to_;
          token_id = id;
          amount = amt;
        ]
      ]
    ]
  ])

function transfer_fa12(
  const from_           : address;
  const to_             : address;
  const amt             : nat;
  const token           : address)
                        : operation is
  Tezos.transaction(
    wrap_fa12_transfer_trx(from_, to_, amt),
    0mutez,
    get_fa12_token_transfer_entrypoint(token)
  )

function transfer_fa2(
  const from_           : address;
  const to_             : address;
  const amt             : nat;
  const token           : address;
  const id              : nat)
                        : operation is
  Tezos.transaction(
    wrap_fa2_transfer_trx(from_, to_, amt, id),
    0mutez,
    get_fa2_token_transfer_entrypoint(token)
  );

function transfer_token(
  const from_           : address;
  const to_             : address;
  const amt             : nat;
  const token           : token_type)
                        : operation is
  case token of
    FA12(token) -> transfer_fa12(from_, to_, amt, token)
  | FA2(token)  -> transfer_fa2(from_, to_, amt, token.token, token.id)
  end


function append_op(const op : operation; const acc : list(operation)) : list(operation) is op # acc

function merge_ops(const first : list(operation); const second: list(operation)) : list(operation)
    is List.fold_right(append_op, second, first)

[@inline]
function ediv_or_fail(
  const numerator       : nat;
  const denominator     : nat)
                        : (nat * nat) is
  case ediv(numerator, denominator) of
    | Some(result) -> result
    | None -> failwith("ediv-or-fail-error")
  end;

[@inline]
function is_nat_or_fail(const number : int) : nat is
  case is_nat(number) of 
    | Some(n) -> n
    | None -> failwith("not-a-nat")
  end;

[@inline]
function unwrap_or_get_burn_address(const addr : option(address)) : address is
  case addr of
    | Some(a) -> a
    | None    -> zero_address
  end;