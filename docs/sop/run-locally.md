# Run Happy PDF on your computer

**Who:** anyone working on the code  **When:** first setup, or after pulling changes  **Time:** about 5 minutes

## Before you start
- Node.js 22 or newer (`node -v`).
- Git, and a copy of the repository (`git clone https://github.com/rohittrimukhe/Pdftools.git`).

## Steps
1. Open a terminal in the project folder and run `npm ci`.
   Expected result: dependencies install with "found 0 vulnerabilities" or a short audit summary.
2. Run `npm run dev`.
   Expected result: a line like `Local: http://localhost:5173/`.
3. Open that address in a browser.
   Expected result: the Happy PDF home screen.

## Check it worked
- `npm run check` runs every check the pull request will run: typecheck, unit tests, build and browser tests.
- The first time, install the test browser with `npx playwright install chromium`.

## If something goes wrong
- `npm ci` fails with an engine error → update Node.js to version 22 or newer.
- The browser tests say "Executable doesn't exist" → run `npx playwright install chromium`.
- Port 5173 is busy → `npm run dev -- --port 5174`.
