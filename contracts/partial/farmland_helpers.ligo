function get_farm(
  const fid             : fid_type;
  const s               : storage_type)
                        : farm_type is
  case s.farms[fid] of
    None -> (failwith("Farmland/farm-not-set") : farm_type)
  | Some(farm) -> farm
  end

function get_user_info(
  const fid             : fid_type;
  const user            : address;
  const s               : storage_type)
                        : user_info_type is
  block {
    const farm : farm_type = get_farm(fid, s);
    const user_info : user_info_type = case farm.users_info[user] of
      Some(info) -> info
    | None -> record [
      last_staked = 0n;
      staked      = 0n;
      earned      = 0n;
      prev_earned = 0n;
    ]
    end;
  } with user_info

function only_farmland_admin(
  const user            : address;
  const s               : storage_type)
                        : unit is
  block {
    if user =/= s.admin
    then failwith("Farmland/not-admin")
    else skip;
  } with unit

function update_farm_rewards(
  const fid             : fid_type;
  var s                 : storage_type)
                        : storage_type is
  block {
    var farm : farm_type := get_farm(fid, s);

    if farm.staked =/= 0n
    then {
      const time_diff : nat = abs(Tezos.now - farm.upd);
      const reward : nat = time_diff * s.qugo_per_second * farm.alloc_point /
        s.total_alloc_point;

      farm.rps := farm.rps + reward / farm.staked;
    }
    else skip;

    farm.upd := Tezos.now;
    s.farms[fid] := farm;
  } with s
