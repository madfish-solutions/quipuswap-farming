function set_reward_per_second(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_reward_per_second(params)     -> {
        only_admin(s.admin);

        function update_reward_per_second(
          var s           : storage_type;
          const params    : rew_per_sec_type)
                          : storage_type is
          block {
            var farm : farm_type := get_farm(params.fid, s);
            const upd_res : (storage_type * farm_type) =
              update_farm_rewards(farm, s);

            s := upd_res.0;
            farm := upd_res.1;

            farm.reward_per_second := params.reward_per_second;

            s.farms[farm.fid] := farm;
          } with s;

        s := List.fold(update_reward_per_second, params, s);
      }
    | _                                 -> skip
    end
  } with (no_operations, s)

function set_proxy_minter(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_proxy_minter(proxy_minter)    -> {
        only_admin(s.admin);

        s.proxy_minter := proxy_minter;
      }
    | _                                 -> skip
    end
  } with (no_operations, s)

function add_new_farm(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Add_new_farm(params)              -> {
        only_admin(s.admin);

        const start_time : timestamp = if params.start_time <= Tezos.now
          then Tezos.now
          else params.start_time;

        s.farms[s.farms_count] := record [
          fees              = params.fees;
          upd               = start_time;
          stake_params      = params.stake_params;
          reward_token      = s.qsgov;
          timelock          = params.timelock;
          current_delegated = zero_key_hash;
          next_candidate    = zero_key_hash;
          paused            = params.paused;
          reward_per_second = params.reward_per_second;
          reward_per_share  = 0n;
          staked            = 0n;
          start_time        = start_time;
          fid               = s.farms_count;
        ];

        s.farms_count := s.farms_count + 1n;
      }
    | _                                 -> skip
    end
  } with (no_operations, s)

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
        then failwith("QFarm/farm-is-paused")
        else skip;

        const upd_res : (storage_type * farm_type) =
          update_farm_rewards(farm, s);

        s := upd_res.0;
        farm := upd_res.1;

        var user : user_info_type := get_user_info(farm.fid, Tezos.sender, s);

        user.earned := user.earned +
          abs(user.staked * farm.reward_per_share - user.prev_earned);

        var res : (option(operation) * user_info_type) :=
          ((None : option(operation)), user);

        if abs(Tezos.now - user.last_staked) >= farm.timelock
        then res := claim_rewards(user, farm, params.rewards_receiver, s)
        else skip;

        user := res.1;

        case params.referrer of
          None      -> skip
        | Some(referrer) -> {
          if referrer = Tezos.sender
          then failwith("QFarm/can-not-refer-yourself")
          else s.referrers[Tezos.sender] := referrer;
        }
        end;

        user.staked := user.staked + params.amt;
        user.prev_earned := user.staked * farm.reward_per_share;

        if params.amt > 0n
        then user.last_staked := Tezos.now;
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

          operations := transfer(
            Tezos.sender,
            Tezos.self_address,
            params.amt,
            farm.stake_params.staked_token
          ) # operations;
        }
        else skip;

        case res.0 of
          Some(op) -> operations := op # operations
        | None     -> skip
        end;
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
        then failwith("QFarm/balance-too-low")
        else skip;

        var value_without_fee : nat := value;

        user.earned := user.earned +
          abs(user.staked * farm.reward_per_share - user.prev_earned);

        var res : (option(operation) * user_info_type) :=
          ((None : option(operation)), user);

        if abs(Tezos.now - user.last_staked) >= farm.timelock
        then res := claim_rewards(user, farm, params.rewards_receiver, s)
        else {
          res := burn_rewards(user, farm, False, s);

          value_without_fee := value *
            abs(fee_precision - farm.fees.withdrawal_fee) / fee_precision;

          const withdrawal_fee : nat = abs(value - value_without_fee);

          if withdrawal_fee = 0n
          then skip
          else {
            var farm_user : user_info_type :=
              get_user_info(farm.fid, Tezos.self_address, s);

            farm_user.earned := farm_user.earned +
              abs(farm_user.staked * farm.reward_per_share -
                farm_user.prev_earned);
            farm_user.staked := farm_user.staked + withdrawal_fee;
            farm_user.prev_earned := farm_user.staked * farm.reward_per_share;
            farm_user.last_staked := Tezos.now;

            s.users_info[(farm.fid, Tezos.self_address)] := farm_user;
          };
        };

        user := res.1;

        user.staked := abs(user.staked - value);
        user.prev_earned := user.staked * farm.reward_per_share;

        s.users_info[(farm.fid, Tezos.sender)] := user;

        farm.staked := abs(farm.staked - value_without_fee);

        s.farms[farm.fid] := farm;

        operations := transfer(
          Tezos.self_address,
          params.receiver,
          value_without_fee,
          farm.stake_params.staked_token
        ) # operations;

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

        case res.0 of
          Some(op) -> operations := op # operations
        | None     -> skip
        end;
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
          abs(user.staked * farm.reward_per_share - user.prev_earned);

        var res : (option(operation) * user_info_type) :=
          ((None : option(operation)), user);

        if abs(Tezos.now - user.last_staked) >= farm.timelock
        then res := claim_rewards(user, farm, params.rewards_receiver, s)
        else failwith("QFarm/timelock-is-not-finished");

        user := res.1;

        case res.0 of
          Some(op) -> operations := op # operations
        | None     -> skip
        end;

        user.prev_earned := user.staked * farm.reward_per_share;

        s.users_info[(farm.fid, Tezos.sender)] := user;
        s.farms[farm.fid] := farm;
      }
    | _                                 -> skip
    end
  } with (operations, s)

function burn_farm_rewards(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations : list(operation) := no_operations;

    case action of
      Burn_farm_rewards(fid)            -> {
        var farm : farm_type := get_farm(fid, s);
        const upd_res : (storage_type * farm_type) =
          update_farm_rewards(farm, s);

        s := upd_res.0;
        farm := upd_res.1;

        var user : user_info_type :=
          get_user_info(farm.fid, Tezos.self_address, s);

        user.earned := user.earned +
          abs(user.staked * farm.reward_per_share - user.prev_earned);

        var res : (option(operation) * user_info_type) :=
          burn_rewards(user, farm, True, s);

        user := res.1;

        case res.0 of
          Some(op) -> operations := op # operations
        | None     -> skip
        end;

        user.prev_earned := user.staked * farm.reward_per_share;

        s.users_info[(farm.fid, Tezos.self_address)] := user;
        s.farms[farm.fid] := farm;
      }
    | _                                 -> skip
    end
  } with (operations, s)
