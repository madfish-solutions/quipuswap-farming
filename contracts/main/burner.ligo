#include "../lib/i_dex.ligo"

#include "../partial/i_common.ligo"

#include "../partial/burner/i_burner.ligo"
#include "../partial/burner/burner_methods.ligo"

function main(
  const action          : action_type;
  const s               : storage_type)
                        : return_type is
  (case action of
    Default -> list [
      Tezos.transaction(
        TezToTokenPayment(record [
          min_out  = 1n;
          receiver = Tezos.self_address;
        ]),
        Tezos.amount,
        get_quipuswap_use_entrypoint(s.pool)
      );
      Tezos.transaction(
        Burn(Tezos.self_address, 0n),
        0mutez,
        get_token_burn_entrypoint(s.token)
      )
  ]
  end, s)
