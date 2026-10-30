import assert from "node:assert/strict";
import test from "node:test";
import { deploy } from "../../scripts/deploy.mts";

const sha = "a".repeat(40);
const env = {
  VERIFIED_SHA: sha,
  RENDER_API_KEY: "render-test",
  RENDER_SERVICE_ID: "srv-test",
  NETLIFY_AUTH_TOKEN: "netlify-test",
  NETLIFY_SITE_ID: "site-test",
  NETLIFY_BUILD_HOOK_URL: "https://api.netlify.com/build_hooks/test",
  DEPLOY_RUN_ID: "123-1",
};

function fixture(
  overrides: {
    renderState?: string;
    netlifyState?: string;
    commit?: string;
    published?: string;
    pending?: boolean;
    superseded?: boolean;
  } = {},
) {
  const calls: string[] = [];
  let renderPolls = 0;
  let netlifyPolls = 0;
  let publicationPolls = 0;
  const request: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    let value: unknown;
    if (url.endsWith("/deploys") && init?.method === "POST") {
      assert.deepEqual(JSON.parse(String(init.body)), { commitId: sha });
      value = { id: "dep-test" };
    } else if (url.includes("api.render.com")) {
      renderPolls++;
      value = {
        commit: { id: sha },
        status:
          overrides.superseded && renderPolls > 1
            ? "deactivated"
            : overrides.pending && renderPolls === 1
              ? "build_in_progress"
              : (overrides.renderState ?? "live"),
      };
    } else if (url.includes("build_hooks")) {
      assert.equal(new URL(url).searchParams.get("trigger_branch"), "master");
      assert.deepEqual(JSON.parse(String(init?.body)), { commit: sha });
      value = { ok: true };
    } else if (url.includes("/deploys")) {
      netlifyPolls++;
      const entry = {
        id: "net-test",
        title: `Verify ${sha} run 123-1`,
        context: "production",
        commit_ref:
          overrides.pending && netlifyPolls === 2
            ? null
            : (overrides.commit ?? sha),
        state:
          overrides.pending && netlifyPolls === 2
            ? "enqueued"
            : (overrides.netlifyState ?? "ready"),
      };
      value = url.includes("?")
        ? overrides.pending && netlifyPolls === 1
          ? []
          : [entry]
        : entry;
    } else {
      publicationPolls++;
      value = {
        published_deploy: {
          id:
            overrides.pending && publicationPolls === 1
              ? "previous-deploy"
              : (overrides.published ?? "net-test"),
        },
      };
    }
    return Response.json(value);
  };
  return { request, calls };
}

test("deployment waits for both services and verifies the published production commit", async () => {
  const { request, calls } = fixture({ pending: true });
  await deploy(env, request, async () => {});
  assert.ok(
    calls.findIndex((url) => url.includes("build_hooks")) >
      calls.findIndex((url) => url.includes("/dep-test")),
  );
});

test("failed, mismatched and unpublished deployments fail instead of reporting success", async () => {
  for (const options of [
    { renderState: "build_failed" },
    { netlifyState: "error" },
    { commit: "b".repeat(40) },
    { published: "old-deploy" },
    { superseded: true },
  ]) {
    const { request } = fixture(options);
    await assert.rejects(deploy(env, request, async () => {}));
  }
});

test("deployment validates secrets before triggering services and does not leak hook errors", async () => {
  let calls = 0;
  const request: typeof fetch = async () => {
    calls++;
    throw new Error(env.NETLIFY_BUILD_HOOK_URL);
  };
  await assert.rejects(
    deploy({ ...env, NETLIFY_AUTH_TOKEN: "" }, request),
    /Missing NETLIFY_AUTH_TOKEN/,
  );
  assert.equal(calls, 0);
  await assert.rejects(
    deploy({ ...env, NETLIFY_BUILD_HOOK_URL: "invalid-secret-url" }, request),
    { message: "Invalid Netlify build hook URL" },
  );
  assert.equal(calls, 0);
  await assert.rejects(deploy(env, request), {
    message: "Deployment API request failed or timed out",
  });
});

test("deployment polling is bounded when a host never becomes ready", async () => {
  const { request } = fixture({ renderState: "build_in_progress" });
  await assert.rejects(
    deploy(env, request, async () => {}),
    /timeout/,
  );
});
