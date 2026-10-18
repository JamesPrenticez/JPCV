Q. What's a security practice that's widely recommended but that you think is overrated or theatre? Why?

A. Forced password rotation, and the "must have a symbol and a number" rules. In practice people just go from Password1! to Password2!, so you annoy everyone and get very little security back.

What actually helps is a password manager so nothing gets reused, checking passwords against known breach lists, and MFA, ideally passkeys. Most real attacks are phishing and credential stuffing, not someone guessing your password.

---

Q.Tell us about a time you built something that had to fail safely. It doesn't have to be big; a form, a job, a migration or a payment flow all count. What did 'failing safely' mean in that context, and what did you do about it?

A.At Animo I built the integration that lets an outside operator launch our casino games and move player money in and out of them. Failing safely meant that if any call went wrong, the player's balance and the operator's ledger still had to agree.

1. Only trusted requests got in. Inbound calls had to come from an allowed IP and carry a valid HMAC signature of the raw request body. Anything else was refused.

2. Every money movement could be traced and undone. Each bet, win and rollback carried a unique ID. Wins pointed to their bet, and rollbacks pointed to the bet they cancelled.

3. Money stayed exact. I used BigInt and each currency's minor units, so there were no rounding errors.

4. Nothing unexpected was trusted. I validated every operator response with Zod and mapped their 13 error codes to clear game states.

5.Failures were tested early. I extended our mock operator to simulate failures, so we tested the bad paths before real money was involved.
