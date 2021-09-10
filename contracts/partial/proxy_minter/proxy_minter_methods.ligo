(* Add or remove a minter *)
function add_minter(
  const params          : add_minter_type;
  var s                 : storage_type)
                        : return_type is
  block {
    (* Check of admin permissions *)
    only_admin(s.admin);

    (* Add or remove a minter *)
    s.minters := Set.update(params.minter, params.register, s.minters);
  } with (no_operations, s)

(* Create transaction for GS GOV tokens minting and send it *)
function mint_tokens(
  const params          : mint_gov_toks_type;
  var s                 : storage_type)
                        : return_type is
  block {
    (* Check if transaction sender is a registered minter *)
    if not Set.mem(Tezos.sender, s.minters)
    then failwith("ProxyMinter/sender-is-not-a-minter")
    else skip;
  } with (list [
      (* Mint QS GOV tokens transaction *)
      Tezos.transaction(
        params,
        0mutez,
        get_mint_qsgov_tokens_entrypoint(s.qsgov.token)
      )
    ], s)

(*
  Withdraw QS GOV tokens minted to this proxy minter in result of calling
  QS GOV token's mint entrypoint by other minters
*)
function withdraw_tokens(
  const amt             : withdraw_type;
  var s                 : storage_type)
                        : return_type is
  block {
    (* Check of admin permissions *)
    only_admin(s.admin);

    (* Operations to be performed *)
    var operations : list(operation) := no_operations;

    (* Withdraw QS GOV tokens only if amount greater than 0 *)
    if amt > 0n
    then {
      (* Create params to transfer QS GOV tokens to admin address *)
      const dst : transfer_dst_type = record [
        to_      = s.admin;
        token_id = s.qsgov.id;
        amount   = amt;
      ];
      const fa2_transfer_param : fa2_send_type = record [
        from_ = Tezos.self_address;
        txs   = list [dst];
      ];

      (* Add transfer QS GOV token operation to list of operations *)
      operations := Tezos.transaction(
        FA2_transfer_type(list [fa2_transfer_param]),
        0mutez,
        get_fa2_token_transfer_entrypoint(s.qsgov.token)
      ) # operations;
    }
    else skip;
  } with (operations, s)

(* Set new admin *)
function set_admin(
  const new_admin       : set_admin_type;
  var s                 : storage_type)
                        : return_type is
  block {
    (* Check of admin permissions *)
    only_admin(s.admin);

    (* Setup pending admin that must confirm his new admin role *)
    s.pending_admin := new_admin;
  } with (no_operations, s)

(* Confirm new admin *)
function confirm_admin(
  var s                 : storage_type)
                        : return_type is
  block {
    (* Check of pending admin permissions *)
    only_pending_admin(s.pending_admin);

    (* Setup new admin and reset pending admin *)
    s.admin := s.pending_admin;
    s.pending_admin := zero_address;
  } with (no_operations, s)
