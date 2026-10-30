import { expect, test } from "@playwright/test";
import { UI } from "../../src/data/uiTexts.ts";

test("a lost mark acknowledgement can be retried without toggling the tile", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel(UI.nameLabel).fill("Alex");
  await page
    .getByLabel(UI.roomLabel, { exact: true })
    .fill(`ack-${crypto.randomUUID()}`);
  await page.locator("form button[type=submit]").click();
  const tiles = page
    .getByRole("region", { name: UI.boardLabel })
    .getByRole("button");
  await expect(tiles).toHaveCount(9);
  await page.evaluate(async () => {
    const url = "/src/socket.ts";
    const { socket }: typeof import("../../src/socket.ts") = await import(url);
    let dropped = false;
    socket.emit = new Proxy(socket.emit, {
      apply(target, receiver, args: unknown[]) {
        if (args[0] === "set-mark" && !dropped) {
          dropped = true;
          const callback = args[args.length - 1];
          args[args.length - 1] = () => {};
          setTimeout(() => {
            if (typeof callback === "function")
              callback(new Error("Simulated acknowledgement timeout"));
          }, 5100);
        }
        return Reflect.apply(target, receiver, args);
      },
    });
  });
  await tiles.nth(8).click();
  await expect(page.getByText(UI.markTimeout, { exact: true })).toBeVisible({
    timeout: 8000,
  });
  await expect(tiles.nth(8)).toBeDisabled();
  await page.getByRole("button", { name: UI.retryMark }).click();
  await expect(tiles.nth(8)).toBeEnabled();
  await expect(tiles.nth(8)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".board-count")).toHaveText("1 / 9");
  await tiles.nth(8).click();
  await expect(page.locator(".board-count")).toHaveText("0 / 9");

  await page.evaluate(async () => {
    const url = "/src/socket.ts";
    const { socket }: typeof import("../../src/socket.ts") = await import(url);
    let responses = 0;
    socket.emit = new Proxy(socket.emit, {
      apply(target, receiver, args: unknown[]) {
        const request = args[1];
        const callback = args[args.length - 1];
        if (
          args[0] === "set-mark" &&
          responses < 2 &&
          typeof request === "object" &&
          request !== null &&
          typeof callback === "function"
        ) {
          const result =
            responses++ === 0
              ? {
                  ...request,
                  accepted: false,
                  selected: Array<boolean>(9).fill(false),
                }
              : undefined;
          queueMicrotask(() => callback(null, result));
          return receiver;
        }
        return Reflect.apply(target, receiver, args);
      },
    });
  });
  await tiles.nth(7).click();
  await expect(page.getByText(UI.markRejected, { exact: true })).toBeVisible();
  await expect(tiles.nth(7)).toHaveAttribute("aria-pressed", "false");
  await expect(tiles.nth(7)).toBeEnabled();
  await tiles.nth(6).click();
  await expect(page.getByText(UI.markTimeout, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: UI.retryMark }).click();
  await expect(tiles.nth(6)).toBeEnabled();
  await expect(tiles.nth(6)).toHaveAttribute("aria-pressed", "true");
});

test("a local bingo waits for the server instead of claiming victory", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel(UI.nameLabel).fill("Alex");
  await page
    .getByLabel(UI.roomLabel, { exact: true })
    .fill(`pending-${crypto.randomUUID()}`);
  await page.locator("form button[type=submit]").click();
  const tiles = page
    .getByRole("region", { name: UI.boardLabel })
    .getByRole("button");
  await tiles.nth(0).click();
  await tiles.nth(1).click();
  await expect(tiles.nth(2)).toBeEnabled();
  await page.evaluate(async () => {
    const url = "/src/socket.ts";
    const { socket }: typeof import("../../src/socket.ts") = await import(url);
    socket.emit = new Proxy(socket.emit, {
      apply(target, receiver, args: unknown[]) {
        if (args[0] === "set-mark") {
          setTimeout(() => Reflect.apply(target, receiver, args), 1500);
          return receiver;
        }
        return Reflect.apply(target, receiver, args);
      },
    });
  });
  await tiles.nth(2).click();
  await expect(page.getByText(UI.winBanner, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: UI.summaryTitle }),
  ).toBeVisible();
});

test("preferences survive reload but not reopening a closed tab", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("bingo:userName", "Old name");
    localStorage.setItem("bingo:roomId", "old-room");
  });
  await page.reload();
  await expect(page.getByLabel(UI.nameLabel)).toHaveValue("");
  await expect(page.getByLabel(UI.roomLabel, { exact: true })).toHaveValue("");
  await page.getByLabel(UI.nameLabel).fill("Zosia");
  await page.getByLabel(UI.roomLabel, { exact: true }).fill("session-room");
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("bingo:roomId")))
    .toBe("session-room");
  await page.reload();
  await expect(page.getByLabel(UI.nameLabel)).toHaveValue("Zosia");
  await expect(page.getByLabel(UI.roomLabel, { exact: true })).toHaveValue(
    "session-room",
  );
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/");
  await expect(reopened.getByLabel(UI.nameLabel)).toHaveValue("");
  await expect(reopened.getByLabel(UI.roomLabel, { exact: true })).toHaveValue(
    "",
  );
});

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
