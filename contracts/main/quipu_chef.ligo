#include "../partial/i_quipu_chef.ligo"
#include "../partial/quipu_chef.ligo"
#include "../partial/quipu_chef_methods.ligo"

function main(
  const action          : full_action_type;
  const s               : full_storage_type)
                        : full_return_type is
  case action of
    Use(params)         -> call_quipu_chef(params, s)
  | Set_quipu_chef_function(params) -> set_quipu_chef_function(params, s)
  end
