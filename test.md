# Test coverage for contracts

## QFarm

1. `set_admin`:

   - ✅ should fail if not admin is trying to setup new pending admin;
   - ✅ should setup new pending admin by admin.

2. `confirm_admin`:

   - ✅ should fail if not pending admin is trying to confirm new admin;
   - ✅ should confirm new admin by pending admin.

3. `set_fees`:

   - ✅ should fail if not admin is trying to set fees;
   - ✅ should fail if one farm from list of farms not found;
   - ✅ should set/update fees for one farm;
   - ✅ should set/update fees for group of farms.

4. `set_reward_per_second`:

   - ✅ should fail if not admin is trying to set reward per second;
   - ✅ should fail if one farm from list of farms not found;
   - ✅ should set reward per second for one farm;
   - ✅ should set reward per second for group of farms.

5. `set_burner`:

   - ✅ should fail if not admin is trying to set burner;
   - ✅ should change burner by admin.

6. `set_proxy_minter`:

   - ✅ should fail if not admin is trying to set proxy minter;
   - ✅ should change proxy minter by admin.

7. `set_baker_registry`:

   - ✅ should fail if not admin is trying to set baker registry;
   - ✅ should change baker registry by admin.

8. `add_new_farm`:

   - ✅ should fail if not admin is trying to add new farm;
   - ✅ should add new farm by admin and set all farm's fields correctly.

9. `pause_farms`:

   - ✅ should fail if not admin is trying to pause farm;
   - ✅ should fail if one farm from list of farms not found;
   - ✅ should pause one farm;
   - ✅ should unpause one farm;
   - ✅ should pause group of farms;
   - ✅ should unpause group of farms;
   - ✅ should pause/unpause group of farms.

10. `deposit`:

    - ✅ should fail if farm not found;
    - ✅ should fail if farm is paused;
    - ✅ should claim user's rewards (in farms without timelock);
    - ✅ should claim user's rewards if timelock is finished (in farms with timelock);
    - ✅ should not claim user's rewards if timelock is not finished (in farms with timelock);
    - ✅ should mint QS GOV tokens as reward to rewards receiver;
    - ✅ should mint QS GOV tokens as harvest fee to referrer (in case when user have referrer);
    - ✅ should mint QS GOV tokens as harvest fee to zero address (in case when user does not have referrer);
    - ✅ should calculate and mint QS GOV tokens as harvest fee with decimals (like 4.2%);
    - ✅ should fail if user is trying to refer himself;
    - ✅ should set/update referrer;
    - ✅ should not set/update referrer if referrer param not passed;
    - ✅ should deposit single FA1.2 token;
    - ✅ should deposit LP FA1.2 token;
    - ✅ should deposit single FA2 token;
    - ✅ should deposit LP FA2 token;
    - ✅ should vote for the baker if LP token is deposited;
    - ✅ should change current delegated for the next candidate if votes were redistributed.

11. `withdraw`:

    - should fail if farm not found;
    - should fail if staked amount is less than amount to withdraw;
    - should withdraw all with 0 amount parameter passed;
    - should claim user's rewards (in farms without timelock);
    - should claim user's rewards if timelock is finished (in farms with timelock);
    - should burn user's rewards if timelock is not finished (in farms with timelock);
    - should stake withdrawal fee from farm's name;
    - should mint QS GOV tokens as reward to rewards receiver;
    - should mint QS GOV tokens as harvest fee to referrer (in case when user have referrer);
    - should mint QS GOV tokens as harvest fee to zero address (in case when user does not have referrer);
    - should calculate and stake tokens from farm's name as withdrawal fee with decimals (like 4.2%);
    - should withdraw single FA1.2 token;
    - should withdraw LP FA1.2 token;
    - should withdraw single FA2 token;
    - should withdraw LP FA2 token;
    - should change current delegated for the next candidate if votes were redistributed.

