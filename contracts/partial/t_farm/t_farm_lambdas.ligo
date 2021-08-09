(* Set new admin *)
function set_admin(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(admin)                  -> {
        (* Check of admin permissions *)
        only_admin(Tezos.sender, s.admin);

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
        only_pending_admin(Tezos.sender, s.pending_admin);

        (* Setup new admin and reset pending admin *)
        s.admin := s.pending_admin;
        s.pending_admin := zero_address;
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
        only_admin(Tezos.sender, s.admin);

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
            s.farms[params.fid] := farm;
          } with s;

        (* Update fees *)
        s := List.fold(set_fee, params, s);
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
        only_admin(Tezos.sender, s.admin);

        (* Update burner *)
        s.burner := burner;
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
        only_admin(Tezos.sender, s.admin);

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
    (* Operations to be performed *)
    var operations : list(operation) := no_operations;

    case action of
      Add_new_farm(params)              -> {
        (* Check of admin permissions *)
        only_admin(Tezos.sender, s.admin);

        (* Ensure start timestamp is correct *)
        if params.start_time < Tezos.now
        then failwith("TFarm/wrong-start-block")
        else skip;

        (* Ensure end timestamp is correct *)
        if params.end_time <= params.start_time
        then failwith("TFarm/wrong-end-block")
        else skip;

        (* Add new farm info to the storage *)
        s.farms[s.farms_count] := record [
          users_info        = (Map.empty : map(address, user_info_type));
          votes             = (Map.empty : map(key_hash, nat));
          candidates        = (Map.empty : map(address, key_hash));
          fees              = params.fees;
          upd               = Tezos.now;
          stake_params      = params.stake_params;
          reward_token      = params.reward_token;
          timelock          = params.timelock;
          current_delegated = zero_key_hash;
          current_candidate = zero_key_hash;
          paused            = params.paused;
          reward_per_second = params.reward_per_second;
          rps               = 0n;
          staked            = 0n;
          start_time        = params.start_time;
          end_time          = params.end_time;
          fid               = s.farms_count;
          total_votes       = 0n;
        ];

        (* Update farms count *)
        s.farms_count := s.farms_count + 1n;

        (* Calculate reward tokens amount to be transferred to contract *)
        const rew_amt : nat = abs(params.end_time - params.start_time) *
          params.reward_per_second;

        (* Check reward token standard *)
        if params.reward_token.is_fa2
        then {
          (* Prepare FA2 token transfer params *)
          const dst : transfer_dst_type = record [
            to_      = Tezos.self_address;
            token_id = params.reward_token.id;
            amount   = rew_amt;
          ];
          const fa2_transfer_param : fa2_send_type = record [
            from_ = Tezos.sender;
            txs   = list [dst];
          ];

          (* Prepare FA2 transfer operation for reward token *)
          operations := Tezos.transaction(
            FA2_transfer_type(list [fa2_transfer_param]),
            0mutez,
            get_fa2_token_transfer_entrypoint(
              params.reward_token.token
            )
          ) # operations;
        }
        else {
          (* Prepare FA1.2 transfer operation for reward token *)
          operations := Tezos.transaction(
            FA12_transfer_type(Tezos.sender, (Tezos.self_address, rew_amt)),
            0mutez,
            get_fa12_token_transfer_entrypoint(params.reward_token.token)
          ) # operations;
        };
      }
    | _                                 -> skip
    end
  } with (operations, s)

