type send_type          is michelson_pair(
                          address, "from",
                          michelson_pair(address, "to", nat, "value"), ""
                        )

type fa12_transfer_type is
FA12_transfer_type        of send_type

type balance_type       is michelson_pair(address, "owner", contract(nat), "")

type fa12_balance_type  is
FA12_balance_of_type      of balance_type

type approve_type       is michelson_pair(address, "spender", nat, "value")

type fa12_approve_type  is
FA12_approve_type         of approve_type
