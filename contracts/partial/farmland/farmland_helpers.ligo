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

function update_farm_rewards(
  const fid             : fid_type;
  var s                 : storage_type)
                        : storage_type is
  block {
    var farm : farm_type := get_farm(fid, s);

    if Tezos.level <= farm.start_block
    then skip
    else {
      if farm.staked =/= 0n
      then {
        const time_diff : nat = abs(Tezos.now - farm.upd);
        const reward : nat = time_diff * s.qsgov_per_second *
          farm.alloc_point / s.total_alloc_point;

        farm.rps := farm.rps + reward / farm.staked;
      }
      else skip;

      farm.upd := Tezos.now;
      s.farms[fid] := farm;
    };
  } with s

function get_proxy_minter_mint_entrypoint(
  const proxy_minter    : address)
                        : contract(mint_tokens_type) is
  case (
    Tezos.get_entrypoint_opt("%mint_qsgov_tokens", proxy_minter)
                        : option(contract(mint_tokens_type))
  ) of
    Some(contr) -> contr
  | None -> (
    failwith("ProxyMinter/mint-qsgov-tokens-entrypoint-404")
                        : contract(mint_tokens_type)
  )
  end
