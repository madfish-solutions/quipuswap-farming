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

    const qs_gov_balance : nat = get_fa2_token_balance(
      responses,
      Tezos.self_address,
      s.qsgov.id
    );
    var operations : list(operation) := no_operations;

    if qs_gov_balance =/= 0n
    then {
      operations := transfer_token(
        Tezos.self_address,
        zero_address,
        qs_gov_balance,
        FA2(record [
          token = s.qsgov.token;
          id = s.qsgov.id;
        ])
      ) # operations;
    }
    else skip;
  } with (operations, s)
