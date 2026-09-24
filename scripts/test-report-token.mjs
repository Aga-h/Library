// The nightly job's credential. It must fail closed: an unset or short REPORT_TOKEN matches
// nothing, so a missing environment variable can never become an open endpoint.
//
// Run: node --experimental-strip-types scripts/test-report-token.mjs
import { verifyReportToken, REPORT_TOKEN_MIN_LENGTH, REPORT_PATH } from "../lib/session.ts";

let pass = 0;
const failures = [];
function ok(cond, label) { if (cond) pass++; else failures.push(label); }

const TOKEN = "k3Jq9vX2mP8wL5nR7tY4zB6cD1fG0hAe"; // 32 characters
const bearer = (t) => `Bearer ${t}`;

ok(TOKEN.length === REPORT_TOKEN_MIN_LENGTH, "fixture sits exactly on the minimum");
ok(REPORT_PATH === "/api/study/review", "the token opens exactly one path");

ok(await verifyReportToken(bearer(TOKEN), TOKEN), "the right token passes");
ok(await verifyReportToken(bearer(TOKEN), `  ${TOKEN}\n`), "a stray newline pasted into the dashboard still matches");
ok(await verifyReportToken(`Bearer   ${TOKEN}  `, TOKEN), "surrounding spaces in the header are ignored");

ok(!(await verifyReportToken(bearer(TOKEN), undefined)), "unset REPORT_TOKEN: nothing passes");
ok(!(await verifyReportToken(bearer(""), "")), "empty token and empty header do not match each other");
ok(!(await verifyReportToken("Bearer ", "")), "…nor a bare prefix");
ok(!(await verifyReportToken(bearer("short"), "short")), "a token under the minimum is refused even when it matches");
ok(!(await verifyReportToken(bearer(TOKEN.slice(0, -1)), TOKEN.slice(0, -1))), "31 characters is one too few");

ok(!(await verifyReportToken(bearer(TOKEN + "x"), TOKEN)), "a longer token fails");
ok(!(await verifyReportToken(bearer(TOKEN.slice(0, -1)), TOKEN)), "a truncated token fails");
ok(!(await verifyReportToken(bearer(TOKEN.replace("k", "K")), TOKEN)), "case matters");
ok(!(await verifyReportToken(bearer("x".repeat(32)), TOKEN)), "a different token of the same length fails");
ok(!(await verifyReportToken(TOKEN, TOKEN)), "the token without the Bearer scheme fails");
ok(!(await verifyReportToken(`Basic ${TOKEN}`, TOKEN)), "a different scheme fails");
ok(!(await verifyReportToken(`bearer ${TOKEN}`, TOKEN)), "the scheme is matched exactly");
ok(!(await verifyReportToken(null, TOKEN)), "no header fails");

if (failures.length) {
  console.error(`${pass} passed, ${failures.length} failed\n`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`${pass} passed, 0 failed`);
