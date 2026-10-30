import { pathToFileURL } from "node:url";

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Unexpected deployment API response");
  }
  return value as JsonObject;
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value)
    throw new Error("Missing deployment API field");
  return value;
}

export async function deploy(
  env: Record<string, string | undefined>,
  request: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
) {
  const required = (name: string) => {
    const value = env[name];
    if (!value) throw new Error(`Missing ${name}`);
    return value;
  };
  const sha = required("VERIFIED_SHA");
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("Invalid verified commit");
  const renderKey = required("RENDER_API_KEY");
  const renderService = required("RENDER_SERVICE_ID");
  const netlifyKey = required("NETLIFY_AUTH_TOKEN");
  const netlifySite = required("NETLIFY_SITE_ID");
  const hookUrl = required("NETLIFY_BUILD_HOOK_URL");
  let hook: URL;
  try {
    hook = new URL(hookUrl);
  } catch {
    throw new Error("Invalid Netlify build hook URL");
  }
  if (
    hook.origin !== "https://api.netlify.com" ||
    !hook.pathname.startsWith("/build_hooks/")
  ) {
    throw new Error("Invalid Netlify build hook URL");
  }
  const title = `Verify ${sha} run ${required("DEPLOY_RUN_ID")}`;
  hook.searchParams.set("trigger_title", title);
  hook.searchParams.set("trigger_branch", "master");
  const renderBase = `https://api.render.com/v1/services/${encodeURIComponent(renderService)}/deploys`;
  const netlifyBase = `https://api.netlify.com/api/v1/sites/${encodeURIComponent(netlifySite)}`;

  async function api(
    url: string | URL,
    token: string | undefined,
    body?: unknown,
  ): Promise<unknown> {
    // Do not include URLs or response bodies in errors: hooks contain credentials.
    let response: Response;
    try {
      response = await request(url, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new Error("Deployment API request failed or timed out");
    }
    if (!response.ok)
      throw new Error(`Deployment API returned HTTP ${response.status}`);
    try {
      return await response.json();
    } catch {
      throw new Error("Deployment API returned invalid JSON");
    }
  }

  const render = object(await api(renderBase, renderKey, { commitId: sha }));
  const renderId = text(render.id);
  console.log(`Render deployment started: ${renderId}`);
  for (let attempt = 0; ; attempt++) {
    const status = object(
      await api(`${renderBase}/${encodeURIComponent(renderId)}`, renderKey),
    );
    if (text(object(status.commit).id) !== sha)
      throw new Error("Render commit does not match Verify");
    if (status.status === "live") break;
    if (
      [
        "build_failed",
        "update_failed",
        "pre_deploy_failed",
        "canceled",
        "deactivated",
      ].includes(text(status.status))
    ) {
      throw new Error(`Render deployment failed: ${status.status}`);
    }
    if (attempt >= 119)
      throw new Error("Render deployment exceeded 20 minute timeout");
    await sleep(10000);
  }
  console.log("Render is live at the verified commit");

  await api(hook, undefined, { commit: sha });
  let netlifyId: string | undefined;
  for (let attempt = 0; ; attempt++) {
    let status: JsonObject | undefined;
    if (netlifyId) {
      status = object(
        await api(
          `https://api.netlify.com/api/v1/deploys/${encodeURIComponent(netlifyId)}`,
          netlifyKey,
        ),
      );
    } else {
      const entries = await api(
        `${netlifyBase}/deploys?per_page=100`,
        netlifyKey,
      );
      if (!Array.isArray(entries))
        throw new Error("Unexpected Netlify deployment list");
      status = entries
        .map(object)
        .find(
          (entry) => entry.title === title && entry.context === "production",
        );
      if (status) netlifyId = text(status.id);
    }
    if (status) {
      if (status.commit_ref != null && text(status.commit_ref) !== sha)
        throw new Error("Netlify commit does not match Verify");
      if (status.state === "ready") {
        if (status.commit_ref !== sha)
          throw new Error("Netlify published commit is missing");
        const site = object(await api(netlifyBase, netlifyKey));
        if (
          site.published_deploy != null &&
          text(object(site.published_deploy).id) === netlifyId
        ) {
          const activeRender = object(
            await api(
              `${renderBase}/${encodeURIComponent(renderId)}`,
              renderKey,
            ),
          );
          if (
            activeRender.status !== "live" ||
            text(object(activeRender.commit).id) !== sha
          ) {
            throw new Error(
              "Render deployment was superseded before Netlify finished",
            );
          }
          break;
        }
      }
      if (["error", "rejected", "canceled"].includes(text(status.state))) {
        throw new Error(`Netlify deployment failed: ${status.state}`);
      }
    }
    if (attempt >= 119)
      throw new Error("Netlify deployment exceeded 20 minute timeout");
    await sleep(10000);
  }
  console.log(
    `Netlify production published: ${netlifyId}; both services run ${sha}`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await deploy(process.env);
}
