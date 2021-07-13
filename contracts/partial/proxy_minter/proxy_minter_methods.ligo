function register_farm(
  const params          : register_farm_type;
  var s                 : storage_type)
                        : return_type is
  block {
    only_admin(Tezos.sender, s.admin);

    s.farms := Set.update(params.farm, params.register, s.farms);
  } with (no_operations, s)

function mint_gov_tokens(
  const params          : mint_tokens_type;
  var s                 : storage_type)
                        : return_type is
  block {
    if not Set.mem(Tezos.sender, s.farms)
    then failwith("ProxyMinter/sender-is-not-farm")
    else skip;
  } with (list [
      Tezos.transaction(
        record [
          receiver = params.recipient;
          amount   = params.amt;
        ],
        0mutez,
        get_mint_gov_tokens_entrypoint(s.qugo_token.token)
      )
    ], s)

function withdraw_gov_tokens(
  var s                 : storage_type)
                        : return_type is
  block {
    only_admin(Tezos.sender, s.admin);

    const balance_params : balance_type = record [
      requests = list [
        record [
          owner    = Tezos.self_address;
          token_id = s.qugo_token.id;
        ]
      ];
      callback = get_withdraw_callback_entrypoint(Tezos.self_address)
    ];
  } with (list [
    Tezos.transaction(
      balance_params,
      0mutez,
      get_qugo_token_balance_of_entrypoint(s.qugo_token.token)
    )
  ], s)

function withdraw_gov_tokens_callback(
  const params          : withdraw_type_2;
  var s                 : storage_type)
                        : return_type is
  block {
    if Tezos.sender =/= s.qugo_token.token
    then failwith("ProxyMinter/not-qugo-token")
    else skip;

    const qugo_token_id : token_id_type = s.qugo_token.id;

    function get_qugo_balance(
      var tmp           : qugo_balance_type;
      const v           : bal_response_type)
                        : qugo_balance_type is
      block {
        if not tmp.flag and v.request.token_id = qugo_token_id
        then {
          tmp.balance := v.balance;
          tmp.flag := True;
        }
        else skip;
      } with tmp;

    const tmp : qugo_balance_type = List.fold(
      get_qugo_balance,
      params,
      record [
        balance = 0n;
        flag    = False;
      ]
    );
    var operations : list(operation) := no_operations;

    if tmp.balance > 0n
    then {
      const dst : transfer_dst_type = record [
        to_      = s.admin;
        token_id = s.qugo_token.id;
        amount   = tmp.balance;
      ];
      const fa2_transfer_param : fa2_send_type = record [
        from_ = Tezos.self_address;
        txs   = list [dst];
      ];

      operations := Tezos.transaction(
        FA2_transfer_type(list [fa2_transfer_param]),
        0mutez,
        get_fa2_token_transfer_entrypoint(s.qugo_token.token)
      ) # operations;
    }
    else skip;
  } with (operations, s)

function set_admin(
  const new_admin       : set_admin_type;
  var s                 : storage_type)
                        : return_type is
  block {
    only_admin(Tezos.sender, s.admin);

    s.pending_admin := new_admin;
  } with (no_operations, s)

function confirm_admin(
  var s                 : storage_type)
                        : return_type is
  block {
    only_pending_admin(Tezos.sender, s.pending_admin);

    s.admin := s.pending_admin;
    s.pending_admin := zero_address;
  } with (no_operations, s)
