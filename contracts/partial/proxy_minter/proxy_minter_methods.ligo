(* Register or unregister farming in proxy minter *)
function register_farm(
  const params          : register_farm_type;
  var s                 : storage_type)
                        : return_type is
  block {
    (* Check of admin permissions *)
    only_admin(Tezos.sender, s.admin);

    (* Register or unregister a farm *)
    s.farms := Set.update(params.farm, params.register, s.farms);
  } with (no_operations, s)

(* Create transaction for GS GOV tokens minting and send it *)
function mint_qsgov_tokens(
  const params          : mint_gov_toks_type;
  var s                 : storage_type)
                        : return_type is
  block {
    (* Check if transaction sender is a registered farming *)
    if not Set.mem(Tezos.sender, s.farms)
    then failwith("ProxyMinter/sender-is-not-farm")
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
function withdraw_qsgov_tokens(
  var s                 : storage_type)
                        : return_type is
  block {
    (* Check of admin permissions *)
    only_admin(Tezos.sender, s.admin);

    (* Prepare params for %balance_of transaction *)
    const balance_of_params : balance_of_type = record [
      requests = list [
        record [
          owner    = Tezos.self_address;
          token_id = s.qsgov.id;
        ]
      ];
      callback = get_withdraw_callback_entrypoint(Tezos.self_address)
    ];
  } with (list [
    (* Balance of QS GOV token transaction *)
    Tezos.transaction(
      balance_of_params,
      0mutez,
      get_fa2_token_balance_of_entrypoint(s.qsgov.token)
    )
  ], s)

(* Accept QS GOV token %balance_of callback and withdraw tokens *)
function withdraw_qsgov_tokens_callback(
  const responses       : withdraw_type_2;
  var s                 : storage_type)
                        : return_type is
  block {
    (* Check if transaction sender is QS GOV token *)
    if Tezos.sender =/= s.qsgov.token
    then failwith("ProxyMinter/not-QS-GOV-token")
    else skip;

    (* Operations to be performed *)
    var operations : list(operation) := no_operations;

    (* Get proxy minter's QS GOV token balance *)
    const bal : nat = get_fa2_token_balance(
      responses,
      Tezos.self_address,
      s.qsgov.id
    );

    (* Withdraw QS GOV tokens only if balance greater than 0 *)
    if bal > 0n
    then {
      (* Create params to transfer QS GOV tokens to admin address *)
      const dst : transfer_dst_type = record [
        to_      = s.admin;
        token_id = s.qsgov.id;
        amount   = bal;
      ];
      const fa2_transfer_param : fa2_send_type = record [
        from_ = Tezos.self_address;
        txs   = list [dst];
      ];

      (* Add transfer QS GOV token operation to operations list *)
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
    only_admin(Tezos.sender, s.admin);

    (* Setup pending admin that must confirm his new admin role *)
    s.pending_admin := new_admin;
  } with (no_operations, s)

(* Confirm new admin *)
function confirm_admin(
  var s                 : storage_type)
                        : return_type is
  block {
    (* Check of pending admin permissions *)
    only_pending_admin(Tezos.sender, s.pending_admin);

    (* Setup new admin and reset pending admin *)
    s.admin := s.pending_admin;
    s.pending_admin := zero_address;
  } with (no_operations, s)
