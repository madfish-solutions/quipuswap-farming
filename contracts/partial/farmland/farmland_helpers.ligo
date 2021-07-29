(* Util to get farm from storage by farm ID *)
function get_farm(
  const fid             : fid_type;
  const s               : storage_type)
                        : farm_type is
  (* Get farm info *)
  case s.farms[fid] of
    None       -> (failwith("Farmland/farm-not-set") : farm_type)
  | Some(farm) -> farm
  end

(* Util to get user info related to specific farm *)
function get_user_info(
  const farm            : farm_type;
  const user            : address)
                        : user_info_type is
    (* Get user info *)
    case farm.users_info[user] of
      Some(info) -> info
    | None       -> record [
      last_staked = (0 : timestamp);
      staked      = 0n;
      earned      = 0n;
      prev_earned = 0n;
    ]
    end

(* Util to update rewards of the specified farm *)
function update_farm_rewards(
  var _farm             : farm_type;
  var s                 : storage_type)
                        : storage_type is
  block {
    (* Check if farm is already started *)
    if Tezos.level <= _farm.start_block
    then skip
    else {
      (* Check if some tokens is already staked *)
      if _farm.staked =/= 0n
      then {
        (* Calculate timedelta in blocks *)
        const time_diff : nat = abs(Tezos.now - _farm.upd);

        (* Calculate new rewards to be minted for the farm *)
        const reward : nat = time_diff * s.qsgov_per_second *
          precision * _farm.alloc_point / s.total_alloc_point;

        (* Update farm's reward per share *)
        _farm.rps := _farm.rps + reward / _farm.staked;
      }
      else skip;

      (* Update farm's update block *)
      _farm.upd := Tezos.now;

      (* Save the farm to the storage *)
      s.farms[_farm.fid] := _farm;
    };
  } with s

(* Util to get proxy minter's %mint_qsgov_tokens entrypoint *)
function get_proxy_minter_mint_entrypoint(
  const proxy_minter    : address)
                        : contract(mint_gov_toks_type) is
  case (
    Tezos.get_entrypoint_opt("%mint_qsgov_tokens", proxy_minter)
                        : option(contract(mint_gov_toks_type))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("ProxyMinter/mint-qsgov-tokens-entrypoint-404")
                        : contract(mint_gov_toks_type)
  )
  end

(* Util to claim sender's rewards *)
function claim_rewards(
  var user              : user_info_type;
  const farm            : farm_type;
  const receiver        : address;
  const s               : storage_type)
                        : (option(operation) * user_info_type) is
  block {
    (* Calculate user's real reward *)
    const earned : nat = user.earned / precision;

    (* Operation to be performed *)
    var op : option(operation) := (None : option(operation));

    (* Ensure sufficient reward *)
    if earned = 0n
    then skip
    else {
      (* Decrement pending reward *)
      user.earned := abs(user.earned - earned * precision);

      (* Calculate actual reward including harvest fee *)
      const actual_earned : nat = earned *
        abs(10000n - farm.fees.harvest_fee) / 10000n;

      (* Calculate harvest fee *)
      const harvest_fee : nat = abs(earned - actual_earned);

      (* Prepare params for QS GOV tokens minting to rewards receiver *)
      var mint_data : mint_gov_toks_type := list [
        record [
          receiver = receiver;
          amount   = actual_earned;
        ]
      ];

      (* Ensure harvest fee is greater than 0 *)
      if harvest_fee > 0n
      then {
        (* Get sender's referrer *)
        const receiver : address = case s.referrers[Tezos.sender] of
          None           -> zero_address
        | Some(referrer) -> referrer
        end;

        (* Prepare params for QS GOV tokens minting to referrer *)
        const harvest_fee_mint_data : mint_gov_tok_type = record [
          receiver = receiver;
          amount   = harvest_fee;
        ];

        (* Update mint params *)
        mint_data := harvest_fee_mint_data # mint_data;
      }
      else skip;

      (* Operation for minting QS GOV tokens *)
      op := Some(
        Tezos.transaction(
          mint_data,
          0mutez,
          get_proxy_minter_mint_entrypoint(s.proxy_minter)
        )
      );
    };
  } with (op, user)

(* Util to burn user's rewards *)
function burn_rewards(
  var user              : user_info_type;
  const pay_burn_reward : bool;
  const s               : storage_type)
                        : (option(operation) * user_info_type) is
  block {
    (* Calculate user's real reward *)
    const earned : nat = user.earned / precision;

    (* Operation to be performed *)
    var op : option(operation) := (None : option(operation));

    (* Ensure sufficient reward *)
    if earned = 0n
    then skip
    else {
      (* Decrement pending reward *)
      user.earned := abs(user.earned - earned * precision);

      (* Empty list that will be filled with minting params *)
      var mint_data : mint_gov_toks_type := list [];

      if pay_burn_reward
      then {
        (* Calculate real amount to burn (without 3% as a reward) *)
        const burn_amount : nat = earned * 97n / 100n;

        (* Calculate 3% reward for the transaction sender *)
        const reward : nat = abs(earned - burn_amount);

        (* Prepare destination params for minting *)
        const dst1 : mint_gov_tok_type = record [
          receiver = zero_address;
          amount   = burn_amount;
        ];
        const dst2 : mint_gov_tok_type = record [
          receiver = Tezos.sender;
          amount   = reward;
        ];

        (* Update list with data about minting *)
        mint_data := dst1 # mint_data;
        mint_data := dst2 # mint_data;
      }
      else {
        (* Prepare destination param for minting *)
        const dst : mint_gov_tok_type = record [
          receiver = zero_address;
          amount   = earned;
        ];

        (* Update list with data about minting *)
        mint_data := dst # mint_data;
      };

      (* Operation for minting QS GOV tokens *)
      op := Some(
        Tezos.transaction(
          mint_data,
          0mutez,
          get_proxy_minter_mint_entrypoint(s.proxy_minter)
        )
      );
    };
  } with (op, user)

(* Util to get farmland's %fa12_tok_bal_callback entrypoint *)
function get_fa12_tok_bal_callback_entrypoint(
  const this            : address)
                        : contract(nat) is
  case (
    Tezos.get_entrypoint_opt("%fa12_tok_bal_callback", this)
                        : option(contract(nat))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("Farmland/fa12-bal-tok-callback-entrypoint-404")
                        : contract(nat)
  )
  end

(* Util to get farmland's %fa2_tok_bal_callback entrypoint *)
function get_fa2_tok_bal_callback_entrypoint(
  const this            : address)
                        : contract(list(bal_response_type)) is
  case (
    Tezos.get_entrypoint_opt("%fa2_tok_bal_callback", this)
                        : option(contract(list(bal_response_type)))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("Farmland/fa2-tok-bal-callback-entrypoint-404")
                        : contract(list(bal_response_type))
  )
  end

(*
  Swap tokens to XTZ. XTZ swap for QS GOV tokens and burn all of them.

  !DEV! order of operations creating is fully reverted cause of Ligo`s
  features: items can only be added to the beginning of the list
*)
function swap(
  const bal             : nat;
  const s               : storage_type)
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
      callback = get_burn_callback_entrypoint(s.burner)
    ];

    (* Operations to be performed *)
    var operations : list(operation) := list [
      (* Swap all XTZ to QS GOV tokens operation *)
      Tezos.transaction(
        TezToTokenPayment(record [
          min_out  = s.temp.min_qs_gov_output;
          receiver = Tezos.self_address;
        ]),
        0mutez,
        get_quipuswap_use_entrypoint(s.qsgov_pool)
      );
      (* Get balance of output QS GOV tokens to burn them *)
      Tezos.transaction(
        balance_of_params,
        0mutez,
        get_fa2_token_balance_of_entrypoint(s.qsgov.token)
      )
    ];

    (* Check token standard *)
    if s.temp.token.is_fa2
    then {
      (* Remove operator operation *)
      operations := Tezos.transaction(
        FA2_approve_type(list [
          Remove_operator(record [
            owner    = Tezos.self_address;
            operator = s.temp.qs_pool;
            token_id = s.temp.token.id;
          ])
        ]),
        0mutez,
        get_fa2_token_approve_entrypoint(s.temp.token.token)
      ) # operations;
    }
    else skip;

    (* Swap all tokens to XTZ operation *)
    operations := Tezos.transaction(
      TokenToTezPayment(record [
        amount   = bal;
        min_out  = 1n;
        receiver = Tezos.self_address;
      ]),
      0mutez,
      get_quipuswap_use_entrypoint(s.temp.qs_pool)
    ) # operations;

    (* Check token standard *)
    if s.temp.token.is_fa2
    then {
      (* Add operator operation *)
      operations := Tezos.transaction(
        FA2_approve_type(list [
          Add_operator(record [
            owner    = Tezos.self_address;
            operator = s.temp.qs_pool;
            token_id = s.temp.token.id;
          ])
        ]),
        0mutez,
        get_fa2_token_approve_entrypoint(s.temp.token.token)
      ) # operations;
    }
    else {
      (* Approve operation *)
      operations := Tezos.transaction(
        FA12_approve_type(s.temp.qs_pool, bal),
        0mutez,
        get_fa12_token_approve_entrypoint(s.temp.token.token)
      ) # operations;
    };
  } with (operations, s)

(* Reset temporary record in the storage *)
function reset_temp(
  var s                 : storage_type)
                        : storage_type is
  block {
    s.temp.min_qs_gov_output := 0n;

    s.temp.qs_pool := zero_address;

    s.temp.token.token := zero_address;
    s.temp.token.id := 0n;
    s.temp.token.is_fa2 := False;
  } with s
