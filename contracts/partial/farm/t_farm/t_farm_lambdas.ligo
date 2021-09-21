function add_new_farm(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations : list(operation) := no_operations;

    case action of
      Add_new_farm(params)              -> {
        only_admin(s.admin);

        const start_time : timestamp = if params.start_time <= Tezos.now
          then Tezos.now
          else params.start_time;

        if params.end_time <= start_time
        then failwith("TFarm/wrong-end-time")
        else skip;

        if params.timelock > abs(params.end_time - params.start_time)
        then failwith("TFarm/wrong-timelock")
        else skip;

        s.farms[s.farms_count] := record [
          fees              = params.fees;
          upd               = start_time;
          stake_params      = params.stake_params;
          reward_token      = params.reward_token;
          timelock          = params.timelock;
          current_delegated = zero_key_hash;
          current_candidate = zero_key_hash;
          paused            = params.paused;
          reward_per_second = params.reward_per_second;
          rps               = 0n;
          staked            = 0n;
          start_time        = start_time;
          end_time          = params.end_time;
          fid               = s.farms_count;
        ];

        s.farms_count := s.farms_count + 1n;

        const rew_amt : nat = abs(params.end_time - params.start_time) *
          (params.reward_per_second / precision);

        case params.reward_token of
          FA12(token_address) -> {
          operations := Tezos.transaction(
            FA12_transfer_type(Tezos.sender, (Tezos.self_address, rew_amt)),
            0mutez,
            get_fa12_token_transfer_entrypoint(token_address)
          ) # operations;
        }
        | FA2(token_info)     -> {
          const dst : transfer_dst_type = record [
            to_      = Tezos.self_address;
            token_id = token_info.id;
            amount   = rew_amt;
          ];
          const fa2_transfer_param : fa2_send_type = record [
            from_ = Tezos.sender;
            txs   = list [dst];
          ];

          operations := Tezos.transaction(
            FA2_transfer_type(list [fa2_transfer_param]),
            0mutez,
            get_fa2_token_transfer_entrypoint(token_info.token)
          ) # operations;
        }
        end;
      }
    | _                                 -> skip
    end
  } with (operations, s)

function deposit(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations : list(operation) := no_operations;

    case action of
      Deposit(params)                   -> {
        var farm : farm_type := get_farm(params.fid, s);

        if farm.paused
        then failwith("TFarm/farm-is-paused")
        else skip;

        const upd_res : (storage_type * farm_type) =
          update_farm_rewards(farm, s);

        s := upd_res.0;
        farm := upd_res.1;

        var user : user_info_type := get_user_info(farm.fid, Tezos.sender, s);

        user.earned := user.earned +
          abs(user.staked * farm.rps - user.prev_earned);

        var res : (list(operation) * user_info_type) := (operations, user);

        if abs(Tezos.now - user.last_staked) >= farm.timelock
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

        operations := res.0;
        user := res.1;

        case params.referrer of
          None      -> skip
        | Some(referrer) -> {
          if referrer = Tezos.sender
          then failwith("TFarm/can-not-refer-yourself")
          else s.referrers[Tezos.sender] := referrer;
        }
        end;

        user.staked := user.staked + params.amt;
        user.prev_earned := user.staked * farm.rps;

        if params.amt > 0n
        then user.last_staked := Tezos.now
        else skip;

        s.users_info[(farm.fid, Tezos.sender)] := user;

        farm.staked := farm.staked + params.amt;

        s.farms[farm.fid] := farm;

        if params.amt > 0n
        then {
          if farm.stake_params.is_lp_staked_token
          then {
            const vote_res : (list(operation) * storage_type) = vote(
              operations,
              user,
              farm,
              s,
              params
            );

            operations := vote_res.0;
            s := vote_res.1;
          }
          else skip;

          case farm.stake_params.staked_token of
            FA12(token_address) -> {
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
            const dst : transfer_dst_type = record [
              to_      = Tezos.self_address;
              token_id = token_info.id;
              amount   = params.amt;
            ];
            const fa2_transfer_param : fa2_send_type = record [
              from_ = Tezos.sender;
              txs   = list [dst];
            ];

            operations := Tezos.transaction(
              FA2_transfer_type(list [fa2_transfer_param]),
              0mutez,
              get_fa2_token_transfer_entrypoint(token_info.token)
            ) # operations;
          }
          end;
        }
        else skip;
      }
    | _                                 -> skip
    end
  } with (operations, s)

