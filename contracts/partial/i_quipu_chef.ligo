type storage_type       is [@layout:comb] record [
  tmp1                  : nat;
  tmp2                  : nat;
]

type action_type        is
 Test

type return_type        is (list(operation) * storage_type)

[@inline] const no_operations : list(operation) = nil;
