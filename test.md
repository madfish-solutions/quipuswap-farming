# Test coverage for contracts

## QFarm

1. `set_admin`:

   - should fail if not admin is trying to setup new pending admin;
   - should setup new pending admin.

2. `confirm_admin`:

   - should fail if not pending admin is trying to confirm new admin;
   - should confirm new admin by pending admin.
