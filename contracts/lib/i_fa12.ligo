type fa12_send_type       is michelson_pair(
                            address, "from",
                            michelson_pair(address, "to", nat, "value"), ""
                          )

type fa12_transfer_type is
FA12_transfer_type        of fa12_send_type
