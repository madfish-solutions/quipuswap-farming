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

8. `ban_bakers`:

   - ✅ should fail if not admin is trying to ban baker;
   - ✅ should ban one baker;
   - ✅ should unban one baker;
   - ✅ should ban group of bakers;
   - ✅ should unban group of bakers;
   - ✅ should ban/unban group of bakers.

9. `add_new_farm`:

   - ✅ should fail if not admin is trying to add new farm;
   - ✅ should add new farm by admin and set all farm's fields correctly.

10. `pause_farms`:

    - ✅ should fail if not admin is trying to pause farm;
    - ✅ should fail if one farm from list of farms not found;
    - ✅ should pause one farm;
    - ✅ should unpause one farm;
    - ✅ should pause group of farms;
    - ✅ should unpause group of farms;
    - ✅ should pause/unpause group of farms.

11. `deposit`:

    - ✅ should fail if farm not found;
    - ✅ should fail if farm is paused;
    - ✅ should fail if user's candidate for voting is banned (only for LP farms);
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

12. `withdraw`:

    - ✅ should fail if farm not found;
    - ✅ should fail if staked by user amount is less than amount to withdraw;
    - ✅ should claim user's rewards (in farms without timelock);
    - ✅ should claim user's rewards if timelock is finished (in farms with timelock);
    - ✅ should burn user's rewards if timelock is not finished (in farms with timelock);
    - ✅ should stake withdrawal fee from farm's name;
    - ✅ should mint QS GOV tokens as reward to rewards receiver;
    - ✅ should mint QS GOV tokens as harvest fee to referrer (in case when user have referrer);
    - ✅ should mint QS GOV tokens as harvest fee to zero address (in case when user does not have referrer);
    - ✅ should calculate and mint QS GOV tokens as harvest fee with decimals (like 4.2%);
    - ✅ should withdraw single FA1.2 token;
    - ✅ should withdraw LP FA1.2 token;
    - ✅ should withdraw single FA2 token;
    - ✅ should withdraw LP FA2 token;
    - ✅ should withdraw tokens to the specified receiver;
    - ✅ should change current delegated for the next candidate if votes were redistributed.

13. `harvest`:

    - ✅ should fail if farm not found;
    - ✅ should fail if timelock is not finished (in farms with timelock);
    - ✅ should claim user's rewards;
    - ✅ should mint QS GOV tokens as reward to rewards receiver;
    - ✅ should mint QS GOV tokens as harvest fee to referrer (in case when user have referrer);
    - ✅ should mint QS GOV tokens as harvest fee to zero address (in case when user does not have referrer);
    - ✅ should calculate and mint QS GOV tokens as harvest fee with decimals (like 4.2%).

14. `burn_tez_rewards`:

    - ✅ should fail if not admin is trying to burn TEZ rewards;
    - ✅ should fail if farm not found;
    - ✅ should fail if not LP token is staked on the farm;
    - ✅ should withdraw bakers rewards in TEZ from the QS pool, swap for QS GOV tokens and burn them.

15. `burn_farm_rewards`:

    - ✅ should fail if farm not found;
    - ✅ should burn farm rewards;
    - ✅ should pay burn reward to the transaction sender.

16. `withdraw_farm_depo`:

    - ✅ should fail if not admit is trying to withdraw farm depo;
    - ✅ should fail if farm not found;
    - ✅ should fail if staked by farm amount is less than amount to withdraw;
    - ✅ should withdraw single FA1.2 token;
    - ✅ should withdraw LP FA1.2 token;
    - ✅ should withdraw single FA2 token;
    - ✅ should withdraw LP FA2 token.

17. `transfer`:

    - ✅ should fail if farm not found;
    - ✅ should fail if self to self transfer;
    - ✅ should fail if transfer destination address is equal to contract address;
    - ✅ should fail if not operator is trying to transfer tokens;
    - ✅ should fail if insufficient balance;
    - ✅ should fail if timelock for the sender is not finished (in farms with timelock);
    - ✅ should fail if one transaction from a group fails;
    - ✅ should transfer one token and update values correctly;
    - ✅ should transfer a group of tokens and update values correctly;
    - ✅ should claim rewards after transfer correctly.

18. `update_operators`:

    - ✅ should fail if not owner is trying to add operator;
    - ✅ should fail if not owner is trying to remove operator;
    - ✅ should fail if one transaction from a group fails;
    - ✅ should add operator;
    - ✅ should remove operator;
    - ✅ should add/remove operators per one transation.

