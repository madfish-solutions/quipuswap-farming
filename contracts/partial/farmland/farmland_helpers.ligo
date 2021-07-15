function get_farm(
  const fid             : fid_type;
  const s               : storage_type)
                        : farm_type is
  case s.farms[fid] of
    None       -> (failwith("Farmland/farm-not-set") : farm_type)
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
    | None       -> record [
      last_staked = 0n;
      staked      = 0n;
      earned      = 0n;
      prev_earned = 0n;
      referrer    = (None : option(address));
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
          precision * farm.alloc_point / s.total_alloc_point;

        farm.rps := farm.rps + reward / farm.staked;
      }
      else skip;

      farm.upd := Tezos.now;
      s.farms[fid] := farm;
    };
  } with s

function get_proxy_minter_mint_entrypoint(
  const proxy_minter    : address)
                        : contract(mint_gov_toks_type) is
  case (
    Tezos.get_entrypoint_opt("%mint_qsgov_tokens", proxy_minter)
                        : option(contract(mint_gov_toks_type))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("ProxyMinter/mint-qsgov-tokens-entrypoint-404")
                        : contract(mint_gov_toks_type)
  )
  end

function claim_rewards(
  var user              : user_info_type;
  const farm            : farm_type;
  const receiver        : address;
  const s               : storage_type)
                        : (list(operation) * user_info_type) is
  block {
    const earned : nat = user.earned / precision;
    var operations : list(operation) := no_operations;

    if user.earned = 0n
    then skip
    else {
      user.earned := abs(user.earned - earned * precision);

      const actual_earned : nat = earned *
        abs(10000n - farm.fees.harvest_fee) / 10000n;
      const earn_fee : nat = abs(earned - actual_earned);

      var mint_data : mint_gov_toks_type := list [
        record [
          receiver = receiver;
          amount   = actual_earned;
        ]
      ];

      if earn_fee > 0n
      then {
        const receiver : address = case user.referrer of
          None           -> zero_address
        | Some(referrer) -> referrer
        end;

        const earn_fee_mint_data : mint_gov_tok_type = record [
          receiver = receiver;
          amount   = earn_fee;
        ];

        mint_data := earn_fee_mint_data # mint_data;
      }
      else skip;

      operations := Tezos.transaction(
        mint_data,
        0mutez,
        get_proxy_minter_mint_entrypoint(s.proxy_minter)
      ) # operations;
    };
  } with (operations, user)
