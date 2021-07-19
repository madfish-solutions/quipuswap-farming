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

(* Update allocation points for farms *)
function set_alloc_points(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_alloc_points(params)          -> {
        (* Check of admin permissions *)
        only_admin(Tezos.sender, s.admin);

        (* Update allocation point for the specified farm *)
        function set_alloc_point(
          var s           : storage_type;
          const params    : set_alloc_type)
                          : storage_type is
          block {
            (* Retrieve farm from the storage *)
            var farm : farm_type := get_farm(params.fid, s);

            (* Check if need to update farm's rewards *)
            if params.with_update
            then s := update_farm_rewards(params.fid, s) (* Update rewards *)
            else skip;

            (* Ensure total allocation point is correct *)
            if s.total_alloc_point < farm.alloc_point
            then failwith("Farmland/wrong-allocation-points-number")
            else skip;

            (* Update total allocation point *)
            s.total_alloc_point := abs(
              s.total_alloc_point - farm.alloc_point
            ) + params.alloc_point;

            (* Update farm's allocation point *)
            farm.alloc_point := params.alloc_point;

            (* Save farm to the storage *)
            s.farms[params.fid] := farm;
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

(* Update reward per second in QS GOV tokens *)
function set_reward_per_second(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_reward_per_second(rps)        -> {
        (* Check of admin permissions *)
        only_admin(Tezos.sender, s.admin);

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
        only_admin(Tezos.sender, s.admin);

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
        only_admin(Tezos.sender, s.admin);

        (* Update proxy minter *)
        s.proxy_minter := proxy_minter;
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
        only_admin(Tezos.sender, s.admin);

        (* Ensure start block is correct *)
        if params.start_block < Tezos.level
        then failwith("Farmland/wrong-start-block")
        else skip;

        (* Update total allocation point *)
        s.total_alloc_point := s.total_alloc_point + params.alloc_point;

        (* Add new farm info to the storage *)
        s.farms[s.farms_count] := record [
          users_info   = (Map.empty : map(address, user_info_type));
          fees         = params.fees;
          upd          = Tezos.now;
          staked_token = params.staked_token;
          reward_token = s.qsgov;
          is_lp_farm   = params.is_lp_farm;
          is_fa2_token = params.is_fa2_token;
          timelocked   = params.timelocked;
          alloc_point  = params.alloc_point;
          rps          = 0n;
          staked       = 0n;
          start_block  = params.start_block;
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
        (* Update rewards for the farm *)
        s := update_farm_rewards(params.fid, s);

        (* Retrieve farm from the storage *)
        var farm : farm_type := get_farm(params.fid, s);

        (* Retrieve user data for the specified farm *)
        var user : user_info_type :=
          get_user_info(params.fid, Tezos.sender, s);

        (* Claim user's rewards *)
        const res : (option(operation) * user_info_type) = claim_rewards(
          user,
          farm,
          params.rewards_receiver,
          s
        );

        (* Update user's info *)
        user := res.1;

        (* Update user's referrer *)
        case params.referrer of
          None    -> skip
        | Some(_) -> user.referrer := params.referrer
        end;

        (* Update user's staked and earned tokens amount *)
        user.staked := user.staked + params.amt;
        user.prev_earned := user.staked * farm.rps;

        (* Save user's info in the farm and update farm's staked amount *)
        farm.users_info[Tezos.sender] := user;
        farm.staked := farm.staked + params.amt;

        (* Save farm to the storage *)
        s.farms[params.fid] := farm;

        (* Check the staked token standard *)
        if farm.is_fa2_token
        then {
          (* Prepare FA2 token transfer params *)
          const dst : transfer_dst_type = record [
            to_      = Tezos.self_address;
            token_id = farm.staked_token.id;
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
            get_fa2_token_transfer_entrypoint(farm.staked_token.token)
          ) # operations;
        }
        else {
          (* Prepare FA1.2 transfer operation for staked token *)
          operations := Tezos.transaction(
            FA12_transfer_type(Tezos.sender, (Tezos.self_address, params.amt)),
            0mutez,
            get_fa12_token_transfer_entrypoint(farm.staked_token.token)
          ) # operations;
        };

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
        (* Update rewards for the farm *)
        s := update_farm_rewards(params.fid, s);

        (* Retrieve farm from the storage *)
        var farm : farm_type := get_farm(params.fid, s);

        (* Retrieve user data for the specified farm *)
        var user : user_info_type :=
          get_user_info(params.fid, Tezos.sender, s);
        var value : nat := params.amt;

        (* Claim user's rewards *)
        const res : (option(operation) * user_info_type) = claim_rewards(
          user,
          farm,
          params.rewards_receiver,
          s
        );

        (* Update user's info *)
        user := res.1;

        (* Process "withdraw all" *)
        if value = 0n
        then value := user.staked
        else skip;

        (* Check the correct withdrawal quantity *)
        if value > user.staked
        then failwith("Farmland/balance-too-low")
        else skip;

        (* Update user's staked and earned tokens amount *)
        user.staked := abs(user.staked - value);
        user.prev_earned := user.staked * farm.rps;

        (* Save user's info in the farm and update farm's staked amount *)
        farm.users_info[Tezos.sender] := user;
        farm.staked := abs(farm.staked - value);

        (* Save farm to the storage *)
        s.farms[params.fid] := farm;

        (* Check the staked token standard *)
        if farm.is_fa2_token
        then {
          (* Prepare FA2 token transfer params *)
          const dst : transfer_dst_type = record [
            to_      = params.receiver;
            token_id = farm.staked_token.id;
            amount   = value;
          ];
          const fa2_transfer_param : fa2_send_type = record [
            from_ = Tezos.self_address;
            txs   = list [dst];
          ];

          (* Prepare FA2 transfer operation for staked token *)
          operations := Tezos.transaction(
            FA2_transfer_type(list [fa2_transfer_param]),
            0mutez,
            get_fa2_token_transfer_entrypoint(farm.staked_token.token)
          ) # operations;
        }
        else {
          (* Prepare FA1.2 transfer operation for staked token *)
          operations := Tezos.transaction(
            FA12_transfer_type(Tezos.self_address, (params.receiver, value)),
            0mutez,
            get_fa12_token_transfer_entrypoint(farm.staked_token.token)
          ) # operations;
        };

        (* Concat claim rewards operation with list of operations *)
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
        (* Update rewards for the farm *)
        s := update_farm_rewards(params.fid, s);

        (* Retrieve farm from the storage *)
        var farm : farm_type := get_farm(params.fid, s);

        (* Retrieve user data for the specified farm *)
        var user : user_info_type :=
          get_user_info(params.fid, Tezos.sender, s);

        (* Claim user's rewards *)
        const res : (option(operation) * user_info_type) = claim_rewards(
          user,
          farm,
          params.rewards_receiver,
          s
        );

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
        farm.users_info[Tezos.sender] := user;

        (* Save farm to the storage *)
        s.farms[params.fid] := farm;
      }
    | _                                 -> skip
    end
  } with (operations, s)

(* Burn bakers rewards *)
function burn(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    (* Operations to be performed *)
    var operations : list(operation) := no_operations;

    case action of
      Burn(fid)                         -> {
        (* Check of admin permissions *)
        only_admin(Tezos.sender, s.admin);

        (* Retrieve farm from the storage *)
        const farm : farm_type = get_farm(fid, s);

        (* Ensure farm is LP token farm *)
        if not farm.is_lp_farm
        then failwith("Farmland/not-LP-farm")
        else skip;

        (* Prepare operation for withdrawing bakers rewards from the LP *)
        operations := Tezos.transaction(
          WithdrawProfit(s.burner),
          0mutez,
          get_quipuswap_use_entrypoint(farm.staked_token.token)
        ) # operations;
      }
    | _                                 -> skip
    end
  } with (operations, s)
