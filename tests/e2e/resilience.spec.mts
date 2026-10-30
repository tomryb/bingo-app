import { expect, test } from "@playwright/test";
import { UI } from "../../src/data/uiTexts.ts";

test("blocked preference reads do not stop a player joining", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
  });
  await page.goto("/");
  await expect(page.getByText(UI.storageUnavailable)).toBeVisible();
  await page.getByLabel(UI.nameLabel).fill("Alex");
  await page
    .getByLabel(UI.roomLabel, { exact: true })
    .fill(`storage-${crypto.randomUUID()}`);
  await page.locator("form button[type=submit]").click();
  await expect(page.getByRole("region", { name: UI.boardLabel })).toBeVisible();
});

test("blocked preference writes preserve usable inputs and report the failure", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await expect(page.getByText(UI.storageUnavailable)).toBeVisible();
  await page.getByLabel(UI.nameLabel).fill("Alex");
  await expect(page.getByLabel(UI.nameLabel)).toHaveValue("Alex");
});

test("clipboard failures are reported without leaving the game", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new DOMException("Clipboard blocked", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("/");
  await page.getByLabel(UI.nameLabel).fill("Alex");
  await page
    .getByLabel(UI.roomLabel, { exact: true })
    .fill(`copy-${crypto.randomUUID()}`);
  await page.locator("form button[type=submit]").click();
  await page.getByRole("button", { name: UI.copyRoom }).click();
  await expect(
    page.getByText(UI.roomCopyFailed, { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: UI.boardLabel })).toBeVisible();
});

test("occupied names are rejected and a renamed player can join", async ({
  browser,
  page,
  baseURL,
}) => {
  const secondContext = await browser.newContext({ baseURL });
  try {
    const second = await secondContext.newPage();
    const roomId = `names-${crypto.randomUUID()}`;
    for (const player of [page, second]) {
      await player.goto("/");
      await player.getByLabel(UI.nameLabel).fill("Alex");
      await player.getByLabel(UI.roomLabel, { exact: true }).fill(roomId);
      await player.locator("form button[type=submit]").click();
      if (player === page) {
        await expect(
          player.getByRole("region", { name: UI.boardLabel }),
        ).toBeVisible();
      }
    }
    await expect(second.getByText(UI.nameTaken, { exact: true })).toBeVisible();
    await expect(second.locator("form button[type=submit]")).toBeEnabled();
    await second.getByLabel(UI.nameLabel).fill("Alex2");
    await second.locator("form button[type=submit]").click();
    await expect(
      second.getByRole("region", { name: UI.boardLabel }),
    ).toBeVisible();
    for (const player of [page, second]) {
      await expect(player.locator(".player-chip")).toHaveCount(2);
      await expect(
        player.locator(".player-chip").filter({ hasText: UI.selfSuffix }),
      ).toHaveCount(1);
    }
  } finally {
    await secondContext.close();
  }
});

test("rejected joining unlocks the form and displays an error", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel(UI.nameLabel).fill("Alex");
  await page
    .getByLabel(UI.roomLabel, { exact: true })
    .fill(`reject-${crypto.randomUUID()}`);
  await page.evaluate(async () => {
    const url = "/src/socket.ts";
    const { socket }: typeof import("../../src/socket.ts") = await import(url);
    socket.onAnyOutgoing((event: string, request: unknown) => {
      if (
        event === "join-room" &&
        typeof request === "object" &&
        request &&
        "textsVersion" in request
      ) {
        request.textsVersion = "outdated";
      }
    });
  });
  await page.locator("form button[type=submit]").click();
  await expect(page.getByText(UI.joinError, { exact: true })).toBeVisible();
  await expect(page.locator("form button[type=submit]")).toBeEnabled();
});

test("a missing join response times out; a late response cannot replace a retry", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel(UI.nameLabel).fill("Alex");
  await page
    .getByLabel(UI.roomLabel, { exact: true })
    .fill(`timeout-${crypto.randomUUID()}`);
  await page.evaluate(async () => {
    const url = "/src/socket.ts";
    const { socket }: typeof import("../../src/socket.ts") = await import(url);
    const original = socket.listeners("join-accepted");
    const rejected = socket.listeners("join-rejected");
    const invalid = socket.listeners("request-rejected");
    socket.off("join-accepted");
    socket.once("join-accepted", (board) => {
      setTimeout(() => {
        for (const listener of original) listener(board);
        for (const listener of rejected)
          listener({
            reason: "not-enough-texts",
            joinRequestId: board.joinRequestId,
          });
        for (const listener of invalid)
          listener({
            event: "join-room",
            reason: "invalid-payload",
            joinRequestId: board.joinRequestId,
          });
        document.documentElement.dataset.lateJoin = "delivered";
      }, 10000);
      for (const listener of original) socket.on("join-accepted", listener);
    });
  });
  await page.locator("form button[type=submit]").click();
  await expect(page.getByText(UI.joinTimeout)).toBeVisible({ timeout: 12000 });
  await expect(page.locator("form button[type=submit]")).toBeEnabled();
  await page.locator("form button[type=submit]").click();
  await expect(page.getByRole("region", { name: UI.boardLabel })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-late-join",
    "delivered",
  );
  await expect(page.getByRole("region", { name: UI.boardLabel })).toBeVisible();
  await expect(page.locator(".board-count")).toHaveText("0 / 9");
  await expect(page.getByText(UI.notEnoughTexts, { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText(UI.requestRejected, { exact: true })).toHaveCount(
    0,
  );
});

test("losing the connection returns to a usable lobby", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(UI.nameLabel).fill("Alex");
  await page
    .getByLabel(UI.roomLabel, { exact: true })
    .fill(`disconnect-${crypto.randomUUID()}`);
  await page.locator("form button[type=submit]").click();
  await expect(page.getByRole("region", { name: UI.boardLabel })).toBeVisible();
  await page.evaluate(async () => {
    const url = "/src/socket.ts";
    const { socket }: typeof import("../../src/socket.ts") = await import(url);
    socket.disconnect();
  });
  await expect(page.getByLabel(UI.nameLabel)).toBeVisible();
  await expect(page.getByText(UI.disconnected)).toBeVisible();
  await expect(page.locator("form button[type=submit]")).toBeDisabled();
  await page.evaluate(async () => {
    const url = "/src/socket.ts";
    const { socket }: typeof import("../../src/socket.ts") = await import(url);
    socket.connect();
  });
  await expect(page.locator("form button[type=submit]")).toBeEnabled();
});
