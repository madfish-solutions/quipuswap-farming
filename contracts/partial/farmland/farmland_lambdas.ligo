function set_admin(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(admin)                  -> {
        only_admin(Tezos.sender, s.admin);

        s.pending_admin := admin;
      }
    | Confirm_admin                     -> skip
    | Set_alloc_points(_)               -> skip
    | Set_fees(_)                       -> skip
    | Set_reward_per_second(_)          -> skip
    | Set_burner(_)                     -> skip
    | Set_proxy_minter(_)               -> skip
    | Add_new_farm(_)                   -> skip
    | Deposit(_)                        -> skip
    | Withdraw(_)                       -> skip
    | Harvest(_)                        -> skip
    | Burn(_)                           -> skip
    end
  } with (no_operations, s)

function confirm_admin(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(_)                      -> skip
    | Confirm_admin                     -> {
      only_pending_admin(Tezos.sender, s.pending_admin);

      s.admin := s.pending_admin;
      s.pending_admin := zero_address;
    }
    | Set_alloc_points(_)               -> skip
    | Set_fees(_)                       -> skip
    | Set_reward_per_second(_)          -> skip
    | Set_burner(_)                     -> skip
    | Set_proxy_minter(_)               -> skip
    | Add_new_farm(_)                   -> skip
    | Deposit(_)                        -> skip
    | Withdraw(_)                       -> skip
    | Harvest(_)                        -> skip
    | Burn(_)                           -> skip
    end
  } with (no_operations, s)

function set_alloc_points(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(_)                      -> skip
    | Confirm_admin                     -> skip
    | Set_alloc_points(params)          -> {
      only_admin(Tezos.sender, s.admin);

      function set_alloc_point(
        var s           : storage_type;
        const params    : set_alloc_type)
                        : storage_type is
        block {
          var farm : farm_type := get_farm(params.fid, s);

          if params.with_update
          then s := update_farm_rewards(params.fid, s)
          else skip;

          if s.total_alloc_point >= farm.alloc_point
          then {
            s.total_alloc_point := abs(
              s.total_alloc_point - farm.alloc_point
            ) + params.alloc_point;
          }
          else skip;

          farm.alloc_point := params.alloc_point;
          s.farms[params.fid] := farm;
        } with s;

      s := List.fold(set_alloc_point, params, s);
    }
    | Set_fees(_)                       -> skip
    | Set_reward_per_second(_)          -> skip
    | Set_burner(_)                     -> skip
    | Set_proxy_minter(_)               -> skip
    | Add_new_farm(_)                   -> skip
    | Deposit(_)                        -> skip
    | Withdraw(_)                       -> skip
    | Harvest(_)                        -> skip
    | Burn(_)                           -> skip
    end
  } with (no_operations, s)

function set_fees(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(_)                      -> skip
    | Confirm_admin                     -> skip
    | Set_alloc_points(_)               -> skip
    | Set_fees(params)                  -> {
      only_admin(Tezos.sender, s.admin);

      function set_fee(
        var s           : storage_type;
        const params    : set_fee_type)
                        : storage_type is
        block {
          var farm : farm_type := get_farm(params.fid, s);

          farm.fees := params.fees;
          s.farms[params.fid] := farm;
        } with s;

      s := List.fold(set_fee, params, s);
    }
    | Set_reward_per_second(_)          -> skip
    | Set_burner(_)                     -> skip
    | Set_proxy_minter(_)               -> skip
    | Add_new_farm(_)                   -> skip
    | Deposit(_)                        -> skip
    | Withdraw(_)                       -> skip
    | Harvest(_)                        -> skip
    | Burn(_)                           -> skip
    end
  } with (no_operations, s)

function set_reward_per_second(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(_)                      -> skip
    | Confirm_admin                     -> skip
    | Set_alloc_points(_)               -> skip
    | Set_fees(_)                       -> skip
    | Set_reward_per_second(rps)        -> {
      only_admin(Tezos.sender, s.admin);

      s.qsgov_per_second := rps;
    }
    | Set_burner(_)                     -> skip
    | Set_proxy_minter(_)               -> skip
    | Add_new_farm(_)                   -> skip
    | Deposit(_)                        -> skip
    | Withdraw(_)                       -> skip
    | Harvest(_)                        -> skip
    | Burn(_)                           -> skip
    end
  } with (no_operations, s)

