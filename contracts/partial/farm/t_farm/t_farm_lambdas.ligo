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
          next_candidate    = zero_key_hash;
          paused            = params.paused;
          reward_per_second = params.reward_per_second;
          reward_per_share  = 0n;
          staked            = 0n;
          claimed           = 0n;
          start_time        = start_time;
          end_time          = params.end_time;
          fid               = s.farms_count;
        ];

        s.farms_count := s.farms_count + 1n;

        const rew_amt : nat = abs(params.end_time - params.start_time) *
          (params.reward_per_second / precision);

        operations := transfer(
          Tezos.sender,
          Tezos.self_address,
          rew_amt,
          params.reward_token
        ) # operations;
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
          abs(user.staked * farm.reward_per_share - user.prev_earned);

        var res : claim_return_type := record [
          operations = operations;
          user       = user;
          farm       = farm;
        ];

        if abs(Tezos.now - user.last_staked) >= farm.timelock
          or Tezos.now >= farm.end_time
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

        operations := res.operations;
        user := res.user;
        farm := res.farm;

        case params.referrer of
          None      -> skip
        | Some(referrer) -> {
          if referrer = Tezos.sender
          then failwith("TFarm/can-not-refer-yourself")
          else s.referrers[Tezos.sender] := referrer;
        }
        end;

        user.staked := user.staked + params.amt;
        user.prev_earned := user.staked * farm.reward_per_share;

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

          operations := transfer(
            Tezos.sender,
            Tezos.self_address,
            params.amt,
            farm.stake_params.staked_token
          ) # operations;
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

        var value_without_fee : nat := value;

        user.earned := user.earned +
          abs(user.staked * farm.reward_per_share - user.prev_earned);

        var res : claim_return_type := record [
          operations = operations;
          user       = user;
          farm       = farm;
        ];

        if abs(Tezos.now - user.last_staked) >= farm.timelock
          or Tezos.now >= farm.end_time
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
            farm,
            user,
            operations,
            farm.reward_token,
            s.admin
          );

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

        operations := res.operations;
        user := res.user;
        farm := res.farm;

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

        var res : claim_return_type := record [
          operations = operations;
          user       = user;
          farm       = farm;
        ];

        if abs(Tezos.now - user.last_staked) >= farm.timelock
          or Tezos.now >= farm.end_time
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

        operations := res.operations;
        user := res.user;
        farm := res.farm;

        user.prev_earned := user.staked * farm.reward_per_share;

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
          abs(user.staked * farm.reward_per_share - user.prev_earned);

        var res : claim_return_type := transfer_rewards_to_admin(
          farm,
          user,
          operations,
          farm.reward_token,
          s.admin
        );

        operations := res.operations;
        user := res.user;
        farm := res.farm;

        user.prev_earned := user.staked * farm.reward_per_share;

        s.users_info[(farm.fid, Tezos.self_address)] := user;
        s.farms[farm.fid] := farm;
      }
    | _                                 -> skip
    end
  } with (operations, s)
