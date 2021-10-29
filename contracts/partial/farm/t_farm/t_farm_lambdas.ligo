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

        const tok_meta : tok_meta_type = record [
          token_id   = s.farms_count;
          token_info = params.token_info;
        ];

        s.token_metadata[s.farms_count] := tok_meta;
        s.farms_count := s.farms_count + 1n;

        const rew_amt : nat = abs(params.end_time - params.start_time) *
          (params.reward_per_second / precision);

        operations := transfer_token(
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
        const farm : farm_type = get_farm(params.fid, s.farms);

        if farm.paused
        then failwith("TFarm/farm-is-paused")
        else skip;

        var updated_farm : farm_type := update_farm_rewards(farm);
        var user : user_info_type :=
          get_user_info(updated_farm.fid, Tezos.sender, s.users_info);

        user.earned := user.earned +
          abs(user.staked * updated_farm.reward_per_share - user.prev_earned);

        const res : claim_return_type =
          if abs(Tezos.now - user.last_staked) >= updated_farm.timelock
            or Tezos.now >= updated_farm.end_time
          then claim_rewards(
            user,
            operations,
            updated_farm,
            params.rewards_receiver,
            s.referrers[Tezos.sender]
          )
          else record [
            operations = operations;
            user       = user;
            farm       = updated_farm;
          ];

        operations := res.operations;
        user := res.user;
        updated_farm := res.farm;

        case params.referrer of
          None      -> skip
        | Some(referrer) -> {
          if referrer = Tezos.sender
          then failwith("TFarm/can-not-refer-yourself")
          else s.referrers[Tezos.sender] := referrer;
        }
        end;

        user.staked := user.staked + params.amt;
        user.prev_earned := user.staked * updated_farm.reward_per_share;

        if params.amt =/= 0n
        then user.last_staked := Tezos.now
        else skip;

        s.users_info[(updated_farm.fid, Tezos.sender)] := user;

        updated_farm.staked := updated_farm.staked + params.amt;

        s.farms[updated_farm.fid] := updated_farm;

        if params.amt =/= 0n
        then {
          if updated_farm.stake_params.is_lp_staked_token
          then {
            if is_banned_baker(params.candidate, s.banned_bakers)
            then failwith("TFarm/baker-is-banned")
            else skip;

            s := vote(params.candidate, Tezos.sender, user, updated_farm, s);

            var upd_farm : farm_type := get_farm(updated_farm.fid, s.farms);

            const farm_and_ops : (farm_type * list(operation)) =
              form_vote_ops(s, upd_farm);

            s.farms[upd_farm.fid] := farm_and_ops.0;

            operations := append_ops(operations, farm_and_ops.1);
          }
          else skip;

          operations := transfer_token(
            Tezos.sender,
            Tezos.self_address,
            params.amt,
            updated_farm.stake_params.staked_token
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
        var updated_farm : farm_type :=
          update_farm_rewards(get_farm(params.fid, s.farms));
        var user : user_info_type :=
          get_user_info(updated_farm.fid, Tezos.sender, s.users_info);
        var value : nat := params.amt;

        if value > user.staked
        then failwith("TFarm/balance-too-low")
        else skip;

        var value_without_fee : nat := value;

        user.earned := user.earned +
          abs(user.staked * updated_farm.reward_per_share - user.prev_earned);

        var res : claim_return_type := record [
          operations = operations;
          user       = user;
          farm       = updated_farm;
        ];

        if abs(Tezos.now - user.last_staked) >= updated_farm.timelock
          or Tezos.now >= updated_farm.end_time
        then {
          res := claim_rewards(
            user,
            operations,
            updated_farm,
            params.rewards_receiver,
            s.referrers[Tezos.sender]
          )
        }
        else {
          res := transfer_rewards_to_admin(
            updated_farm,
            user,
            operations,
            updated_farm.reward_token,
            s.admin
          );

          const withdrawal_fee : nat = value *
            updated_farm.fees.withdrawal_fee / precision;

          value_without_fee := abs(value - withdrawal_fee);

          if withdrawal_fee =/= 0n
          then {
            var farm_user : user_info_type := get_user_info(
              updated_farm.fid,
              Tezos.self_address,
              s.users_info
            );

            farm_user.earned := farm_user.earned +
              abs(
                farm_user.staked * updated_farm.reward_per_share -
                  farm_user.prev_earned
              );
            farm_user.staked := farm_user.staked + withdrawal_fee;
            farm_user.prev_earned := farm_user.staked *
              updated_farm.reward_per_share;
            farm_user.last_staked := Tezos.now;

            s.users_info[(updated_farm.fid, Tezos.self_address)] := farm_user;
          }
          else skip;
        };

        operations := res.operations;
        user := res.user;
        updated_farm := res.farm;

        user.staked := abs(user.staked - value);
        user.prev_earned := user.staked * updated_farm.reward_per_share;

        s.users_info[(updated_farm.fid, Tezos.sender)] := user;

        updated_farm.staked := abs(updated_farm.staked - value_without_fee);

        s.farms[updated_farm.fid] := updated_farm;

        operations := transfer_token(
          Tezos.self_address,
          params.receiver,
          value_without_fee,
          updated_farm.stake_params.staked_token
        ) # operations;

        if updated_farm.stake_params.is_lp_staked_token
        then {
          s := vote(
            get_user_candidate(updated_farm, Tezos.sender, s.candidates),
            Tezos.sender,
            user,
            updated_farm,
            s
          );

          var upd_farm : farm_type := get_farm(updated_farm.fid, s.farms);

          s := vote(
            get_user_candidate(upd_farm, Tezos.self_address, s.candidates),
            Tezos.self_address,
            get_user_info(upd_farm.fid, Tezos.self_address, s.users_info),
            upd_farm,
            s
          );
          upd_farm := get_farm(upd_farm.fid, s.farms);

          const farm_and_ops : (farm_type * list(operation)) =
            form_vote_ops(s, upd_farm);

          s.farms[upd_farm.fid] := farm_and_ops.0;

          operations := append_ops(operations, farm_and_ops.1);
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
        var updated_farm : farm_type :=
          update_farm_rewards(get_farm(params.fid, s.farms));
        var user : user_info_type :=
          get_user_info(updated_farm.fid, Tezos.sender, s.users_info);

        user.earned := user.earned +
          abs(user.staked * updated_farm.reward_per_share - user.prev_earned);

        var res : claim_return_type := record [
          operations = operations;
          user       = user;
          farm       = updated_farm;
        ];

        if abs(Tezos.now - user.last_staked) >= updated_farm.timelock
          or Tezos.now >= updated_farm.end_time
        then {
          res := claim_rewards(
            user,
            operations,
            updated_farm,
            params.rewards_receiver,
            s.referrers[Tezos.sender]
          )
        }
        else failwith("TFarm/timelock-is-not-finished");

        operations := res.operations;
        user := res.user;
        updated_farm := res.farm;

        user.prev_earned := user.staked * updated_farm.reward_per_share;

        s.users_info[(updated_farm.fid, Tezos.sender)] := user;
        s.farms[updated_farm.fid] := updated_farm;
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

        var updated_farm : farm_type :=
          update_farm_rewards(get_farm(fid, s.farms));
        var user : user_info_type :=
          get_user_info(updated_farm.fid, Tezos.self_address, s.users_info);

        user.earned := user.earned +
          abs(user.staked * updated_farm.reward_per_share - user.prev_earned);

        var res : claim_return_type := transfer_rewards_to_admin(
          updated_farm,
          user,
          operations,
          updated_farm.reward_token,
          s.admin
        );

        operations := res.operations;
        user := res.user;
        updated_farm := res.farm;

        user.prev_earned := user.staked * updated_farm.reward_per_share;

        s.users_info[(updated_farm.fid, Tezos.self_address)] := user;
        s.farms[updated_farm.fid] := updated_farm;
      }
    | _                                 -> skip
    end
  } with (operations, s)
