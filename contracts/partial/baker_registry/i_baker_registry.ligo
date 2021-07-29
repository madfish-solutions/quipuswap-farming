type baker_type         is key_hash

type storage_type       is big_map(baker_type, bool)

type action_type        is
  Validate                of baker_type
| Register                of baker_type

type return_type        is list(operation) * storage_type