function set_burner(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(_)                      -> skip
    | Confirm_admin                     -> skip
    | Set_alloc_points(_)               -> skip
    | Set_fees(_)                       -> skip
    | Set_reward_per_second(_)          -> skip
    | Set_burner(burner)                -> {
      only_admin(Tezos.sender, s.admin);

      s.burner := burner;
    }
    | Set_proxy_minter(_)               -> skip
    | Add_new_farm(_)                   -> skip
    | Deposit(_)                        -> skip
    | Withdraw(_)                       -> skip
    | Harvest(_)                        -> skip
    | Burn(_)                           -> skip
    end
  } with (no_operations, s)

function set_proxy_minter(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(_)                      -> skip
    | Confirm_admin                     -> skip
    | Set_alloc_points(_)               -> skip
    | Set_fees(_)                       -> skip
    | Set_reward_per_second(_)          -> skip
    | Set_burner(_)                     -> skip
    | Set_proxy_minter(proxy_minter)    -> {
      only_admin(Tezos.sender, s.admin);

      s.proxy_minter := proxy_minter;
    }
    | Add_new_farm(_)                   -> skip
    | Deposit(_)                        -> skip
    | Withdraw(_)                       -> skip
    | Harvest(_)                        -> skip
    | Burn(_)                           -> skip
    end
  } with (no_operations, s)

function add_new_farm(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(_)                      -> skip
    | Confirm_admin                     -> skip
    | Set_alloc_points(_)               -> skip
    | Set_fees(_)                       -> skip
    | Set_reward_per_second(_)          -> skip
    | Set_burner(_)                     -> skip
    | Set_proxy_minter(_)               -> skip
    | Add_new_farm(params)              -> {
      only_admin(Tezos.sender, s.admin);

      if params.start_block < Tezos.level
      then failwith("Farmland/wrong-start-block")
      else skip;

      s.total_alloc_point := s.total_alloc_point + params.alloc_point;
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
      s.farms_count := s.farms_count + 1n;
    }
    | Deposit(_)                        -> skip
    | Withdraw(_)                       -> skip
    | Harvest(_)                        -> skip
    | Burn(_)                           -> skip
    end
  } with (no_operations, s)

function deposit(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations : list(operation) := no_operations;

    case action of
      Set_admin(_)                      -> skip
    | Confirm_admin                     -> skip
    | Set_alloc_points(_)               -> skip
    | Set_fees(_)                       -> skip
    | Set_reward_per_second(_)          -> skip
    | Set_burner(_)                     -> skip
    | Set_proxy_minter(_)               -> skip
    | Add_new_farm(_)                   -> skip
    | Deposit(params)                   -> {
      s := update_farm_rewards(params.fid, s);

      var farm : farm_type := get_farm(params.fid, s);
      var user : user_info_type := get_user_info(params.fid, Tezos.sender, s);

      user.earned := user.earned +
        abs(user.staked * farm.rps - user.prev_earned);

      const res : (list(operation) * user_info_type) = claim_rewards(
        user,
        farm,
        params.rewards_receiver,
        s
      );

      user := res.1;

      case params.referrer of
        None    -> skip
      | Some(_) -> user.referrer := params.referrer
      end;

      user.staked := user.staked + params.amt;
      user.prev_earned := user.staked * farm.rps;

      farm.users_info[Tezos.sender] := user;
      farm.staked := farm.staked + params.amt;

      s.farms[params.fid] := farm;

      if farm.is_fa2_token
      then {
        const dst : transfer_dst_type = record [
          to_      = Tezos.self_address;
          token_id = farm.staked_token.id;
          amount   = params.amt;
        ];
        const fa2_transfer_param : fa2_send_type = record [
          from_ = Tezos.sender;
          txs   = list [dst];
        ];

        operations := Tezos.transaction(
          FA2_transfer_type(list [fa2_transfer_param]),
          0mutez,
          get_fa2_token_transfer_entrypoint(farm.staked_token.token)
        ) # operations;
      }
      else {
        operations := Tezos.transaction(
          FA12_transfer_type(Tezos.sender, (Tezos.self_address, params.amt)),
          0mutez,
          get_fa12_token_transfer_entrypoint(farm.staked_token.token)
        ) # operations;
      };

      operations := concat_op_lists(operations, res.0);
    }
    | Withdraw(_)                       -> skip
    | Harvest(_)                        -> skip
    | Burn(_)                           -> skip
    end
  } with (operations, s)