(* Pause or unpause farms *)
function pause_farms(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Pause_farms(params)               -> {
        (* Check of admin permissions *)
        only_admin(Tezos.sender, s.admin);

        (* Pause or unpause the specified farm *)
        function pause_farm(
          var s           : storage_type;
          const params    : pause_farm_type)
                          : storage_type is
          block {
            (* Retrieve farm from the storage *)
            var farm : farm_type := get_farm(params.fid, s);

            (* Pause or unpause the farm *)
            farm.paused := params.pause;

            (* Save farm to the storage *)
            s.farms[params.fid] := farm;
          } with s;

        (* Pause or unpause farms from params list *)
        s := List.fold(pause_farm, params, s);
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

        if farm.paused
        then failwith("TFarm/farm-is-paused")
        else skip;

        (* Update rewards for the farm *)
        s := update_farm_rewards(farm, s);

        (* Retrieve user data for the specified farm *)
        var user : user_info_type := get_user_info(farm, Tezos.sender);

        (* Update users's reward *)
        user.earned := user.earned +
          abs(user.staked * farm.rps - user.prev_earned);

        (* Prepare claiming params *)
        var res : (list(operation) * user_info_type) := (operations, user);

        (* Check timelock (if timelock is finished - claim rewards) *)
        if abs(Tezos.now - user.last_staked) >= farm.timelock.duration
        then {
          res := claim_rewards(
            user,
            operations,
            farm,
            params.rewards_receiver,
            s
          )
        }
        else skip;

        (* Update user's info *)
        user := res.1;

        (* Update user's referrer *)
        case params.referrer of
          None      -> skip
        | Some(referrer) -> {
          if referrer = Tezos.sender
          then failwith("TFarm/can-not-refer-yourself")
          else s.referrers[Tezos.sender] := referrer;
        }
        end;

        (* Update user's staked and earned tokens amount *)
        user.staked := user.staked + params.amt;
        user.prev_earned := user.staked * farm.rps;

        (* Reset user's timelock *)
        user.last_staked := Tezos.now;

        (* Save user's info in the farm and update farm's staked amount *)
        farm.users_info[Tezos.sender] := user;
        farm.staked := farm.staked + params.amt;

        (* Save farm to the storage *)
        s.farms[params.fid] := farm;

        (* Check the staked token standard *)
        if farm.stake_params.staked_token.is_fa2
        then {
          (* Prepare FA2 token transfer params *)
          const dst : transfer_dst_type = record [
            to_      = Tezos.self_address;
            token_id = farm.stake_params.staked_token.id;
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
            get_fa2_token_transfer_entrypoint(
              farm.stake_params.staked_token.token
            )
          ) # operations;
        }
        else {
          (* Prepare FA1.2 transfer operation for staked token *)
          operations := Tezos.transaction(
            FA12_transfer_type(Tezos.sender, (Tezos.self_address, params.amt)),
            0mutez,
            get_fa12_token_transfer_entrypoint(
              farm.stake_params.staked_token.token
            )
          ) # operations;
        };

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

        (* Concat claim rewards operations with list of operations *)
        operations := concat_op_lists(res.0, operations);
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
        var user : user_info_type := get_user_info(farm, Tezos.sender);

        (* Value for withdrawal (without calculated withdrawal fee) *)
        var value : nat := params.amt;

        (* Process "withdraw all" *)
        if value = 0n
        then value := user.staked
        else skip;

        (* Check the correct withdrawal quantity *)
        if value > user.staked
        then failwith("TFarm/balance-too-low")
        else skip;

        (* Actual value for withdrawal (with calculated withdrawal fee) *)
        var actual_value : nat := value;

        (* Update users's reward *)
        user.earned := user.earned +
          abs(user.staked * farm.rps - user.prev_earned);

        (* Prepare claiming params *)
        var res : (list(operation) * user_info_type) := (operations, user);

        (*
          Check timelock (if timelock is finished - claim,
          else - trasfer to admin)
        *)
        if abs(Tezos.now - user.last_staked) >= farm.timelock.duration
        then {
          res := claim_rewards(
            user,
            operations,
            farm,
            params.rewards_receiver,
            s
          )
        }
        else { (* Burn reward and stake withdrawal fee from farm's name *)
          (* Burn reward tokens *)
          res := transfer_rewards_to_admin(user, operations, farm, s.admin);

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
              get_user_info(farm, Tezos.self_address);

            (* Update farm users's earned amount *)
            farm_user.earned := farm_user.earned +
              abs(farm_user.staked * farm.rps - farm_user.prev_earned);

            (* Update farm user's staked and previous earned tokens amount *)
            farm_user.staked := farm_user.staked + withdrawal_fee;
            farm_user.prev_earned := farm_user.staked * farm.rps;

            (* Reset farm user's timelock *)
            farm_user.last_staked := Tezos.now;

            (* Save farm user's info in the farm *)
            farm.users_info[Tezos.self_address] := farm_user;
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
        farm.users_info[Tezos.sender] := user;
        farm.staked := abs(farm.staked - actual_value);

        (* Save farm to the storage *)
        s.farms[params.fid] := farm;

        (* Check the staked token standard *)
        if farm.stake_params.staked_token.is_fa2
        then {
          (* Prepare FA2 token transfer params *)
          const dst : transfer_dst_type = record [
            to_      = params.receiver;
            token_id = farm.stake_params.staked_token.id;
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
            get_fa2_token_transfer_entrypoint(
              farm.stake_params.staked_token.token
            )
          ) # operations;
        }
        else {
          (* Prepare FA1.2 transfer operation for staked token *)
          operations := Tezos.transaction(
            FA12_transfer_type(Tezos.self_address,
              (params.receiver, actual_value)
            ),
            0mutez,
            get_fa12_token_transfer_entrypoint(
              farm.stake_params.staked_token.token
            )
          ) # operations;
        };

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

        (* Concat claim or burn rewards operations with list of operations *)
        operations := concat_op_lists(res.0, operations);
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
        var user : user_info_type := get_user_info(farm, Tezos.sender);

        (* Update users's reward *)
        user.earned := user.earned +
          abs(user.staked * farm.rps - user.prev_earned);

        (* Prepare claiming params *)
        var res : (list(operation) * user_info_type) := (operations, user);

        (* Check timelock (if timelock is finished - claim rewards) *)
        if abs(Tezos.now - user.last_staked) >= farm.timelock.duration
        then {
          res := claim_rewards(
            user,
            operations,
            farm,
            params.rewards_receiver,
            s
          )
        }
        else failwith("TFarm/timelock-is-not-finished");

        (* Update user's info *)
        user := res.1;

        (* Concat claim rewards operations with list of operations *)
        operations := concat_op_lists(res.0, operations);

        (* Update user's earned tokens amount *)
        user.prev_earned := user.staked * farm.rps;

        (* Save user's info in the farm *)
        farm.users_info[Tezos.sender] := user;

        (* Save farm to the storage *)
        s.farms[params.fid] := farm;
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
        only_admin(Tezos.sender, s.admin);

        (* Retrieve farm from the storage *)
        const farm : farm_type = get_farm(fid, s);

        (* Ensure farm is LP token farm *)
        if not farm.stake_params.is_lp_staked_token
        then failwith("TFarm/not-LP-farm")
        else skip;

        (* Prepare operation for withdrawing bakers rewards from the LP *)
        operations := Tezos.transaction(
          WithdrawProfit(s.burner),
          0mutez,
          get_quipuswap_use_entrypoint(farm.stake_params.staked_token.token)
        ) # operations;
      }
    | _                                 -> skip
    end
  } with (operations, s)

(* Claim farm rewards (only for admin) *)
function claim_farm_rewards(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    (* Operations to be performed *)
    var operations : list(operation) := no_operations;

    case action of
      Claim_farm_rewards(fid)           -> {
        (* Check of admin permissions *)
        only_admin(Tezos.sender, s.admin);

        (* Retrieve farm from the storage *)
        var farm : farm_type := get_farm(fid, s);

        (* Update rewards for the farm *)
        s := update_farm_rewards(farm, s);

        (* Retrieve user data for the specified farm *)
        var user : user_info_type := get_user_info(farm, Tezos.self_address);

        (* Update users's reward *)
        user.earned := user.earned +
          abs(user.staked * farm.rps - user.prev_earned);

        (* Claim reward tokens (farm's rewards) and transfer them to admin *)
        var res : (list(operation) * user_info_type) :=
          transfer_rewards_to_admin(user, operations, farm, s.admin);

        (* Update user's info *)
        user := res.1;

        (* Concat burn reward tokens operation with list of operations *)
        operations := res.0;

        (* Update user's earned tokens amount *)
        user.prev_earned := user.staked * farm.rps;

        (* Save user's info in the farm *)
        farm.users_info[Tezos.self_address] := user;

        (* Save farm to the storage *)
        s.farms[fid] := farm;
      }
    | _                                 -> skip
    end
  } with (operations, s)

(* Withdraw farm's deposited tokens (only for admin) *)
function withdraw_farm_depo(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    (* Operations to be performed *)
    var operations : list(operation) := no_operations;

    case action of
      Withdraw_farm_depo(params)        -> {
        (* Check of admin permissions *)
        only_admin(Tezos.sender, s.admin);

        (* Retrieve farm from the storage *)
        var farm : farm_type := get_farm(params.fid, s);

        (* Update rewards for the farm *)
        s := update_farm_rewards(farm, s);

        (* Retrieve user data for the specified farm *)
        var user : user_info_type := get_user_info(farm, Tezos.self_address);

        (* Value for withdrawal *)
        var value : nat := params.amt;

        (* Process "withdraw all" *)
        if value = 0n
        then value := user.staked
        else skip;

        (* Check the correct withdrawal quantity *)
        if value > user.staked
        then failwith("TFarm/balance-too-low")
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
        farm.users_info[Tezos.self_address] := user;
        farm.staked := abs(farm.staked - value);

        (* Save farm to the storage *)
        s.farms[params.fid] := farm;
      }
    | _                                 -> skip
    end
  } with(operations, s)