import type { EvalFailure, FailureClass } from "./types.js";

const ENV_ISSUE_PATTERNS = [
  /not defined/i,
  /missing env/i,
  /API_KEY/i,
  /SECRET/i,
  /connection refused/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /authentication failed/i,
  /access denied/i,
];

const REPAIRABLE_PATTERNS = [
  /TypeError/i,
  /ReferenceError/i,
  /SyntaxError/i,
  /Module not found/i,
  /Cannot find module/i,
  /test failed/i,
  /build error/i,
  /Expected.*but/i,
  /Cannot read properties/i,
  /is not a function/i,
];

export function classifyFailure(failure: EvalFailure): FailureClass {
  const msg = failure.message;
  for (const pattern of ENV_ISSUE_PATTERNS) {
    if (pattern.test(msg)) return "env_issue";
  }
  for (const pattern of REPAIRABLE_PATTERNS) {
    if (pattern.test(msg)) return "repairable";
  }
  return "unknown";
}
