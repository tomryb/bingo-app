import { pathToFileURL } from "node:url";

export function verifyDeployCommit(env: Record<string, string | undefined>) {
  const payload: unknown = JSON.parse(
    decodeURIComponent(env.INCOMING_HOOK_BODY ?? "{}"),
  );
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("commit" in payload) ||
    typeof payload.commit !== "string" ||
    !/^[a-f0-9]{40}$/.test(payload.commit)
  ) {
    throw new Error(
      "Production deploy requires a verified commit from the GitHub Deploy workflow.",
    );
  }
  if (env.COMMIT_REF !== payload.commit) {
    throw new Error(
      `Refusing deploy: built commit ${env.COMMIT_REF} differs from verified commit ${payload.commit}.`,
    );
  }
  console.log(`Deploying verified commit ${payload.commit}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  verifyDeployCommit(process.env);
}
