(* Util to get farm from storage by farm ID *)
function get_farm(
  const fid             : fid_type;
  const s               : storage_type)
                        : farm_type is
  (* Get farm info *)
  case s.farms[fid] of
    None       -> (failwith("QFarm/farm-not-set") : farm_type)
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
      used_votes  = 0n;
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

(* Util to get q_farm's %fa12_tok_bal_callback entrypoint *)
function get_fa12_tok_bal_callback_entrypoint(
  const this            : address)
                        : contract(nat) is
  case (
    Tezos.get_entrypoint_opt("%fa12_tok_bal_callback", this)
                        : option(contract(nat))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("QFarm/fa12-bal-tok-callback-entrypoint-404")
                        : contract(nat)
  )
  end

(* Util to get q_farm's %fa2_tok_bal_callback entrypoint *)
function get_fa2_tok_bal_callback_entrypoint(
  const this            : address)
                        : contract(list(bal_response_type)) is
  case (
    Tezos.get_entrypoint_opt("%fa2_tok_bal_callback", this)
                        : option(contract(list(bal_response_type)))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("QFarm/fa2-tok-bal-callback-entrypoint-404")
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

(* Util to get baker registry's %validate entrypoint *)
function get_baker_registry_validate_entrypoint(
  const baker_registry  : address)
                        : contract(key_hash) is
  case (
    Tezos.get_entrypoint_opt("%validate", baker_registry)
                        : option(contract(key_hash))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("BakerRegistry/validate-entrypoint-404")
                        : contract(key_hash)
  )
  end

(* Util to get votes count for the specified candidate *)
function get_votes(
  const farm            : farm_type;
  const candidate       : key_hash)
                        : nat is
  case farm.votes[candidate] of
    None      -> 0n
  | Some(amt) -> amt
  end

(* Util to get vote operation *)
function get_vote_op(
  const farm            : farm_type;
  const candidate       : key_hash)
                        : operation is
  Tezos.transaction(
    Vote(record [
      candidate = candidate;
      value     = farm.staked;
      voter     = Tezos.self_address;
    ]),
    0mutez,
    get_quipuswap_use_entrypoint(farm.stake_params.qs_pool)
  )

(*
  Vote for the preferred baker using user's LP tokens (shares)

  !DEV! order of operations creating is reverted cause of Ligo`s features:
  items can only be added to the beginning of the list
*)
function vote(
  var operations        : list(operation);
  var user              : user_info_type;
  var farm              : farm_type;
  var s                 : storage_type;
  const depo            : deposit_type)
                        : (list(operation) * storage_type) is
  block {
    (* Check if user already voted for the preferred candidate *)
    case farm.candidates[Tezos.sender] of
      None            -> skip
    | Some(candidate) -> {
      (* Get prev votes count for the user's candidate *)
      const prev_votes : nat = get_votes(farm, candidate);

      (* Subtract user's votes from the candidate *)
      if prev_votes >= user.used_votes
      then farm.votes[candidate] := abs(prev_votes - user.used_votes)
      else skip;
    }
    end;

    (* Get votes amount for all used below candidates *)
    const votes1 : nat = get_votes(farm, farm.current_delegated);
    const votes2 : nat = get_votes(farm, farm.current_candidate);
    const votes3 : nat = get_votes(farm, depo.candidate);

    (* Update user's new candidate votes amount *)
    farm.votes[depo.candidate] := votes3 + user.staked;

    (* Update farm's total votes amount *)
    farm.total_votes := farm.total_votes + depo.amt;

    (* Update user's candidate *)
    farm.candidates[Tezos.sender] := depo.candidate;

    (* Update user's used votes amount (equal to all staked tokens amount) *)
    user.used_votes := user.staked;

    (* Save updated user to the farm *)
    farm.users_info[Tezos.sender] := user;

    (* Check if farm already voted for the baker *)
    case farm.votes[farm.current_delegated] of
      None    -> {
        (* Update the baker who was voted for by the majority *)
        farm.current_delegated := depo.candidate;

        (* Prepare Quipuswap LP vote operation *)
        operations := get_vote_op(farm, depo.candidate) # operations;
    }
    | Some(_) -> {
      if votes1 =/= votes3
      then {
        if votes1 < votes3
        then {
          (* Update current candidate and current baker *)
          farm.current_candidate := farm.current_delegated;
          farm.current_delegated := depo.candidate;

          (* Prepare Quipuswap LP vote operation *)
          operations :=  get_vote_op(farm, depo.candidate) # operations;
        }
        else {
          (* Update current candidate *)
          case farm.votes[farm.current_candidate] of
            None    -> farm.current_candidate := depo.candidate
          | Some(_) -> {
            if votes2 < votes3
            then farm.current_candidate := depo.candidate
            else skip;
          }
          end;
        };
      }
      else {
        case farm.votes[farm.current_candidate] of
          None    -> skip
        | Some(_) -> {
          if votes2 > votes1
          then {
            (* Swap current baker and current candidate *)
            const tmp : key_hash = farm.current_delegated;

            farm.current_delegated := farm.current_candidate;
            farm.current_candidate := tmp;

            (* Prepare Quipuswap LP vote operation *)
            operations :=
              get_vote_op(farm, farm.current_delegated) # operations;
          }
          else skip;
        }
        end;
      };
    }
    end;

    (* Update farm in the storage *)
    s.farms[farm.fid] := farm;

    (* Validate candidate for voting operation *)
    operations := Tezos.transaction(
      depo.candidate,
      0mutez,
      get_baker_registry_validate_entrypoint(s.baker_registry)
    ) # operations;
  } with (operations, s)

(*
  Revote for the preferred baker using user's LP tokens (shares)

  !DEV! order of operations creating is reverted cause of Ligo`s features:
  items can only be added to the beginning of the list
*)
function revote(
  var operations        : list(operation);
  var user              : user_info_type;
  var farm              : farm_type;
  var s                 : storage_type;
  const value           : nat)
                        : (list(operation) * storage_type) is
  block {
    var users_candidate : key_hash := zero_key_hash;

    (* Get user's candidate *)
    case farm.candidates[Tezos.sender] of
      None            -> skip
    | Some(candidate) -> {
      (* Get prev votes count for the user's candidate *)
      const prev_votes : nat = get_votes(farm, candidate);

      (* Subtract user's votes from the candidate *)
      if prev_votes >= value
      then farm.votes[candidate] := abs(prev_votes - value)
      else skip;

      users_candidate := candidate;
    }
    end;

    (* Update farm's total votes amount *)
    farm.total_votes := abs(farm.total_votes - value);

    (* Update user's used votes amount (equal to all staked tokens amount) *)
    user.used_votes := abs(user.used_votes - value);

    (* Save updated user to the farm *)
    farm.users_info[Tezos.sender] := user;

    (* Get votes amount for all used below candidates *)
    const votes1 : nat = get_votes(farm, farm.current_delegated);
    const votes2 : nat = get_votes(farm, farm.current_candidate);
    const votes3 : nat = get_votes(farm, users_candidate);

    (* Check if farm already voted for the baker *)
    case farm.votes[farm.current_delegated] of
      None    -> {
        (* Update the baker who was voted for by the majority *)
        farm.current_delegated := users_candidate;

        (* Prepare Quipuswap LP vote operation *)
        operations := get_vote_op(farm, users_candidate) # operations;
    }
    | Some(_) -> {
      if votes1 =/= votes3
      then {
        if votes1 < votes3
        then {
          (* Update current candidate and current baker *)
          farm.current_candidate := farm.current_delegated;
          farm.current_delegated := users_candidate;

          (* Prepare Quipuswap LP vote operation *)
          operations :=  get_vote_op(farm, users_candidate) # operations;
        }
        else {
          (* Update current candidate *)
          case farm.votes[farm.current_candidate] of
            None    -> farm.current_candidate := users_candidate
          | Some(_) -> {
            if votes2 < votes3
            then farm.current_candidate := users_candidate
            else skip;
          }
          end;
        };
      }
      else {
        case farm.votes[farm.current_candidate] of
          None    -> skip
        | Some(_) -> {
          if votes2 > votes1
          then {
            (* Swap current baker and current candidate *)
            const tmp : key_hash = farm.current_delegated;

            farm.current_delegated := farm.current_candidate;
            farm.current_candidate := tmp;

            (* Prepare Quipuswap LP vote operation *)
            operations :=
              get_vote_op(farm, farm.current_delegated) # operations;
          }
          else skip;
        }
        end;
      };
    }
    end;

    (* Update farm in the storage *)
    s.farms[farm.fid] := farm;
  } with(operations, s)
