(* Swap XTZ to QS GOV tokens and get balance of output tokens to burn them *)
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
      callback = (
        Tezos.self("%burn_callback") : contract(list(bal_response_type))
      )
    ];

    const operations : list(operation) = list [
      (* Swap all XTZ from burner to QS GOV tokens *)
      Tezos.transaction(
        TezToTokenPayment(record [
          min_out  = 1n;
          receiver = Tezos.self_address;
        ]),
        Tezos.amount,
        get_quipuswap_use_entrypoint(s.qsgov_lp)
      );
      (* Get balance of output QS GOV tokens to burn them *)
      Tezos.transaction(
        balance_of_params,
        0mutez,
        get_fa2_token_balance_of_entrypoint(s.qsgov.token)
      )
    ];
  } with (operations, s)

(* Accept QS GOV token %balance_of callback and burn all tokens *)
function burn_callback(
  const responses       : burn_callback_type;
  var s                 : storage_type)
                        : return_type is
  block {
    if Tezos.sender =/= s.qsgov.token
    then failwith("Burner/not-QS-GOV-token")
    else skip;

    var operations : list(operation) := no_operations;

    const qs_gov_balance : nat = get_fa2_token_balance(
      responses,
      Tezos.self_address,
      s.qsgov.id
    );

    if qs_gov_balance > 0n
    then {
      const dst : transfer_dst_type = record [
        to_      = zero_address;
        token_id = s.qsgov.id;
        amount   = qs_gov_balance;
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
