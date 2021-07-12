function set_admin(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(new_admin) -> {
        only_farmland_admin(Tezos.sender, s);

        s.pending_admin := new_admin;
      }
    | Confirm_admin -> skip
    | Set_alloc_points(_) -> skip
    | Set_fees(_) -> skip
    | Set_reward_per_second(_) -> skip
    | Set_burner(_) -> skip
    | Add_new_farm(_) -> skip
    | Deposit(_) -> skip
    | Withdraw(_) -> skip
    | Harvest(_) -> skip
    end
  } with (no_operations, s)

function confirm_admin(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(_) -> skip
    | Confirm_admin -> {
      if Tezos.sender =/= s.pending_admin
      then failwith("Farmland/not-pending-admin")
      else {
        s.admin := s.pending_admin;
        s.pending_admin := zero_address;
      };
    }
    | Set_alloc_points(_) -> skip
    | Set_fees(_) -> skip
    | Set_reward_per_second(_) -> skip
    | Set_burner(_) -> skip
    | Add_new_farm(_) -> skip
    | Deposit(_) -> skip
    | Withdraw(_) -> skip
    | Harvest(_) -> skip
    end
  } with (no_operations, s)

function set_alloc_points(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(_) -> skip
    | Confirm_admin -> skip
    | Set_alloc_points(params) -> {
      only_farmland_admin(Tezos.sender, s);

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
    | Set_fees(_) -> skip
    | Set_reward_per_second(_) -> skip
    | Set_burner(_) -> skip
    | Add_new_farm(_) -> skip
    | Deposit(_) -> skip
    | Withdraw(_) -> skip
    | Harvest(_) -> skip
    end
  } with (no_operations, s)

function set_fees(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(_) -> skip
    | Confirm_admin -> skip
    | Set_alloc_points(_) -> skip
    | Set_fees(params) -> {
      only_farmland_admin(Tezos.sender, s);

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
    | Set_reward_per_second(_) -> skip
    | Set_burner(_) -> skip
    | Add_new_farm(_) -> skip
    | Deposit(_) -> skip
    | Withdraw(_) -> skip
    | Harvest(_) -> skip
    end
  } with (no_operations, s)

function set_reward_per_second(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(_) -> skip
    | Confirm_admin -> skip
    | Set_alloc_points(_) -> skip
    | Set_fees(_) -> skip
    | Set_reward_per_second(new_rps) -> {
      only_farmland_admin(Tezos.sender, s);

      s.qugo_per_second := new_rps;
    }
    | Set_burner(_) -> skip
    | Add_new_farm(_) -> skip
    | Deposit(_) -> skip
    | Withdraw(_) -> skip
    | Harvest(_) -> skip
    end
  } with (no_operations, s)

function set_burner(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(_) -> skip
    | Confirm_admin -> skip
    | Set_alloc_points(_) -> skip
    | Set_fees(_) -> skip
    | Set_reward_per_second(_) -> skip
    | Set_burner(new_burner) -> {
      only_farmland_admin(Tezos.sender, s);

      s.burner := new_burner;
    }
    | Add_new_farm(_) -> skip
    | Deposit(_) -> skip
    | Withdraw(_) -> skip
    | Harvest(_) -> skip
    end
  } with (no_operations, s)

function add_new_farm(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(_) -> skip
    | Confirm_admin -> skip
    | Set_alloc_points(_) -> skip
    | Set_fees(_) -> skip
    | Set_reward_per_second(_) -> skip
    | Set_burner(_) -> skip
    | Add_new_farm(params) -> {
      only_farmland_admin(Tezos.sender, s);

      s.total_alloc_point := s.total_alloc_point + params.alloc_point;
      s.farms_count := s.farms_count + 1n;
      s.farms[s.farms_count] := record [
        users_info   = (Map.empty : map(address, user_info_type));
        fees         = params.fees;
        upd          = Tezos.now;
        staked_token = params.staked_token;
        reward_token = s.qugo_token.token;
        is_lp_farm   = params.is_lp_farm;
        timelocked   = params.timelocked;
        alloc_point  = params.alloc_point;
        rps          = 0n;
        staked       = 0n;
      ];
    }
    | Deposit(_) -> skip
    | Withdraw(_) -> skip
    | Harvest(_) -> skip
    end
  } with (no_operations, s)

function deposit(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(_) -> skip
    | Confirm_admin -> skip
    | Set_alloc_points(_) -> skip
    | Set_fees(_) -> skip
    | Set_reward_per_second(_) -> skip
    | Set_burner(_) -> skip
    | Add_new_farm(_) -> skip
    | Deposit(params) -> {
      s := update_farm_rewards(params.fid, s);

      var farm : farm_type := get_farm(params.fid, s);
      var user : user_info_type := get_user_info(params.fid, Tezos.sender, s);

      user.earned := user.earned +
        abs(user.staked * farm.rps - user.prev_earned);
      user.staked := user.staked + params.amount;
      user.prev_earned := user.staked * farm.rps;

      farm.users_info[Tezos.sender] := user;
      farm.staked := farm.staked + params.amount;

      s.farms[params.fid] := farm;
    }
    | Withdraw(_) -> skip
    | Harvest(_) -> skip
    end
  } with (no_operations, s)

function withdraw(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(_) -> skip
    | Confirm_admin -> skip
    | Set_alloc_points(_) -> skip
    | Set_fees(_) -> skip
    | Set_reward_per_second(_) -> skip
    | Set_burner(_) -> skip
    | Add_new_farm(_) -> skip
    | Deposit(_) -> skip
    | Withdraw(params) -> {
      s := update_farm_rewards(params.fid, s);

      var farm : farm_type := get_farm(params.fid, s);
      var user : user_info_type := get_user_info(params.fid, Tezos.sender, s);
      var value : nat := params.amount;

      user.earned := user.earned +
        abs(user.staked * farm.rps - user.prev_earned);

      if value = 0n
      then value := user.staked
      else skip;

      if value <= user.staked
      then skip
      else failwith("Farmland/balance-too-low");

      user.staked := abs(user.staked - params.amount);
      user.prev_earned := user.staked * farm.rps;

      farm.users_info[Tezos.sender] := user;
      farm.staked := abs(farm.staked - params.amount);

      s.farms[params.fid] := farm;
    }
    | Harvest(_) -> skip
    end
  } with (no_operations, s)

function harvest(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(_) -> skip
    | Confirm_admin -> skip
    | Set_alloc_points(_) -> skip
    | Set_fees(_) -> skip
    | Set_reward_per_second(_) -> skip
    | Set_burner(_) -> skip
    | Add_new_farm(_) -> skip
    | Deposit(_) -> skip
    | Withdraw(_) -> skip
    | Harvest(params) -> {
      s := update_farm_rewards(params.fid, s);

      var farm : farm_type := get_farm(params.fid, s);
      var user : user_info_type := get_user_info(params.fid, Tezos.sender, s);

      user.earned := user.earned +
        abs(user.staked * farm.rps - user.prev_earned);
      user.prev_earned := user.staked * farm.rps;

      farm.users_info[Tezos.sender] := user;

      s.farms[params.fid] := farm;
    }
    end
  } with (no_operations, s)
