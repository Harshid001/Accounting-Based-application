/**
 * CI Guard: Fail if any x-mock-role or x-mock-userid pattern is found in src/
 * This prevents future developers from silently reintroducing the auth bypass.
 *
 * Run: node scripts/check_no_mock_headers.mjs
 * Add this to your CI pipeline (e.g. GitHub Actions) before tests.
 */
import { execSync } from "child_process";

const patterns = ["x-mock-role", "x-mock-userid"];
let failed = false;

for (const pattern of patterns) {
  try {
    const result = execSync(
      `npx -y ripgrep --glob "*.ts" --glob "*.tsx" -l "${pattern}" src/`,
      { encoding: "utf-8", cwd: process.cwd() }
    ).trim();

    if (result) {
      console.error(`\n❌ SECURITY GUARD FAILED: Found '${pattern}' in source code:\n`);
      console.error(result);
      console.error(`\nThis pattern was used for an auth bypass that was patched. It must not be reintroduced.\n`);
      failed = true;
    }
  } catch (e) {
    // ripgrep exits 1 when no match is found — that's what we WANT
    if (e.status === 1) {
      console.log(`✅ '${pattern}' not found in src/ — OK`);
    } else {
      // ripgrep not found or other error — fall back to git grep
      try {
        execSync(`git grep -r --include="*.ts" "${pattern}" src/`, { cwd: process.cwd() });
        // If the above didn't throw, the pattern was found
        console.error(`\n❌ SECURITY GUARD FAILED: Found '${pattern}' via git grep in src/`);
        failed = true;
      } catch (gitE) {
        if (gitE.status === 1) {
          console.log(`✅ '${pattern}' not found in src/ — OK`);
        } else {
          console.warn(`⚠️  Could not run grep check for '${pattern}': ${gitE.message}`);
        }
      }
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("\n✅ Security guard passed — no mock auth headers found in src/\n");
