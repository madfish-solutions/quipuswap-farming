function update_farm_rewards(var farm : farm_type) : farm_type is
block {
  if Tezos.now >= farm.start_time
  then {
    if farm.staked =/= 0n
    then {
      const time_diff : nat = if Tezos.now > farm.end_time
          then abs(farm.end_time - farm.upd)
          else abs(Tezos.now - farm.upd);
      const reward : nat = time_diff * farm.reward_per_second;

      farm.reward_per_share :=
        farm.reward_per_share + reward / farm.staked;
    }
    else skip;

    farm.upd := Tezos.now;
  }
  else skip;
} with farm

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

      const actual_earned : nat = earned *
        abs(fee_precision - farm.fees.harvest_fee) / fee_precision;
      const harvest_fee : nat = abs(earned - actual_earned);
      const fee_receiver : address = case s.referrers[user_addr] of
        None           -> zero_address
      | Some(referrer) -> referrer
      end;

      farm.claimed := farm.claimed + earned;

      case farm.reward_token of
        FA12(_)         -> {
        if harvest_fee =/= 0n
        then {
          operations := transfer_token(
            Tezos.self_address,
            fee_receiver,
            harvest_fee,
            farm.reward_token
          ) # operations;
        }
        else skip;

        operations := transfer_token(
          Tezos.self_address,
          receiver,
          actual_earned,
          farm.reward_token
        ) # operations;
      }
      | FA2(token_info) -> {
        var txs : list(transfer_dst_type) := list [
          record [
            to_      = receiver;
            token_id = token_info.id;
            amount   = actual_earned;
          ]
        ];

        if harvest_fee =/= 0n
        then {
          const fee_dst : transfer_dst_type = record [
            to_      = fee_receiver;
            token_id = token_info.id;
            amount   = harvest_fee;
          ];

          txs := fee_dst # txs;
        }
        else skip;

        const fa2_transfer_param : fa2_send_type = record [
          from_ = Tezos.self_address;
          txs   = txs;
        ];

        operations := Tezos.transaction(
          FA2_transfer_type(list [fa2_transfer_param]),
          0mutez,
          get_fa2_token_transfer_entrypoint(token_info.token)
        ) # operations;
      }
      end;
    }
    else skip;
  } with (record [
    operations = operations;
    user       = user;
    farm       = farm;
  ])

function transfer_rewards_to_admin(
  var farm              : farm_type;
  var user              : user_info_type;
  var operations        : list(operation);
  const reward_token    : token_type;
  const admin           : address)
                        : claim_return_type is
  block {
    const earned : nat = user.earned / precision;

    if earned =/= 0n
    then {
      user.earned := abs(user.earned - earned * precision);
      user.claimed := user.claimed + earned;

      farm.claimed := farm.claimed + earned;

      operations := transfer_token(
        Tezos.self_address,
        admin,
        earned,
        reward_token
      ) # operations;
    }
    else skip;
  } with (record [
    operations = operations;
    user       = user;
    farm       = farm;
  ])
