#include "../lib/i_fa12.ligo"
#include "../lib/i_fa2.ligo"
#include "../lib/i_dex.ligo"

#include "../partial/i_common.ligo"
#include "../partial/common.ligo"

#include "../partial/burner/i_burner.ligo"
#include "../partial/burner/burner_methods.ligo"

function main(
  const action          : action_type;
  const s               : storage_type)
                        : return_type is
  case action of
    Default               -> burn(s)
  | Burn_callback(params) -> burn_callback(params, s)
  end