function withdraw(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations : list(operation) := no_operations;

    case action of
      Withdraw(params)                  -> {
        var farm : farm_type := get_farm(params.fid, s);
        const upd_res : (storage_type * farm_type) =
          update_farm_rewards(farm, s);

        s := upd_res.0;
        farm := upd_res.1;

        var user : user_info_type := get_user_info(farm.fid, Tezos.sender, s);
        var value : nat := params.amt;

        if value > user.staked
        then failwith("TFarm/balance-too-low")
        else skip;

        var actual_value : nat := value;

        user.earned := user.earned +
          abs(user.staked * farm.rps - user.prev_earned);

        var res : (list(operation) * user_info_type) := (operations, user);

        if abs(Tezos.now - user.last_staked) >= farm.timelock
        then {
          res := claim_rewards(
            user,
            operations,
            farm,
            params.rewards_receiver,
            s
          )
        }
        else {
          res := transfer_rewards_to_admin(
            user,
            operations,
            farm.reward_token,
            s.admin
          );

          actual_value := value *
            abs(100n * fee_precision - farm.fees.withdrawal_fee) /
            100n / fee_precision;

          const withdrawal_fee : nat = abs(value - actual_value);

          if withdrawal_fee = 0n
          then skip
          else {
            var farm_user : user_info_type :=
              get_user_info(farm.fid, Tezos.self_address, s);

            farm_user.earned := farm_user.earned +
              abs(farm_user.staked * farm.rps - farm_user.prev_earned);
            farm_user.staked := farm_user.staked + withdrawal_fee;
            farm_user.prev_earned := farm_user.staked * farm.rps;
            farm_user.last_staked := Tezos.now;

            s.users_info[(farm.fid, Tezos.self_address)] := farm_user;
          };
        };

        operations := res.0;
        user := res.1;

        user.staked := abs(user.staked - value);
        user.prev_earned := user.staked * farm.rps;

        s.users_info[(farm.fid, Tezos.sender)] := user;

        farm.staked := abs(farm.staked - actual_value);

        s.farms[farm.fid] := farm;

        case farm.stake_params.staked_token of
          FA12(token_address) -> {
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
          const dst : transfer_dst_type = record [
            to_      = params.receiver;
            token_id = token_info.id;
            amount   = actual_value;
          ];
          const fa2_transfer_param : fa2_send_type = record [
            from_ = Tezos.self_address;
            txs   = list [dst];
          ];

          operations := Tezos.transaction(
            FA2_transfer_type(list [fa2_transfer_param]),
            0mutez,
            get_fa2_token_transfer_entrypoint(token_info.token)
          ) # operations;
        }
        end;

        if farm.stake_params.is_lp_staked_token
        then {
          const revote_res : (list(operation) * storage_type) = revote(
            operations,
            user,
            farm,
            s,
            value
          );

          operations := revote_res.0;
          s := revote_res.1;
        }
        else skip;
      }
    | _                                 -> skip
    end
  } with (operations, s)

function harvest(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations : list(operation) := no_operations;

    case action of
      Harvest(params)                   -> {
        var farm : farm_type := get_farm(params.fid, s);
        const upd_res : (storage_type * farm_type) =
          update_farm_rewards(farm, s);

        s := upd_res.0;
        farm := upd_res.1;

        var user : user_info_type := get_user_info(farm.fid, Tezos.sender, s);

        user.earned := user.earned +
          abs(user.staked * farm.rps - user.prev_earned);

        var res : (list(operation) * user_info_type) := (operations, user);

        if abs(Tezos.now - user.last_staked) >= farm.timelock
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

        operations := res.0;
        user := res.1;

        user.prev_earned := user.staked * farm.rps;

        s.users_info[(farm.fid, Tezos.sender)] := user;
        s.farms[farm.fid] := farm;
      }
    | _                                 -> skip
    end
  } with (operations, s)

function claim_farm_rewards(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations : list(operation) := no_operations;

    case action of
      Claim_farm_rewards(fid)           -> {
        only_admin(s.admin);

        var farm : farm_type := get_farm(fid, s);
        const upd_res : (storage_type * farm_type) =
          update_farm_rewards(farm, s);

        s := upd_res.0;
        farm := upd_res.1;

        var user : user_info_type :=
          get_user_info(farm.fid, Tezos.self_address, s);

        user.earned := user.earned +
          abs(user.staked * farm.rps - user.prev_earned);

        var res : (list(operation) * user_info_type) :=
          transfer_rewards_to_admin(
            user,
            operations,
            farm.reward_token,
            s.admin
          );

        operations := res.0;
        user := res.1;

        user.prev_earned := user.staked * farm.rps;

        s.users_info[(farm.fid, Tezos.self_address)] := user;
        s.farms[farm.fid] := farm;
      }
    | _                                 -> skip
    end
  } with (operations, s)

function withdraw_farm_depo(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations : list(operation) := no_operations;

    case action of
      Withdraw_farm_depo(params)        -> {
        only_admin(s.admin);

        var farm : farm_type := get_farm(params.fid, s);
        const upd_res : (storage_type * farm_type) =
          update_farm_rewards(farm, s);

        s := upd_res.0;
        farm := upd_res.1;

        var user : user_info_type :=
          get_user_info(farm.fid, Tezos.self_address, s);
        var value : nat := params.amt;

        if value > user.staked
        then failwith("TFarm/balance-too-low")
        else skip;

        user.earned := user.earned +
          abs(user.staked * farm.rps - user.prev_earned);

        var res : (list(operation) * user_info_type) :=
          transfer_rewards_to_admin(
            user,
            operations,
            farm.reward_token,
            s.admin
          );

        operations := res.0;
        user := res.1;

        user.staked := abs(user.staked - value);
        user.prev_earned := user.staked * farm.rps;

        s.users_info[(farm.fid, Tezos.self_address)] := user;

        farm.staked := abs(farm.staked - value);

        s.farms[farm.fid] := farm;

        case farm.stake_params.staked_token of
          FA12(token_address) -> {
          operations := Tezos.transaction(
            FA12_transfer_type(Tezos.self_address, (s.admin, value)),
            0mutez,
            get_fa12_token_transfer_entrypoint(token_address)
          ) # operations;
        }
        | FA2(token_info)     -> {
          const dst : transfer_dst_type = record [
            to_      = s.admin;
            token_id = token_info.id;
            amount   = value;
          ];
          const fa2_transfer_param : fa2_send_type = record [
            from_ = Tezos.self_address;
            txs   = list [dst];
          ];

          operations := Tezos.transaction(
            FA2_transfer_type(list [fa2_transfer_param]),
            0mutez,
            get_fa2_token_transfer_entrypoint(token_info.token)
          ) # operations;
        }
        end;

        if farm.stake_params.is_lp_staked_token
        then {
          const revote_res : (list(operation) * storage_type) = revote(
            operations,
            user,
            farm,
            s,
            value
          );

          operations := revote_res.0;
          s := revote_res.1;
        }
        else skip;
      }
    | _                                 -> skip
    end
  } with (operations, s)
