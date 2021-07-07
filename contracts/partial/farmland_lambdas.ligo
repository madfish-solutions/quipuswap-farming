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
          then farm := update_farm_rewards(farm)
          else skip;

          farm.alloc_point := params.alloc_point;
          s.farms[params.fid] := farm;
        } with s;

      s := List.fold(set_alloc_point, params, s);
    }
    end
  } with (no_operations, s)
