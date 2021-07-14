function burn(
  const s             : storage_type)
                      : return_type is
  block {
    const balance_of_params : balance_of_type = record [
      requests = list [
        record [
          owner    = Tezos.self_address;
          token_id = s.qsgov.id;
        ]
      ];
      callback = get_burn_callback_entrypoint(Tezos.self_address)
    ];
    const operations : list(operation) = list [
      Tezos.transaction(
        TezToTokenPayment(record [
          min_out  = 1n;
          receiver = Tezos.self_address;
        ]),
        Tezos.amount,
        get_quipuswap_use_entrypoint(s.qsgov_lp)
      );
      Tezos.transaction(
        balance_of_params,
        0mutez,
        get_qsqov_token_balance_of_entrypoint(s.qsgov.token)
      )
    ];
  } with (operations, s)

function burn_callback(
  const params          : burn_callback_type;
  var s                 : storage_type)
                        : return_type is
  block {
    if Tezos.sender =/= s.qsgov.token
    then failwith("Burner/not-QS-GOV-token")
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
        to_      = zero_address;
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
