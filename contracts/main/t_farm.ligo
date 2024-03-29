#include "../lib/i_q_token.ligo"
#include "../lib/i_fa12.ligo"
#include "../lib/i_fa2.ligo"
#include "../lib/i_dex.ligo"

#include "../partial/i_common.ligo"
#include "../partial/common.ligo"

#include "../partial/farm/i_common.ligo"

#include "../partial/farm/t_farm/i_t_farm.ligo"
#include "../partial/farm/t_farm/t_farm_helpers.ligo"

#include "../partial/farm/common_helpers.ligo"
#include "../partial/farm/common_methods.ligo"
#include "../partial/farm/common_lambdas.ligo"
#include "../partial/farm/fa2_farm_lambdas.ligo"

#include "../partial/farm/t_farm/t_farm_methods.ligo"
#include "../partial/farm/t_farm/t_farm_lambdas.ligo"

function main(
  const action          : full_action_type;
  const s               : full_storage_type)
                        : full_return_type is
  case action of
    Use(params)         -> call_t_farm(params, s)
  | Setup_func(params)  -> setup_func(params, s)
  | Default             -> burn_tez(s)
  end
