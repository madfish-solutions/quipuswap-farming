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
            var farm : farm_type := get_farm(params.fid, s.farms);

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

function ban_bakers(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Ban_bakers(params)                -> {
        only_admin(s.admin);

        (* Ban or unban the specified baker *)
        function ban_baker(
          var s           : storage_type;
          const params    : ban_baker_type)
                          : storage_type is
          block {
            var baker_info : baker_type :=
              get_baker_info(params.baker, s.banned_bakers);

            baker_info.period := params.period;
            baker_info.start := Tezos.now;

            s.banned_bakers[params.baker] := baker_info;
          } with s;

        s := List.fold(ban_baker, params, s);
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
            var farm : farm_type := get_farm(params.fid, s.farms);
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

function burn_tez_rewards(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations : list(operation) := no_operations;

    case action of
      Burn_tez_rewards(fid)             -> {
        only_admin(s.admin);

        const farm : farm_type = get_farm(fid, s.farms);

        if not farm.stake_params.is_v1_lp
        then failwith("QSystem/not-LP-farm")
        else skip;

        operations := Tezos.transaction(
          WithdrawProfit(s.burner),
          0mutez,
          get_quipuswap_use_entrypoint(
            get_token_address(farm.stake_params.staked_token)
          )
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

        var farm : farm_type := get_farm(params.fid, s.farms);
        const upd_res : (storage_type * farm_type) =
          update_farm_rewards(farm, s);

        s := upd_res.0;
        farm := upd_res.1;

        var user : user_info_type :=
          get_user_info(farm.fid, Tezos.self_address, s.users_info);
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

        operations := transfer_token(
          Tezos.self_address,
          s.admin,
          value,
          farm.stake_params.staked_token
        ) # operations;

        if farm.stake_params.is_v1_lp
        then {
          s := vote(
            get_user_candidate(farm, Tezos.self_address, s.candidates),
            Tezos.self_address,
            user,
            farm,
            s
          );

          const upd_farm : farm_type = get_farm(params.fid, s.farms);
          const farm_and_ops : (farm_type * list(operation)) =
            form_vote_ops(s, upd_farm);

          s.farms[farm.fid] := farm_and_ops.0;

          operations := append_ops(operations, farm_and_ops.1);
        }
        else skip;
      }
    | _                                 -> skip
    end
  } with (operations, s)

function update_token_metadata(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Update_token_metadata(params)     -> {
        only_admin(s.admin);

        var metadata : tok_meta_type :=
          get_token_metadata(params.token_id, s.token_metadata);

        function upd_tok_meta(
          var metadata  : tok_meta_type;
          const pair    : meta_pair_type)
                        : tok_meta_type is
          block {
            metadata.token_info[pair.key] := pair.value;
          } with metadata;

        metadata := List.fold(upd_tok_meta, params.token_info, metadata);

        s.token_metadata[params.token_id] := metadata;
      }
    | _                                 -> skip
    end
  } with (no_operations, s)
