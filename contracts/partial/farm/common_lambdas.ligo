function set_admin(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(admin)                  -> {
        only_admin(s.admin);

        s.pending_admin := admin;
      }
    | _                                 -> skip
    end
  } with (no_operations, s)

function confirm_admin(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Confirm_admin                     -> {
        only_pending_admin(s.pending_admin);

        s.admin := s.pending_admin;
        s.pending_admin := zero_address;
      }
    | _                                 -> skip
    end
  } with (no_operations, s)

function set_fees(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_fees(params)                  -> {
        only_admin(s.admin);

        function set_fee(
          var s           : storage_type;
          const params    : set_fee_type)
                          : storage_type is
          block {
            var farm : farm_type := get_farm(params.fid, s);

            farm.fees := params.fees;

            s.farms[farm.fid] := farm;
          } with s;

        s := List.fold(set_fee, params, s);
      }
    | _                                 -> skip
    end
  } with (no_operations, s)

function set_burner(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_burner(burner)                -> {
        only_admin(s.admin);

        s.burner := burner;
      }
    | _                                 -> skip
    end
  } with (no_operations, s)

function set_baker_registry(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_baker_registry(registry)      -> {
        only_admin(s.admin);

        s.baker_registry := registry;
      }
    | _                                 -> skip
    end
  } with (no_operations, s)

function pause_farms(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Pause_farms(params)               -> {
        only_admin(s.admin);

        (* Pause or unpause the specified farm *)
        function pause_farm(
          var s           : storage_type;
          const params    : pause_farm_type)
                          : storage_type is
          block {
            var farm : farm_type := get_farm(params.fid, s);
            const upd_res : (storage_type * farm_type) =
              update_farm_rewards(farm, s);

            s := upd_res.0;
            farm := upd_res.1;

            farm.paused := params.pause;

            s.farms[farm.fid] := farm;
          } with s;

        s := List.fold(pause_farm, params, s);
      }
    | _                                 -> skip
    end
  } with (no_operations, s)

function burn_xtz_rewards(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations : list(operation) := no_operations;

    case action of
      Burn_xtz_rewards(fid)             -> {
        only_admin(s.admin);

        const farm : farm_type = get_farm(fid, s);

        if not farm.stake_params.is_lp_staked_token
        then failwith("QSystem/not-LP-farm")
        else skip;

        const lp_token : address = case farm.stake_params.staked_token of
          FA12(token_address) -> token_address
        | FA2(token_info)     -> token_info.token
        end;

        operations := Tezos.transaction(
          WithdrawProfit(s.burner),
          0mutez,
          get_quipuswap_use_entrypoint(lp_token)
        ) # operations;
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
        then failwith("QSystem/balance-too-low")
        else skip;

        user.earned := user.earned +
          abs(user.staked * farm.reward_per_share - user.prev_earned);
        user.staked := abs(user.staked - value);
        user.prev_earned := user.staked * farm.reward_per_share;

        s.users_info[(farm.fid, Tezos.self_address)] := user;

        farm.staked := abs(farm.staked - value);

        s.farms[farm.fid] := farm;

        operations := transfer(
          Tezos.self_address,
          s.admin,
          value,
          farm.stake_params.staked_token
        ) # operations;
      }
    | _                                 -> skip
    end
  } with (operations, s)
