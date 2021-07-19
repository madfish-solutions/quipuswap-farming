(* Util to check if user has admin access *)
function only_admin(
  const user            : address;
  const admin           : address)
                        : unit is
  block {
    if user =/= admin
    then failwith("Not-admin")
    else skip;
  } with unit

(* Util to check if user has pending admin access *)
function only_pending_admin(
  const user            : address;
  const pending_admin   : address)
                        : unit is
  block {
    if user =/= pending_admin
    then failwith("Not-pending-admin")
    else skip;
  } with unit

(* Util to get FA1.2 token %transfer entrypoint *)
function get_fa12_token_transfer_entrypoint(
  const token           : address)
                        : contract(fa12_transfer_type) is
  case (
    Tezos.get_entrypoint_opt("%transfer", token)
                        : option(contract(fa12_transfer_type))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("FA1.2/transfer-entrypoint-404")
                        : contract(fa12_transfer_type)
  )
  end

(* Util to get FA2 token %transfer entrypoint *)
function get_fa2_token_transfer_entrypoint(
  const token           : address)
                        : contract(fa2_transfer_type) is
  case (
    Tezos.get_entrypoint_opt("%transfer", token)
                        : option(contract(fa2_transfer_type))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("FA2/transfer-entrypoint-404")
                        : contract(fa2_transfer_type)
  )
  end

(* Util to get FA2 token %balance_of entrypoint *)
function get_fa2_token_balance_of_entrypoint(
  const token           : address)
                        : contract(balance_of_type) is
  case (
    Tezos.get_entrypoint_opt("%balance_of", token)
                        : option(contract(balance_of_type))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("FA2/balance-of-entrypoint-404")
                        : contract(balance_of_type)
  )
  end

(* Util to get Quipuswap %use entrypoint *)
function get_quipuswap_use_entrypoint(
  const pool            : address)
                        : contract(use_type) is
  case (
    Tezos.get_entrypoint_opt("%use", pool) : option(contract(use_type))
  ) of
    Some(contr) -> contr
  | None        -> (failwith("QS/use-entrypoint-404") : contract(use_type))
  end

(* Util to get FA2 token balance by ID and owner *)
function get_fa2_token_balance(
  const response        : list(bal_response_type);
  const owner           : address;
  const token_id        : token_id_type)
                        : nat is
  block {
    (* Get balance of FA2 token with specified ID *)
    function get_balance(
      var tmp           : get_balance_type;
      const v           : bal_response_type)
                        : get_balance_type is
      block {
        (* Prepare data to compare with response *)
        const request : bal_request_type = record [
          token_id = token_id;
          owner    = owner;
        ];

        (* Check if response data has specified token balance  *)
        if not tmp.flag and v.request = request
        then {
          tmp.balance := v.balance;
          tmp.flag := True;
        }
        else skip;
      } with tmp;

    (* Get specified FA2 token balance in list of %balance_of responses *)
    const tmp : get_balance_type = List.fold(
      get_balance,
      response,
      record [
        balance = 0n;
        flag    = False;
      ]
    );
  } with tmp.balance
