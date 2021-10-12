function update_farm_rewards(var farm : farm_type) : farm_type is
  block {
    if Tezos.now >= farm.start_time
    then {
      if farm.staked =/= 0n
      then {
        const time_diff : nat = abs(Tezos.now - farm.upd);
        const reward : nat = time_diff * farm.reward_per_second;

        farm.reward_per_share :=
          farm.reward_per_share + reward / farm.staked;
      }
      else skip;

      farm.upd := Tezos.now;
    }
    else skip;
  } with farm

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
  var farm              : farm_type;
  const receiver        : address;
  const referrer        : option(address);
  const proxy_minter    : address)
                        : claim_return_type is
  block {
    var ops: list(operation) := no_operations;

    const earned : nat = user.earned / precision;
    if earned =/= 0n
    then {
      user.earned := abs(user.earned - earned * precision);
      user.claimed := user.claimed + earned;

      const actual_earned : nat = earned *
        abs(fee_precision - farm.fees.harvest_fee) / fee_precision;
      const harvest_fee : nat = abs(earned - actual_earned);
      var mint_data : mint_gov_toks_type := list [
        record [
          receiver = receiver;
          amount   = actual_earned;
        ]
      ];

      farm.claimed := farm.claimed + earned;

      if harvest_fee =/= 0n
      then {
        const fee_receiver : address = case referrer of
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

      ops := Tezos.transaction(
        mint_data,
        0mutez,
        get_proxy_minter_mint_entrypoint(proxy_minter)
      ) # ops;
    }
    else skip;
  } with (record [
    operations = ops;
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
        const burn_amount : nat = earned *
          abs(fee_precision - farm.fees.burn_reward) / fee_precision;
        const reward : nat = abs(earned - burn_amount);
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
