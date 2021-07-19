(* Util for concatenating 2 lists of operations *)
function concat_op_lists(
  const lst1            : list(operation);
  const lst2            : list(operation))
                        : list(operation) is
  block {
    (* Concatenation of list-accumulator with operation *)
    function concat(
      const lst         : list(operation);
      const op          : operation)
                        : list(operation) is
      op # lst;
  } with List.fold(concat, lst2, lst1)
