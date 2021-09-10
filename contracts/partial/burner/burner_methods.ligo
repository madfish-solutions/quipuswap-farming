(* Swap XTZ to QS GOV tokens and get balance of output tokens to burn them *)
function burn(
  const s             : storage_type)
                      : return_type is
  block {
    (* Prepare params for %balance_of transaction *)
    const balance_of_params : balance_of_type = record [
      requests = list [
        record [
          owner    = Tezos.self_address;
          token_id = s.qsgov.id;
        ]
      ];
      callback = get_burn_callback_entrypoint(Tezos.self_address)
    ];

    (* Operations to be performed *)
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
    (* Check if transaction sender is QS GOV token *)
    if Tezos.sender =/= s.qsgov.token
    then failwith("Burner/not-QS-GOV-token")
    else skip;

    (* Operations to be performed *)
    var operations : list(operation) := no_operations;

    (* Get burner's QS GOV token balance *)
    const bal : nat = get_fa2_token_balance(
      responses,
      Tezos.self_address,
      s.qsgov.id
    );

    (* Burn QS GOV tokens only if balance greater than 0 *)
    if bal > 0n
    then {
      (* Create params to burn QS GOV tokens *)
      const dst : transfer_dst_type = record [
        to_      = zero_address;
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
