type storage_type             is [@layout:comb] record [
  tmp1                        : nat;
  tmp2                        : nat;
]

type test_type                is [@layout:comb] record [
  tmp1                        : nat;
  tmp2                        : nat;
]

type action_type              is
  Test                        of test_type

type return_type              is (list(operation) * storage_type)

type quipu_chef_func_type     is (action_type * storage_type) -> return_type

type full_storage_type        is [@layout:comb] record [
  storage                     : storage_type;
  quipu_chef_lambdas          : big_map(nat, quipu_chef_func_type);
]

type full_return_type         is (list(operation) * full_storage_type)

type set_quipu_chef_function_params_type is [@layout:comb] record [
  index                       : nat;
  func                        : quipu_chef_func_type;
]

type full_action_type         is
  Use                         of action_type
| Set_quipu_chef_function     of set_quipu_chef_function_params_type

[@inline] const no_operations : list(operation) = nil;