19. `balance_of`:

    - ✅ should return correct balance of staked tokens.

20. `update_token_metadata`:

    - ✅ should fail if not admit is trying to update token metadata;
    - ✅ should fail if farm not found;
    - ✅ should update token metadata.

21. `default`:

    - ✅ should transfer received TEZ to the burner, swap for QUIPU and burn them (1);
    - ✅ should transfer received TEZ to the burner, swap for QUIPU and burn them (2).

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

6. `ban_bakers`:

   - ✅ should fail if not admin is trying to ban baker;
   - ✅ should ban one baker;
   - ✅ should unban one baker;
   - ✅ should ban group of bakers;
   - ✅ should unban group of bakers;
   - ✅ should ban/unban group of bakers.

7. `add_new_farm`:

   - ✅ should fail if not admin is trying to add new farm;
   - ✅ should fail if end time is less or equal to start time;
   - ✅ should fail if timelock is more than farm's lifetime;
   - ✅ should add new farm by admin and set all farm's fields correctly;
   - ✅ should transfer correct amount of FA1.2 tokens to the contract as the rewards for users;
   - ✅ should transfer correct amount of FA2 tokens to the contract as the rewards for users.

8. `pause_farms`:

   - ✅ should fail if not admin is trying to pause farm;
   - ✅ should fail if one farm from list of farms not found;
   - ✅ should pause one farm;
   - ✅ should unpause one farm;
   - ✅ should pause group of farms;
   - ✅ should unpause group of farms;
   - ✅ should pause/unpause group of farms.

9. `deposit`:

   - ✅ should fail if farm not found;
   - ✅ should fail if farm is paused;
   - ✅ should fail if user's candidate for voting is banned (only for LP farms);
   - ✅ should claim user's rewards (in farms without timelock);
   - ✅ should claim user's rewards if timelock is finished (in farms with timelock);
   - ✅ should not claim user's rewards if timelock is not finished (in farms with timelock);
   - ✅ should transfer FA1.2 reward tokens as reward to rewards receiver;
   - ✅ should transfer FA2 reward tokens as reward to rewards receiver;
   - ✅ should transfer FA1.2 reward tokens as harvest fee to referrer (in case when user have referrer);
   - ✅ should transfer FA2 reward tokens as harvest fee to referrer (in case when user have referrer);
   - ✅ should transfer FA1.2 reward tokens as harvest fee to zero address (in case when user does not have referrer);
   - ✅ should transfer FA2 reward tokens as harvest fee to zero address (in case when user does not have referrer);
   - ✅ should calculate and transfer reward tokens as harvest fee with decimals (like 4.2%);
   - ✅ should fail if user is trying to refer himself;
   - ✅ should set/update referrer;
   - ✅ should not set/update referrer if referrer param not passed;
   - ✅ should deposit single FA1.2 token;
   - ✅ should deposit LP FA1.2 token;
   - ✅ should deposit single FA2 token;
   - ✅ should deposit LP FA2 token;
   - ✅ should vote for the baker if LP token is deposited;
   - ✅ should change current delegated for the next candidate if votes were redistributed.

10. `withdraw`:

    - ✅ should fail if farm not found;
    - ✅ should fail if staked by user amount is less than amount to withdraw;
    - ✅ should claim user's rewards (in farms without timelock);
    - ✅ should claim user's rewards if timelock is finished (in farms with timelock);
    - ✅ should transfer FA1.2 user's rewards to admin if timelock is not finished (in farms with timelock);
    - ✅ should transfer FA2 user's rewards to admin if timelock is not finished (in farms with timelock);
    - ✅ should stake withdrawal fee from farm's name;
    - ✅ should transfer FA1.2 reward tokens as reward to rewards receiver;
    - ✅ should transfer FA2 reward tokens as reward to rewards receiver;
    - ✅ should transfer FA1.2 reward tokens as harvest fee to referrer (in case when user have referrer);
    - ✅ should transfer FA2 reward tokens as harvest fee to referrer (in case when user have referrer);
    - ✅ should transfer FA1.2 reward tokens as harvest fee to zero address (in case when user does not have referrer);
    - ✅ should transfer FA2 reward tokens as harvest fee to zero address (in case when user does not have referrer);
    - ✅ should calculate and transfer reward tokens as harvest fee with decimals (like 4.2%);
    - ✅ should withdraw single FA1.2 token;
    - ✅ should withdraw LP FA1.2 token;
    - ✅ should withdraw single FA2 token;
    - ✅ should withdraw LP FA2 token;
    - ✅ should withdraw tokens to the specified receiver;
    - ✅ should change current delegated for the next candidate if votes were redistributed.

