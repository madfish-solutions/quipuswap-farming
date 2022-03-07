function iterate_transfer(
  const result          : return_type;
  const params          : fa2_send_type)
                        : return_type is
  block {
    function make_transfer(
      var result        : return_type;
      const dst         : transfer_dst_type)
                        : return_type is
      block {
        var operations : list(operation) := result.0;
        var s : storage_type := result.1;
        var farm : farm_type := get_farm(dst.token_id, s.farms);
        const upd_res : (storage_type * farm_type) =
          update_farm_rewards(farm, s);

        s := upd_res.0;
        farm := upd_res.1;

        if dst.to_ = Tezos.self_address
        then failwith("ILLEGAL_TRANSFER")
        else skip;

        var src_user : user_info_type :=
          get_user_info(dst.token_id, params.from_, s.users_info);

        if params.from_ =/= Tezos.sender
          and not (Set.mem(Tezos.sender, src_user.allowances))
        then failwith("FA2_NOT_OPERATOR")
        else skip;

        if src_user.staked < dst.amount
        then failwith("FA2_INSUFFICIENT_BALANCE")
        else skip;

        if abs(Tezos.now - src_user.last_staked) < farm.timelock
        then failwith("TIMELOCK_NOT_FINISHED")
        else skip;

        src_user.earned := src_user.earned +
          abs(src_user.staked * farm.reward_per_share - src_user.prev_earned);
        src_user.staked := abs(src_user.staked - dst.amount);
        src_user.prev_earned := src_user.staked * farm.reward_per_share;

        s.users_info[(dst.token_id, params.from_)] := src_user;

        var dst_user : user_info_type :=
          get_user_info(dst.token_id, dst.to_, s.users_info);

        dst_user.earned := dst_user.earned +
          abs(dst_user.staked * farm.reward_per_share - dst_user.prev_earned);
        dst_user.staked := dst_user.staked + dst.amount;
        dst_user.prev_earned := dst_user.staked * farm.reward_per_share;

        s.users_info[(dst.token_id, dst.to_)] := dst_user;

        s.farms[dst.token_id] := farm;

        if farm.stake_params.is_v1_lp
        then {
          s := vote(
            get_user_candidate(farm, params.from_, s.candidates),
            params.from_,
            src_user,
            farm,
            s
          );

          var upd_farm : farm_type := get_farm(dst.token_id, s.farms);

          s := vote(
            get_user_candidate(upd_farm, dst.to_, s.candidates),
            dst.to_,
            dst_user,
            upd_farm,
            s
          );
          upd_farm := get_farm(dst.token_id, s.farms);

          const farm_and_ops : (farm_type * list(operation)) =
            form_vote_ops(s, upd_farm);

          s.farms[farm.fid] := farm_and_ops.0;

          operations := append_ops(operations, farm_and_ops.1);
        }
        else skip;
    } with (operations, s)
} with List.fold(make_transfer, params.txs, result)

function iterate_update_operators(
  var s                 : storage_type;
  const params          : upd_operator_type)
                        : storage_type is
  block {
    case params of
      Add_operator(param) -> {
      if Tezos.sender =/= param.owner
      then failwith("FA2_NOT_OWNER")
      else skip;

      var user : user_info_type :=
        get_user_info(param.token_id, param.owner, s.users_info);

      user.allowances := Set.add(param.operator, user.allowances);

      s.users_info[(param.token_id, param.owner)] := user;
    }
    | Remove_operator(param) -> {
      if Tezos.sender =/= param.owner
      then failwith("FA2_NOT_OWNER")
      else skip;

      var user : user_info_type :=
        get_user_info(param.token_id, param.owner, s.users_info);

      user.allowances := Set.remove(param.operator, user.allowances);

      s.users_info[(param.token_id, param.owner)] := user;
    }
    end
  } with s

function balance_of(
  const action          : action_type;
  const s               : storage_type)
                        : return_type is
  block {
    var operations : list(operation) := no_operations;

    case action of
      Balance_of(params)                -> {
        function look_up_balance(
          var l         : list(bal_response_type);
          const request : bal_request_type)
                        : list(bal_response_type) is
          block {
            const user : user_info_type =
              get_user_info(request.token_id, request.owner, s.users_info);
            const response : bal_response_type = record [
              request = request;
              balance = user.staked;
            ];
          } with response # l;

        const accumulated_response : list(bal_response_type) = List.fold(
          look_up_balance,
          params.requests,
          (nil: list(bal_response_type))
        );

        operations := Tezos.transaction(
          accumulated_response,
          0tz,
          params.callback
        ) # operations;
      }
    | _                                 -> skip
    end
  } with (operations, s)

function update_operators(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Update_operators(params)          -> {
        s := List.fold(iterate_update_operators, params, s);
      }
    | _                                 -> skip
    end
  } with (no_operations, s)

function transfer(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var result : return_type := (no_operations, s);

    case action of
      Transfer(params)                  -> {
        result := List.fold(iterate_transfer, params, (no_operations, s));
      }
    | _                                 -> skip
    end
  } with result
