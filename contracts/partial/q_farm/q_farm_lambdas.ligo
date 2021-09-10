(* Set new admin *)
function set_admin(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(admin)                  -> {
        (* Check of admin permissions *)
        only_admin(s.admin);

        (* Setup pending admin that must confirm his new admin role *)
        s.pending_admin := admin;
      }
    | _                                 -> skip
    end
  } with (no_operations, s)

(* Confirm new admin *)
function confirm_admin(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Confirm_admin                     -> {
        (* Check of pending admin permissions *)
        only_pending_admin(s.pending_admin);

        (* Setup new admin and reset pending admin *)
        s.admin := s.pending_admin;
        s.pending_admin := zero_address;
      }
    | _                                 -> skip
    end
  } with (no_operations, s)

(* Update allocation points for farms *)
function set_alloc_points(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_alloc_points(params)          -> {
        (* Check of admin permissions *)
        only_admin(s.admin);

        (* Update allocation point for the specified farm *)
        function set_alloc_point(
          var s           : storage_type;
          const params    : set_alloc_type)
                          : storage_type is
          block {
            (* Update all farms rewards *)
            s := update_all_farms_rewards(s);

            (* Retrieve farm from the storage *)
            var farm : farm_type := get_farm(params.fid, s);

            if Tezos.now < farm.start_time
            then failwith("QFarm/not-started-yet")
            else skip;

            (* Update total allocation point *)
            s.total_alloc_point := abs(
              s.total_alloc_point - farm.alloc_point
            ) + params.alloc_point;

            (* Update farm's allocation point *)
            farm.alloc_point := params.alloc_point;

            (* Save farm to the storage *)
            s.farms[farm.fid] := farm;
          } with s;

        (* Update allocation points *)
        s := List.fold(set_alloc_point, params, s);
      }
    | _                                 -> skip
    end
  } with (no_operations, s)

(* Update fees for farms *)
function set_fees(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_fees(params)                  -> {
        (* Check of admin permissions *)
        only_admin(s.admin);

        (* Update fees for the specified farm *)
        function set_fee(
          var s           : storage_type;
          const params    : set_fee_type)
                          : storage_type is
          block {
            (* Retrieve farm from the storage *)
            var farm : farm_type := get_farm(params.fid, s);

            (* Update farm's fees *)
            farm.fees := params.fees;

            (* Save farm to the storage *)
            s.farms[farm.fid] := farm;
          } with s;

        (* Update fees *)
        s := List.fold(set_fee, params, s);
      }
    | _                                 -> skip
    end
  } with (no_operations, s)

(* Update reward per second in QS GOV tokens *)
function set_reward_per_second(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_reward_per_second(rps)        -> {
        (* Check of admin permissions *)
        only_admin(s.admin);

        (* Update reward per second *)
        s.qsgov_per_second := rps;
      }
    | _                                 -> skip
    end
  } with (no_operations, s)

(* Update burner address *)
function set_burner(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_burner(burner)                -> {
        (* Check of admin permissions *)
        only_admin(s.admin);

        (* Update burner *)
        s.burner := burner;
      }
    | _                                 -> skip
    end
  } with (no_operations, s)

(* Update proxy minter address *)
function set_proxy_minter(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_proxy_minter(proxy_minter)    -> {
        (* Check of admin permissions *)
        only_admin(s.admin);

        (* Update proxy minter *)
        s.proxy_minter := proxy_minter;
      }
    | _                                 -> skip
    end
  } with (no_operations, s)

(* Update baker registry address *)
function set_baker_registry(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_baker_registry(registry)      -> {
        (* Check of admin permissions *)
        only_admin(s.admin);

        (* Update baker registry *)
        s.baker_registry := registry;
      }
    | _                                 -> skip
    end
  } with (no_operations, s)

(* Register new farm *)
function add_new_farm(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Add_new_farm(params)              -> {
        (* Check of admin permissions *)
        only_admin(s.admin);

        (* Configure correct start time *)
        const start_time : timestamp = if params.start_time <= Tezos.now
          then Tezos.now
          else params.start_time;

        (* Add new farm info to the storage *)
        s.farms[s.farms_count] := record [
          fees              = params.fees;
          upd               = start_time;
          stake_params      = params.stake_params;
          reward_token      = s.qsgov;
          timelock          = params.timelock;
          current_delegated = zero_key_hash;
          current_candidate = zero_key_hash;
          alloc_point       = params.alloc_point;
          allocated         = False;
          rps               = 0n;
          staked            = 0n;
          start_time        = start_time;
          fid               = s.farms_count;
          total_votes       = 0n;
        ];

        (* Update farms count *)
        s.farms_count := s.farms_count + 1n;
      }
    | _                                 -> skip
    end
  } with (no_operations, s)

(* Deposit tokens for staking in the specified farm *)
function deposit(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    (* Operations to be performed *)
    var operations : list(operation) := no_operations;

    case action of
      Deposit(params)                   -> {
        (* Retrieve farm from the storage *)
        var farm : farm_type := get_farm(params.fid, s);

        if farm.alloc_point = 0n
        then failwith("QFarm/farm-is-paused")
        else skip;

        (* Update rewards for the farm *)
        s := update_farm_rewards(farm, s);

        (* Retrieve user data for the specified farm *)
        var user : user_info_type := get_user_info(farm.fid, Tezos.sender, s);

        (* Update users's reward *)
        user.earned := user.earned +
          abs(user.staked * farm.rps - user.prev_earned);

        (* Prepare claiming params *)
        var res : (option(operation) * user_info_type) :=
          ((None : option(operation)), user);

        (* Check timelock (if timelock is finished - claim rewards) *)
        if abs(Tezos.now - user.last_staked) >= farm.timelock
        then res := claim_rewards(user, farm, params.rewards_receiver, s)
        else skip;

        (* Update user's info *)
        user := res.1;

        (* Update user's referrer *)
        case params.referrer of
          None      -> skip
        | Some(referrer) -> {
          if referrer = Tezos.sender
          then failwith("QFarm/can-not-refer-yourself")
          else s.referrers[Tezos.sender] := referrer;
        }
        end;

        (* Update user's staked and earned tokens amount *)
        user.staked := user.staked + params.amt;
        user.prev_earned := user.staked * farm.rps;

        (* Check amount to stake *)
        if params.amt > 0n
        then user.last_staked := Tezos.now; (* Reset user's timelock *)
        else skip;

        (* Save user's info in the farm and update farm's staked amount *)
        s.users_info[(farm.fid, Tezos.sender)] := user;
        farm.staked := farm.staked + params.amt;

        (* Save farm to the storage *)
        s.farms[farm.fid] := farm;

        (* Check amount to stake *)
        if params.amt > 0n
        then {
          (* Check staked token type (LP or not) *)
          if farm.stake_params.is_lp_staked_token
          then {
            (* Vote for the preferred baker *)
            const vote_res : (list(operation) * storage_type) = vote(
              operations,
              user,
              farm,
              s,
              params
            );

            (* Update the farm and list of operations to be performed *)
            operations := vote_res.0;
            s := vote_res.1;
          }
          else skip;

          (* Check the staked token standard *)
          case farm.stake_params.staked_token of
            FA12(token_address) -> {
            (* Prepare FA1.2 transfer operation for staked token *)
            operations := Tezos.transaction(
              FA12_transfer_type(
                Tezos.sender,
                (Tezos.self_address, params.amt)
              ),
              0mutez,
              get_fa12_token_transfer_entrypoint(token_address)
            ) # operations;
          }
          | FA2(token_info)     -> {
            (* Prepare FA2 token transfer params *)
            const dst : transfer_dst_type = record [
              to_      = Tezos.self_address;
              token_id = token_info.id;
              amount   = params.amt;
            ];
            const fa2_transfer_param : fa2_send_type = record [
              from_ = Tezos.sender;
              txs   = list [dst];
            ];

            (* Prepare FA2 transfer operation for staked token *)
            operations := Tezos.transaction(
              FA2_transfer_type(list [fa2_transfer_param]),
              0mutez,
              get_fa2_token_transfer_entrypoint(token_info.token)
            ) # operations;
          }
          end;
        }
        else skip;

        (* Concat claim rewards operation with list of operations *)
        case res.0 of
          Some(op) -> operations := op # operations
        | None     -> skip
        end;
      }
    | _                                 -> skip
    end
  } with (operations, s)

(* Withdraw tokens from staking in the specified farm *)
function withdraw(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    (* Operations to be performed *)
    var operations : list(operation) := no_operations;

    case action of
      Withdraw(params)                  -> {
        (* Retrieve farm from the storage *)
        var farm : farm_type := get_farm(params.fid, s);

        (* Update rewards for the farm *)
        s := update_farm_rewards(farm, s);

        (* Retrieve user data for the specified farm *)
        var user : user_info_type := get_user_info(farm.fid, Tezos.sender, s);

        (* Value for withdrawal (without calculated withdrawal fee) *)
        var value : nat := params.amt;

        (* Process "withdraw all" *)
        if value = 0n
        then value := user.staked
        else skip;

        (* Check the correct withdrawal quantity *)
        if value > user.staked
        then failwith("QFarm/balance-too-low")
        else skip;

        (* Actual value for withdrawal (with calculated withdrawal fee) *)
        var actual_value : nat := value;

        (* Update users's reward *)
        user.earned := user.earned +
          abs(user.staked * farm.rps - user.prev_earned);

        (* Prepare claiming params *)
        var res : (option(operation) * user_info_type) :=
          ((None : option(operation)), user);

        (* Check timelock (if timelock is finished - claim, else - burn) *)
        if abs(Tezos.now - user.last_staked) >= farm.timelock
        then res := claim_rewards(user, farm, params.rewards_receiver, s)
        else { (* Burn reward and stake withdrawal fee from farm's name *)
          res := burn_rewards(user, False, s); (* Burn QS GOV tokens *)

          (* Calculate actual value including withdrawal fee *)
          actual_value := value *
            abs(10000n - farm.fees.withdrawal_fee) / 10000n;

          (* Calculate withdrawal fee *)
          const withdrawal_fee : nat = abs(value - actual_value);

          (* Check if withdrawal fee is greater than 0 *)
          if withdrawal_fee = 0n
          then skip
          else {
            (* Retrieve farm user data for the specified farm *)
            var farm_user : user_info_type :=
              get_user_info(farm.fid, Tezos.self_address, s);

            (* Update farm users's earned amount *)
            farm_user.earned := farm_user.earned +
              abs(farm_user.staked * farm.rps - farm_user.prev_earned);

            (* Update farm user's staked and previous earned tokens amount *)
            farm_user.staked := farm_user.staked + withdrawal_fee;
            farm_user.prev_earned := farm_user.staked * farm.rps;

            (* Reset farm user's timelock *)
            farm_user.last_staked := Tezos.now;

            (* Save farm user's info in the farm *)
            s.users_info[(farm.fid, Tezos.self_address)] := farm_user;
          };
        };

        (* Update user's info *)
        user := res.1;

        (* Update user's staked and earned tokens amount *)
        user.staked := abs(user.staked - value);
        user.prev_earned := user.staked * farm.rps;

        (* Reset user's timelock *)
        user.last_staked := Tezos.now;

        (* Save user's info in the farm and update farm's staked amount *)
        s.users_info[(farm.fid, Tezos.sender)] := user;
        farm.staked := abs(farm.staked - actual_value);

        (* Save farm to the storage *)
        s.farms[farm.fid] := farm;

        (* Check the staked token standard *)
        case farm.stake_params.staked_token of
          FA12(token_address) -> {
          (* Prepare FA1.2 transfer operation for staked token *)
          operations := Tezos.transaction(
            FA12_transfer_type(
              Tezos.self_address,
              (params.receiver, actual_value)
            ),
            0mutez,
            get_fa12_token_transfer_entrypoint(token_address)
          ) # operations;
        }
        | FA2(token_info)     -> {
          (* Prepare FA2 token transfer params *)
          const dst : transfer_dst_type = record [
            to_      = params.receiver;
            token_id = token_info.id;
            amount   = actual_value;
          ];
          const fa2_transfer_param : fa2_send_type = record [
            from_ = Tezos.self_address;
            txs   = list [dst];
          ];

          (* Prepare FA2 transfer operation for staked token *)
          operations := Tezos.transaction(
            FA2_transfer_type(list [fa2_transfer_param]),
            0mutez,
            get_fa2_token_transfer_entrypoint(token_info.token)
          ) # operations;
        }
        end;

        (* Check staked token type (LP or not) *)
        if farm.stake_params.is_lp_staked_token
        then {
          (* Revote *)
          const revote_res : (list(operation) * storage_type) = revote(
            operations,
            user,
            farm,
            s,
            value
          );

          (* Update the farm and list of operations to be performed *)
          operations := revote_res.0;
          s := revote_res.1;
        }
        else skip;

        (* Concat claim or burn rewards operation with list of operations *)
        case res.0 of
          Some(op) -> operations := op # operations
        | None     -> skip
        end;
      }
    | _                                 -> skip
    end
  } with (operations, s)

(* Claim earned tokens *)
function harvest(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    (* Operations to be performed *)
    var operations : list(operation) := no_operations;

    case action of
      Harvest(params)                   -> {
        (* Retrieve farm from the storage *)
        var farm : farm_type := get_farm(params.fid, s);

        (* Update rewards for the farm *)
        s := update_farm_rewards(farm, s);

        (* Retrieve user data for the specified farm *)
        var user : user_info_type := get_user_info(farm.fid, Tezos.sender, s);

        (* Update users's reward *)
        user.earned := user.earned +
          abs(user.staked * farm.rps - user.prev_earned);

        (* Prepare claiming params *)
        var res : (option(operation) * user_info_type) :=
          ((None : option(operation)), user);

        (* Check timelock (if timelock is finished - claim rewards) *)
        if abs(Tezos.now - user.last_staked) >= farm.timelock
        then res := claim_rewards(user, farm, params.rewards_receiver, s)
        else failwith("QFarm/timelock-is-not-finished");

        (* Update user's info *)
        user := res.1;

        (* Concat claim rewards operation with list of operations *)
        case res.0 of
          Some(op) -> operations := op # operations
        | None     -> skip
        end;

        (* Update user's earned tokens amount *)
        user.prev_earned := user.staked * farm.rps;

        (* Save user's info in the farm *)
        s.users_info[(farm.fid, Tezos.sender)] := user;

        (* Save farm to the storage *)
        s.farms[farm.fid] := farm;
      }
    | _                                 -> skip
    end
  } with (operations, s)

(* Burn bakers rewards (XTZ) *)
function burn_xtz_rewards(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    (* Operations to be performed *)
    var operations : list(operation) := no_operations;

    case action of
      Burn_xtz_rewards(fid)             -> {
        (* Check of admin permissions *)
        only_admin(s.admin);

        (* Retrieve farm from the storage *)
        const farm : farm_type = get_farm(fid, s);

        (* Ensure farm is LP token farm *)
        if not farm.stake_params.is_lp_staked_token
        then failwith("QFarm/not-LP-farm")
        else skip;

        (* Get LP token address *)
        const lp_token : address = case farm.stake_params.staked_token of
          FA12(token_address) -> token_address
        | FA2(token_info)     -> token_info.token
        end;

        (* Prepare operation for withdrawing bakers rewards from the LP *)
        operations := Tezos.transaction(
          WithdrawProfit(s.burner),
          0mutez,
          get_quipuswap_use_entrypoint(lp_token)
        ) # operations;
      }
    | _                                 -> skip
    end
  } with (operations, s)

(* Burn farm rewards *)
function burn_farm_rewards(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    (* Operations to be performed *)
    var operations : list(operation) := no_operations;

    case action of
      Burn_farm_rewards(fid)            -> {
        (* Retrieve farm from the storage *)
        var farm : farm_type := get_farm(fid, s);

        (* Update rewards for the farm *)
        s := update_farm_rewards(farm, s);

        (* Retrieve user data for the specified farm *)
        var user : user_info_type :=
          get_user_info(farm.fid, Tezos.self_address, s);

        (* Update users's reward *)
        user.earned := user.earned +
          abs(user.staked * farm.rps - user.prev_earned);

        (* Burn QS GOV tokens (farm's rewards) *)
        var res : (option(operation) * user_info_type) :=
          burn_rewards(user, True, s);

        (* Update user's info *)
        user := res.1;

        (* Concat burn QS GOV tokens operation with list of operations *)
        case res.0 of
          Some(op) -> operations := op # operations
        | None     -> skip
        end;

        (* Update user's earned tokens amount *)
        user.prev_earned := user.staked * farm.rps;

        (* Save user's info in the farm *)
        s.users_info[(farm.fid, Tezos.self_address)] := user;

        (* Save farm to the storage *)
        s.farms[farm.fid] := farm;
      }
    | _                                 -> skip
    end
  } with (operations, s)

(*
  Receive divested/staked FA1.2 token balance and swap them for XTZ. XTZ swap
  for QS GOV tokens. Burn all outputted QS GOV tokens
*)
function fa12_tok_bal_callback(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    (* Operations to be performed *)
    var operations : list(operation) := no_operations;

    case action of
      Fa12_tok_bal_callback(bal)        -> {
        (* Prepare operations for swaps *)
        const res : return_type = swap(bal, s);

        (* Update operations and storage *)
        operations := res.0;
        s := res.1;

        (* Reset temporary record *)
        s := reset_temp(s);
      }
    | _                                 -> skip
    end
  } with (operations, s)

(*
  Receive divested/staked FA2 token balance and swap them for XTZ. XTZ swap
  for QS GOV tokens. Burn all outputted QS GOV tokens
*)
function fa2_tok_bal_callback(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    (* Operations to be performed *)
    var operations : list(operation) := no_operations;

    case action of
      Fa2_tok_bal_callback(response)    -> {
        (* Get FA2 token ID *)
        const token_id : token_id_type = case s.temp.token of
          FA12(_)         -> 0n
        | FA2(token_info) -> token_info.id
        end;

        (* Get balance of the token with the specified ID *)
        const bal : nat = get_fa2_token_balance(
          response,
          Tezos.self_address,
          token_id
        );
        (* Prepare operations for swaps *)
        const res : return_type = swap(bal, s);

        (* Update operations and storage *)
        operations := res.0;
        s := res.1;

        (* Reset temporary record *)
        s := reset_temp(s);
      }
    | _                                 -> skip
    end
  } with (operations, s)

(*
  Withdraw tokens deposited from farm's name. Divest liquidity if LP token is
  staked. Swap all divested/staked tokens to QS GOV. Burn all outputted QS GOV
  tokens

  !DEV! order of operations creating is fully reverted cause of Ligo's
  features: items can only be added to the beginning of the list
*)
function buyback(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    (* Operations to be performed *)
    var operations : list(operation) := no_operations;

    case action of
      Buyback(params)                   -> {
        (* Check of admin permissions *)
        only_admin(s.admin);

        (* Retrieve farm from the storage *)
        var farm : farm_type := get_farm(params.fid, s);

        (* Update rewards for the farm *)
        s := update_farm_rewards(farm, s);

        (* Retrieve user data for the specified farm *)
        var user : user_info_type :=
          get_user_info(farm.fid, Tezos.self_address, s);

        (* Value for withdrawal *)
        var value : nat := params.amt;

        (* Process "withdraw all" *)
        if value = 0n
        then value := user.staked
        else skip;

        (* Check the correct withdrawal quantity *)
        if value > user.staked
        then failwith("QFarm/balance-too-low")
        else skip;

        (* Update users's reward *)
        user.earned := user.earned +
          abs(user.staked * farm.rps - user.prev_earned);

        (* Update user's staked and earned tokens amount *)
        user.staked := abs(user.staked - value);
        user.prev_earned := user.staked * farm.rps;

        (* Reset user's timelock *)
        user.last_staked := Tezos.now;

        (* Save user's info in the farm and update farm's staked amount *)
        s.users_info[(farm.fid, Tezos.self_address)] := user;
        farm.staked := abs(farm.staked - value);

        (* Save farm to the storage *)
        s.farms[farm.fid] := farm;

        (* Save min amount of QS GOV tokens received after exchange *)
        s.temp.min_qs_gov_output := params.min_qs_gov_output;

        (* Save Quipuswap liquidity pool address for token to XTZ exchange *)
        s.temp.qs_pool := farm.stake_params.qs_pool;

        if not farm.stake_params.is_lp_staked_token
        then {
          (* Save staked token info temporary params *)
          s.temp.token := farm.stake_params.staked_token;

          (* Check staked token type *)
          case farm.stake_params.staked_token of
            FA12(_)             -> {
            (* Swap all staked tokens for QS GOV tokens and burn them *)
            const res : return_type = fa12_tok_bal_callback(
              Fa12_tok_bal_callback(value),
              s
            );

            (* Update list of operations and storage *)
            operations := res.0;
            s := res.1;
          }
          | FA2(token_info)     -> {
            (* Swap all staked tokens for QS GOV tokens and burn them *)
            const res : return_type = fa2_tok_bal_callback(
              Fa2_tok_bal_callback(list [
                record [
                  request = record [
                    owner    = Tezos.self_address;
                    token_id = token_info.id;
                  ];
                  balance = value;
                ]
              ]),
              s
            );

            (* Update list of operations and storage *)
            operations := res.0;
            s := res.1;
          }
          end;
        }
        else {
          (* Save divested token info temporary params *)
          s.temp.token := farm.stake_params.token;

          (* Check divested token type *)
          case farm.stake_params.token of
            FA12(token_address) -> {
            (* FA1.2 %balance_of operation for the divested token *)
            operations := Tezos.transaction(
              FA12_balance_of_type(
                Tezos.self_address,
                get_fa12_tok_bal_callback_entrypoint(Tezos.self_address)
              ),
              0mutez,
              get_fa12_token_balance_of_entrypoint(token_address)
            ) # operations;
          }
          | FA2(token_info)     -> {
            (* Prepare params for FA2 %balance_of operation *)
            const balance_of_params : balance_of_type = record [
              requests = list [
                record [
                  owner    = Tezos.self_address;
                  token_id = token_info.id;
                ]
              ];
              callback = get_fa2_tok_bal_callback_entrypoint(
                Tezos.self_address
              )
            ];

            (* FA2 %balance_of operation for the divested token *)
            operations := Tezos.transaction(
              balance_of_params,
              0mutez,
              get_fa2_token_balance_of_entrypoint(token_info.token)
            ) # operations;
          }
          end;

          (* Check farm is LP token farm *)
          if not farm.stake_params.is_lp_staked_token
          then skip
          else { (* Divest liquidity *)
            (* Params for liquidity divestment *)
            const divest_liquidity_params : divest_liq_type = record [
              min_tez    = 1n;
              min_tokens = 1n;
              shares     = value;
            ];

            (* Get LP token address *)
            const lp_token : address = case farm.stake_params.staked_token of
              FA12(token_address) -> token_address
            | FA2(token_info)     -> token_info.token
            end;

            (* Divest liquidity operation *)
            operations := Tezos.transaction(
              DivestLiquidity(divest_liquidity_params),
              0mutez,
              get_quipuswap_use_entrypoint(lp_token)
            ) # operations;
          };
        };
      }
    | _                                 -> skip
    end
  } with(operations, s)