11. `harvest`:

    - ✅ should fail if farm not found;
    - ✅ should fail if timelock is not finished (in farms with timelock);
    - ✅ should claim user's rewards;
    - ✅ should transfer FA1.2 reward tokens as reward to rewards receiver;
    - ✅ should transfer FA2 reward tokens as reward to rewards receiver;
    - ✅ should transfer FA1.2 reward tokens as harvest fee to referrer (in case when user have referrer);
    - ✅ should transfer FA2 reward tokens as harvest fee to referrer (in case when user have referrer);
    - ✅ should transfer FA1.2 reward tokens as harvest fee to zero address (in case when user does not have referrer);
    - ✅ should transfer FA2 reward tokens as harvest fee to zero address (in case when user does not have referrer);
    - ✅ should calculate and transfer reward tokens as harvest fee with decimals (like 4.2%).

12. `burn_tez_rewards`:

    - ✅ should fail if not admin is trying to burn TEZ rewards;
    - ✅ should fail if farm not found;
    - ✅ should fail if not LP token is staked on the farm;
    - ✅ should withdraw bakers rewards in TEZ from the QS pool, swap for QS GOV tokens and burn them.

13. `claim_farm_rewards`:

    - ✅ should fail if not admin is trying to claim farm rewards;
    - ✅ should fail if farm not found;
    - ✅ should transfer FA1.2 reward tokens to the admin;
    - ✅ should transfer FA2 reward tokens to the admin.

14. `withdraw_farm_depo`:

    - ✅ should fail if not admit is trying to withdraw farm depo;
    - ✅ should fail if farm not found;
    - ✅ should fail if staked by farm amount is less than amount to withdraw;
    - ✅ should withdraw single FA1.2 token;
    - ✅ should withdraw LP FA1.2 token;
    - ✅ should withdraw single FA2 token;
    - ✅ should withdraw LP FA2 token.

15. `transfer`:

    - ✅ should fail if farm not found;
    - ✅ should fail if self to self transfer;
    - ✅ should fail if transfer destination address is equal to contract address;
    - ✅ should fail if not operator is trying to transfer tokens;
    - ✅ should fail if insufficient balance;
    - ✅ should fail if timelock for the sender is not finished (in farms with timelock);
    - ✅ should fail if one transaction from a group fails;
    - ✅ should transfer one token and update values correctly;
    - ✅ should transfer a group of tokens and update values correctly;
    - ✅ should claim rewards after transfer correctly.

16. `update_operators`:

    - ✅ should fail if not owner is trying to add operator;
    - ✅ should fail if not owner is trying to remove operator;
    - ✅ should fail if one transaction from a group fails;
    - ✅ should add operator;
    - ✅ should remove operator;
    - ✅ should add/remove operators per one transation.

17. `balance_of`:

    - ✅ should return correct balance of staked tokens.

18. `update_token_metadata`:

    - ✅ should fail if not admit is trying to update token metadata;
    - ✅ should fail if farm not found;
    - ✅ should update token metadata.

19. `default`:

    - ✅ should transfer received TEZ to the burner, swap for QUIPU and burn them (1);
    - ✅ should transfer received TEZ to the burner, swap for QUIPU and burn them (2).

20. `integration tests`:

    - ✅ should add new farm, stake in the next block and withdraw all rewards (except the first block reward) after farms lifetime finishing (without timelock);
    - ✅ should add new farm and stake in batch, withdraw all rewards after farms lifetime finishing (without timelock);
    - ✅ should claim rewards in time of depositing after farms finishing when timelock is not finished;
    - ✅ should claim rewards in time of withdrawing after farms finishing when timelock is not finished;
    - ✅ should claim rewards in time of claiming after farms finishing when timelock is not finished.

## Burner

1. `default`:

   - ✅ should swap all TEZ from contract for QS GOV tokens and burn them;
   - ✅ should fail if zero TEZ amount have been sent;
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
