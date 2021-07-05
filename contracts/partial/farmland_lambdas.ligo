function set_admin(
  const action          : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    case action of
      Set_admin(new_admin) -> {
        if Tezos.sender =/= s.admin
        then failwith("Farmland/not-admin")
        else s.pending_admin := new_admin;
      }
    | Confirm_admin -> skip
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
    end
  } with (no_operations, s)
