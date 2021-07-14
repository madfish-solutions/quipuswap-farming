#include "../lib/i_fa12.ligo"
#include "../lib/i_fa2.ligo"
#include "../lib/i_dex.ligo"

#include "../partial/i_common.ligo"
#include "../partial/common.ligo"

#include "../partial/farmland/i_farmland.ligo"
#include "../partial/farmland/farmland_helpers.ligo"
#include "../partial/farmland/farmland_methods.ligo"
#include "../partial/farmland/farmland_lambdas.ligo"

function main(
  const action          : full_action_type;
  const s               : full_storage_type)
                        : full_return_type is
  case action of
    Use(params)         -> call_farmland(params, s)
  | Setup_func(params)  -> setup_func(params, s)
  end
