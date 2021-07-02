#include "../partial/i_quipu_chef.ligo"
#include "../partial/quipu_chef_methods.ligo"

function main(
  const action          : action_type;
  const s               : storage_type)
                        : return_type is
  case action of
   Test                -> (no_operations, test(s))
  end