function withdraw(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations : list(operation) := no_operations;

    case action of
      Set_admin(_)                      -> skip
    | Confirm_admin                     -> skip
    | Set_alloc_points(_)               -> skip
    | Set_fees(_)                       -> skip
    | Set_reward_per_second(_)          -> skip
    | Set_burner(_)                     -> skip
    | Set_proxy_minter(_)               -> skip
    | Add_new_farm(_)                   -> skip
    | Deposit(_)                        -> skip
    | Withdraw(params)                  -> {
      s := update_farm_rewards(params.fid, s);

      var farm : farm_type := get_farm(params.fid, s);
      var user : user_info_type := get_user_info(params.fid, Tezos.sender, s);
      var value : nat := params.amt;

      user.earned := user.earned +
        abs(user.staked * farm.rps - user.prev_earned);

      const res : (list(operation) * user_info_type) = claim_rewards(
        user,
        farm,
        params.rewards_receiver,
        s
      );

      user := res.1;

      if value = 0n
      then value := user.staked
      else skip;

      if value <= user.staked
      then skip
      else failwith("Farmland/balance-too-low");

      user.staked := abs(user.staked - value);
      user.prev_earned := user.staked * farm.rps;

      farm.users_info[Tezos.sender] := user;
      farm.staked := abs(farm.staked - value);

      s.farms[params.fid] := farm;

      if farm.is_fa2_token
      then {
        const dst : transfer_dst_type = record [
          to_      = params.receiver;
          token_id = farm.staked_token.id;
          amount   = value;
        ];
        const fa2_transfer_param : fa2_send_type = record [
          from_ = Tezos.self_address;
          txs   = list [dst];
        ];

        operations := Tezos.transaction(
          FA2_transfer_type(list [fa2_transfer_param]),
          0mutez,
          get_fa2_token_transfer_entrypoint(farm.staked_token.token)
        ) # operations;
      }
      else {
        operations := Tezos.transaction(
          FA12_transfer_type(Tezos.self_address, (params.receiver, value)),
          0mutez,
          get_fa12_token_transfer_entrypoint(farm.staked_token.token)
        ) # operations;
      };

      operations := concat_op_lists(operations, res.0);
    }
    | Harvest(_)                        -> skip
    | Burn(_)                           -> skip
    end
  } with (operations, s)

function harvest(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations : list(operation) := no_operations;

    case action of
      Set_admin(_)                      -> skip
    | Confirm_admin                     -> skip
    | Set_alloc_points(_)               -> skip
    | Set_fees(_)                       -> skip
    | Set_reward_per_second(_)          -> skip
    | Set_burner(_)                     -> skip
    | Set_proxy_minter(_)               -> skip
    | Add_new_farm(_)                   -> skip
    | Deposit(_)                        -> skip
    | Withdraw(_)                       -> skip
    | Harvest(params)                   -> {
      s := update_farm_rewards(params.fid, s);

      var farm : farm_type := get_farm(params.fid, s);
      var user : user_info_type := get_user_info(params.fid, Tezos.sender, s);

      user.earned := user.earned +
        abs(user.staked * farm.rps - user.prev_earned);

      const res : (list(operation) * user_info_type) = claim_rewards(
        user,
        farm,
        params.rewards_receiver,
        s
      );

      operations := concat_op_lists(operations, res.0);

      user := res.1;

      user.prev_earned := user.staked * farm.rps;

      farm.users_info[Tezos.sender] := user;

      s.farms[params.fid] := farm;
    }
    | Burn(_)                           -> skip
    end
  } with (operations, s)

function burn(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations : list(operation) := no_operations;

    case action of
      Set_admin(_)                      -> skip
    | Confirm_admin                     -> skip
    | Set_alloc_points(_)               -> skip
    | Set_fees(_)                       -> skip
    | Set_reward_per_second(_)          -> skip
    | Set_burner(_)                     -> skip
    | Set_proxy_minter(_)               -> skip
    | Add_new_farm(_)                   -> skip
    | Deposit(_)                        -> skip
    | Withdraw(_)                       -> skip
    | Harvest(_)                        -> skip
    | Burn(fid)                         -> {
      only_admin(Tezos.sender, s.admin);

      const farm : farm_type = get_farm(fid, s);

      if not farm.is_lp_farm
      then failwith("Farmland/not-LP-farm")
      else skip;

      operations := Tezos.transaction(
        WithdrawProfit(s.burner),
        0mutez,
        get_quipuswap_use_entrypoint(farm.staked_token.token)
      ) # operations;
    }
    end
  } with (operations, s)
