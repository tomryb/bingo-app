import assert from "node:assert/strict";
import test from "node:test";
import { verifyDeployCommit } from "../../scripts/verify-deploy.mts";

const commit = "a".repeat(40);

test("deployment accepts only the commit approved by Verify", () => {
  assert.doesNotThrow(() =>
    verifyDeployCommit({
      INCOMING_HOOK_BODY: JSON.stringify({ commit }),
      COMMIT_REF: commit,
    }),
  );
  assert.doesNotThrow(() =>
    verifyDeployCommit({
      INCOMING_HOOK_BODY: encodeURIComponent(JSON.stringify({ commit })),
      COMMIT_REF: commit,
    }),
  );
  for (const payload of [undefined, "{}", '{"commit":"master"}', "null", "{"]) {
    assert.throws(() =>
      verifyDeployCommit({ INCOMING_HOOK_BODY: payload, COMMIT_REF: commit }),
    );
  }
  assert.throws(() =>
    verifyDeployCommit({
      INCOMING_HOOK_BODY: JSON.stringify({ commit }),
      COMMIT_REF: "b".repeat(40),
    }),
  );
  assert.throws(() =>
    verifyDeployCommit({ INCOMING_HOOK_BODY: JSON.stringify({ commit }) }),
  );
});
