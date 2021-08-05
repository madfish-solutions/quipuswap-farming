(* Util to get farm from storage by farm ID *)
function get_farm(
  const fid             : fid_type;
  const s               : storage_type)
                        : farm_type is
  (* Get farm info *)
  case s.farms[fid] of
    None       -> (failwith("TFarm/farm-not-set") : farm_type)
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
    if Tezos.now <= _farm.start_time
    then skip
    else {
      (* Check if some tokens is already staked *)
      if _farm.staked =/= 0n
      then {
        (* Calculate timedelta in seconds *)
        const time_diff : nat = abs(Tezos.now - _farm.upd);

        (* Calculate new reward *)
        const reward : nat = time_diff * _farm.reward_per_second * precision;

        (* Update farm's reward per share *)
        _farm.rps := _farm.rps + reward / _farm.staked;
      }
      else skip;

      (* Update farm's update timestamp *)
      _farm.upd := Tezos.now;

      (* Save the farm to the storage *)
      s.farms[_farm.fid] := _farm;
    };
  } with s

(* Util to claim sender's rewards *)
function claim_rewards(
  var user              : user_info_type;
  var operations        : list(operation);
  const farm            : farm_type;
  const receiver        : address;
  const s               : storage_type)
                        : (list(operation) * user_info_type) is
  block {
    (* Calculate user's real reward *)
    const earned : nat = user.earned / precision;

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

      (* Get sender's referrer *)
      const fee_receiver : address = case s.referrers[Tezos.sender] of
        None           -> zero_address
      | Some(referrer) -> referrer
      end;

      (* Check reward token standard *)
      if farm.reward_token.is_fa2
      then {
        (* Prepare FA2 token transfer params *)
        const dst1 : transfer_dst_type = record [
          to_      = receiver;
          token_id = farm.reward_token.id;
          amount   = actual_earned;
        ];
        var fa2_transfer_param : fa2_send_type := record [
          from_ = Tezos.self_address;
          txs   = (list [] : list(transfer_dst_type));
        ];
        var txs : list(transfer_dst_type) := list [];

        (* Ensure harvest fee is greater than 0 *)
        if harvest_fee > 0n
        then {
          const dst2 : transfer_dst_type = record [
            to_      = fee_receiver;
            token_id = farm.reward_token.id;
            amount   = harvest_fee;
          ];

          txs := dst2 # txs;
        }
        else skip;

        txs := dst1 # txs;

        fa2_transfer_param.txs := txs;

        (* Prepare FA2 transfer operation for earned tokens *)
        operations := Tezos.transaction(
          FA2_transfer_type(list [fa2_transfer_param]),
          0mutez,
          get_fa2_token_transfer_entrypoint(farm.reward_token.token)
        ) # operations;
      }
      else {
        (* Ensure harvest fee is greater than 0 *)
        if harvest_fee > 0n
        then {
          (* Prepare FA1.2 transfer operation for harvest fee tokens *)
          operations := Tezos.transaction(
            FA12_transfer_type(
              Tezos.self_address,
              (fee_receiver, harvest_fee)
            ),
            0mutez,
            get_fa12_token_transfer_entrypoint(farm.reward_token.token)
          ) # operations;
        }
        else skip;

        (* Prepare FA1.2 transfer operation for earned tokens *)
        operations := Tezos.transaction(
          FA12_transfer_type(Tezos.self_address, (receiver, actual_earned)),
          0mutez,
          get_fa12_token_transfer_entrypoint(farm.reward_token.token)
        ) # operations;
      };
    };
  } with (operations, user)

(* Util to transfer earned user's rewards to admin *)
function transfer_rewards_to_admin(
  var user              : user_info_type;
  var operations        : list(operation);
  const farm            : farm_type;
  const admin           : address)
                        : (list(operation) * user_info_type) is
  block {
    (* Calculate user's real reward *)
    const earned : nat = user.earned / precision;

    (* Ensure sufficient reward *)
    if earned = 0n
    then skip
    else {
      (* Decrement pending reward *)
      user.earned := abs(user.earned - earned * precision);

      (* Check reward token standard *)
      if farm.reward_token.is_fa2
      then {
        (* Prepare FA2 token transfer params *)
        const dst : transfer_dst_type = record [
          to_      = admin;
          token_id = farm.reward_token.id;
          amount   = earned;
        ];
        var fa2_transfer_param : fa2_send_type := record [
          from_ = Tezos.self_address;
          txs   = list [dst];
        ];

        (* Prepare FA2 transfer operation for earned tokens *)
        operations := Tezos.transaction(
          FA2_transfer_type(list [fa2_transfer_param]),
          0mutez,
          get_fa2_token_transfer_entrypoint(farm.reward_token.token)
        ) # operations;
      }
      else {
        (* Prepare FA1.2 transfer operation for earned tokens *)
        operations := Tezos.transaction(
          FA12_transfer_type(Tezos.self_address, (admin, earned)),
          0mutez,
          get_fa12_token_transfer_entrypoint(farm.reward_token.token)
        ) # operations;
      };
    };
  } with (operations, user)

(* Util to get t_farm's %fa12_tok_bal_callback entrypoint *)
function get_fa12_tok_bal_callback_entrypoint(
  const this            : address)
                        : contract(nat) is
  case (
    Tezos.get_entrypoint_opt("%fa12_tok_bal_callback", this)
                        : option(contract(nat))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("TFarm/fa12-bal-tok-callback-entrypoint-404")
                        : contract(nat)
  )
  end

(* Util to get t_farm's %fa2_tok_bal_callback entrypoint *)
function get_fa2_tok_bal_callback_entrypoint(
  const this            : address)
                        : contract(list(bal_response_type)) is
  case (
    Tezos.get_entrypoint_opt("%fa2_tok_bal_callback", this)
                        : option(contract(list(bal_response_type)))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("TFarm/fa2-tok-bal-callback-entrypoint-404")
                        : contract(list(bal_response_type))
  )
  end

(*
  Swap tokens to XTZ. XTZ swap for QS GOV tokens and burn all of them.

  !DEV! order of operations creating is fully reverted cause of Ligo's
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

  !DEV! order of operations creating is reverted cause of Ligo's features:
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

  !DEV! order of operations creating is reverted cause of Ligo's features:
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
