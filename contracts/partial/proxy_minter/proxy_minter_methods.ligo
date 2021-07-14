function register_farm(
  const params          : register_farm_type;
  var s                 : storage_type)
                        : return_type is
  block {
    only_admin(Tezos.sender, s.admin);

    s.farms := Set.update(params.farm, params.register, s.farms);
  } with (no_operations, s)

function mint_qsgov_tokens(
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
        get_mint_qsgov_tokens_entrypoint(s.qsgov.token)
      )
    ], s)

function withdraw_qsgov_tokens(
  var s                 : storage_type)
                        : return_type is
  block {
    only_admin(Tezos.sender, s.admin);

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
    Tezos.transaction(
      balance_of_params,
      0mutez,
      get_qsqov_token_balance_of_entrypoint(s.qsgov.token)
    )
  ], s)

function withdraw_qsgov_tokens_callback(
  const params          : withdraw_type_2;
  var s                 : storage_type)
                        : return_type is
  block {
    if Tezos.sender =/= s.qsgov.token
    then failwith("ProxyMinter/not-GS-GOV-token")
    else skip;

    const qsgov_token_id : token_id_type = s.qsgov.id;

    function get_qsgov_balance(
      var tmp           : qsgov_balance_type;
      const v           : bal_response_type)
                        : qsgov_balance_type is
      block {
        const request : bal_request_type = record [
          token_id = qsgov_token_id;
          owner    = Tezos.self_address;
        ];

        if not tmp.flag and v.request = request
        then {
          tmp.balance := v.balance;
          tmp.flag := True;
        }
        else skip;
      } with tmp;

    const tmp : qsgov_balance_type = List.fold(
      get_qsgov_balance,
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
        token_id = s.qsgov.id;
        amount   = tmp.balance;
      ];
      const fa2_transfer_param : fa2_send_type = record [
        from_ = Tezos.self_address;
        txs   = list [dst];
      ];

      operations := Tezos.transaction(
        FA2_transfer_type(list [fa2_transfer_param]),
        0mutez,
        get_fa2_token_transfer_entrypoint(s.qsgov.token)
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
