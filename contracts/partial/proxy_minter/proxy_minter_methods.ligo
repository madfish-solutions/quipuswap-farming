function add_minter(
  const params          : add_minter_type;
  var s                 : storage_type)
                        : return_type is
  block {
    only_admin(s.admin);

    s.minters := Set.update(params.minter, params.register, s.minters);
  } with (no_operations, s)

function mint_tokens(
  const params          : mint_gov_toks_type;
  var s                 : storage_type)
                        : return_type is
  block {
    if not Set.mem(Tezos.sender, s.minters)
    then failwith("ProxyMinter/sender-is-not-a-minter")
    else skip;
  } with (list [
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
    only_admin(s.admin);

    var operations : list(operation) := no_operations;

    if amt =/= 0n
    then {
      operations := transfer_token(
        Tezos.self_address,
        s.admin,
        amt,
        FA2(record [
          token = s.qsgov.token;
          id = s.qsgov.id;
        ])
      ) # operations;
    }
    else skip;
  } with (operations, s)

function set_admin(
  const new_admin       : set_admin_type;
  var s                 : storage_type)
                        : return_type is
  block {
    only_admin(s.admin);

    s.pending_admin := new_admin;
  } with (no_operations, s)

function confirm_admin(
  var s                 : storage_type)
                        : return_type is
  block {
    only_pending_admin(s.pending_admin);

    s.admin := s.pending_admin;
    s.pending_admin := zero_address;
  } with (no_operations, s)