12. `harvest`:

    - ✅ should fail if farm not found;
    - ✅ should fail if timelock is not finished (in farms with timelock);
    - ✅ should claim user's rewards;
    - ✅ should mint QS GOV tokens as reward to rewards receiver;
    - ✅ should mint QS GOV tokens as harvest fee to referrer (in case when user have referrer);
    - ✅ should mint QS GOV tokens as harvest fee to zero address (in case when user does not have referrer);
    - ✅ should calculate and mint QS GOV tokens as harvest fee with decimals (like 4.2%).

13. `burn_xtz_rewards`:

14. `burn_farm_rewards`:

15. `fa12_tok_bal_callback`:

16. `fa2_tok_bal_callback`:

17. `buyback`:

## TFarm

1. `set_admin`:

   - ✅ should fail if not admin is trying to setup new pending admin;
   - ✅ should setup new pending admin by admin.

2. `confirm_admin`:

   - ✅ should fail if not pending admin is trying to confirm new admin;
   - ✅ should confirm new admin by pending admin.

3. `set_fees`:

   - ✅ should fail if not admin is trying to set fees;
   - ✅ should fail if one farm from list of farms not found;
   - ✅ should set/update fees for one farm;
   - ✅ should set/update fees for group of farms.

4. `set_burner`:

   - ✅ should fail if not admin is trying to set burner;
   - ✅ should change burner by admin.

5. `set_baker_registry`:

   - ✅ should fail if not admin is trying to set baker registry;
   - ✅ should change baker registry by admin.

6. `add_new_farm`:

   - ✅ should fail if not admin is trying to add new farm;
   - ✅ should fail if end time is less or equal to start time;
   - ✅ should add new farm by admin and set all farm's fields correctly;
   - ✅ should transfer correct amount of FA1.2 tokens to the contract as the rewards for users;
   - ✅ should transfer correct amount of FA2 tokens to the contract as the rewards for users.

7. `pause_farms`:

   - ✅ should fail if not admin is trying to pause farm;
   - ✅ should fail if one farm from list of farms not found;
   - ✅ should pause one farm;
   - ✅ should unpause one farm;
   - ✅ should pause group of farms;
   - ✅ should unpause group of farms;
   - ✅ should pause/unpause group of farms.

8. `deposit`:

9. `withdraw`:

10. `harvest`:

11. `burn_xtz_rewards`:

12. `claim_farm_rewards`:

13. `withdraw_farm_depo`:

## Burner

1. `default`:

   - ✅ should swap all XTZ from contract for QS GOV tokens and burn them;
   - ✅ should fail if zero XTZ amount have been sent;
   - ✅ should fail if small liquidity amount in the pool.

2. `burn_callback`:

   - ✅ should fail if not QS GOV token contract is trying to call callback.

## Baker registry

1. `validate`:

   - ✅ should do nothing if baker is registered;
   - ✅ should register new baker if baker is not already registered;
   - ✅ should fail if the baker is not already registered and the address to register is not a baker.

2. `register`:

   - ✅ should register new baker;
   - ✅ should fail if the address to register is not a baker.

## Proxy minter

1. `add_minter`:

   - ✅ should fail if not admin is trying to add or remove a minter;
   - ✅ should add a minter;
   - ✅ should remove a minter.

2. `mint_tokens`:

   - ✅ should fail if transaction sender is not a registered minter;
   - ✅ should mint QS GOV tokens for one address;
   - ✅ should mint QS GOV tokens for group of addresses.

3. `withdraw_tokens`:

   - ✅ should fail if not admin is trying to withdraw QS GOV tokens;
   - ✅ should transfer the specified amount of QS GOV tokens from proxy minter contract to admin address;
   - ✅ should withdraw all QS GOV tokens from the contract;
   - ✅ should fail if the specified amount of QS GOV tokens is more than actual balance on the contract.

4. `set_admin`:

   - ✅ should fail if not admin is trying to setup new pending admin;
   - ✅ should setup new pending admin by admin.

5. `confirm_admin`:

   - ✅ should fail if not pending admin is trying to confirm new admin;
   - ✅ should confirm new admin by pending admin.
