# Make a pull request and pass the quality gate

**Who:** Claude or any developer  **When:** every change  **Time:** depends on the change

## Steps
1. Create a branch from `main`: `git checkout -b feat/<short-name>`.
2. Make the change. Add or update tests next to the code (`*.test.ts`) and in `e2e/`.
3. Run `npm run check`. Everything must pass.
4. Save evidence in `docs/evidence/<step>/`: screenshots (phone and desktop, light and dark) and a short `RESULT.md` with what was checked and the results.
5. Write or update the SOP in `docs/sop/` for anything a person does by hand.
6. Push the branch and open a pull request to `main`. Describe what changed and how it was checked.
7. Wait for the **CI** check to go green on GitHub. If it fails, fix the cause; never skip or disable a test.
8. Update the project tracker (status, hours spent).
9. Rohit reviews and merges.

## Check it worked
- The pull request shows a green **CI / check**.
- `main` still builds after the merge.

## If something goes wrong
- CI fails but `npm run check` passed locally → open the failed step's log on GitHub and reproduce it with the same command; check Node version matches CI (22).
