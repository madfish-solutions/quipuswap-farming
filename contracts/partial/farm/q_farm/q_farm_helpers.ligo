function update_farm_rewards(
  var _farm             : farm_type;
  var s                 : storage_type)
                        : storage_type * farm_type is
  block {
    if Tezos.now >= _farm.start_time
    then {
      if _farm.staked =/= 0n
      then {
        const time_diff : nat = abs(Tezos.now - _farm.upd);
        const reward : nat = time_diff * _farm.reward_per_second;

        _farm.reward_per_share :=
          _farm.reward_per_share + reward / _farm.staked;
      }
      else skip;

      _farm.upd := Tezos.now;

      s.farms[_farm.fid] := _farm;
    }
    else skip;
  } with (s, _farm)

function get_proxy_minter_mint_entrypoint(
  const proxy_minter    : address)
                        : contract(mint_gov_toks_type) is
  case (
    Tezos.get_entrypoint_opt("%mint_tokens", proxy_minter)
                        : option(contract(mint_gov_toks_type))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("QFarm/proxy-minter-mint-tokens-entrypoint-404")
                        : contract(mint_gov_toks_type)
  )
  end

function claim_rewards(
  var user              : user_info_type;
  var operations        : list(operation);
  var farm              : farm_type;
  const user_addr       : address;
  const receiver        : address;
  const s               : storage_type)
                        : claim_return_type is
  block {
    const earned : nat = user.earned / precision;

    if earned =/= 0n
    then {
      user.earned := abs(user.earned - earned * precision);
      user.claimed := user.claimed + earned;

      const harvest_fee : nat = earned * farm.fees.harvest_fee / precision;
      const actual_earned : nat = abs(earned - harvest_fee);
      var mint_data : mint_gov_toks_type := list [
        record [
          receiver = receiver;
          amount   = actual_earned;
        ]
      ];

      farm.claimed := farm.claimed + earned;

      if harvest_fee =/= 0n
      then {
        const fee_receiver : address = case s.referrers[user_addr] of
          None           -> zero_address
        | Some(referrer) -> referrer
        end;
        const harvest_fee_mint_data : mint_gov_tok_type = record [
          receiver = fee_receiver;
          amount   = harvest_fee;
        ];

        mint_data := harvest_fee_mint_data # mint_data;
      }
      else skip;

      operations := Tezos.transaction(
        mint_data,
        0mutez,
        get_proxy_minter_mint_entrypoint(s.proxy_minter)
      ) # operations;
    }
    else skip;
  } with (record [
    operations = operations;
    user       = user;
    farm       = farm;
  ])

function burn_rewards(
  var user              : user_info_type;
  var operations        : list(operation);
  var farm              : farm_type;
  const pay_burn_reward : bool;
  const s               : storage_type)
                        : claim_return_type is
  block {
    const earned : nat = user.earned / precision;

    if earned =/= 0n
    then {
      user.earned := abs(user.earned - earned * precision);
      user.claimed := user.claimed + earned;

      farm.claimed := farm.claimed + earned;

      var mint_data : mint_gov_toks_type := list [];

      if pay_burn_reward
      then {
        const reward : nat = earned * farm.fees.burn_reward / precision;
        const burn_amount : nat = abs(earned - reward);
        const dst1 : mint_gov_tok_type = record [
          receiver = zero_address;
          amount   = burn_amount;
        ];

        mint_data := dst1 # mint_data;

        if reward =/= 0n
        then {
          const dst2 : mint_gov_tok_type = record [
            receiver = Tezos.sender;
            amount   = reward;
          ];

          mint_data := dst2 # mint_data;
        }
        else skip;
      }
      else {
        const dst : mint_gov_tok_type = record [
          receiver = zero_address;
          amount   = earned;
        ];

        mint_data := dst # mint_data;
      };

      operations := Tezos.transaction(
        mint_data,
        0mutez,
        get_proxy_minter_mint_entrypoint(s.proxy_minter)
      ) # operations;
    }
    else skip;
  } with (record [
    operations = operations;
    user       = user;
    farm       = farm;
  ])
