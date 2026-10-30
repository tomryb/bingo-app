import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { UI } from "../../src/data/uiTexts.ts";

async function enterLobby(page: Page, name: string, roomId: string) {
  await page.goto("/");
  await page.getByLabel(UI.nameLabel).fill(name);
  await page.getByLabel(UI.roomLabel, { exact: true }).fill(roomId);
}

function tiles(page: Page) {
  return page.getByRole("region", { name: UI.boardLabel }).getByRole("button");
}

test("two players create and join a room, finish a round and replay together", async ({
  browser,
  baseURL,
  page: first,
}) => {
  const secondContext = await browser.newContext({
    baseURL,
    viewport: first.viewportSize(),
    isMobile: await first.evaluate(() => /Mobi/.test(navigator.userAgent)),
    hasTouch: await first.evaluate(() => navigator.maxTouchPoints > 0),
    userAgent: await first.evaluate(() => navigator.userAgent),
  });
  const second = await secondContext.newPage();
  const roomId = `e2e-${randomUUID()} / święta #?`;
  const roomPath = `#/${encodeURIComponent(roomId)}`;
  const errors: string[] = [];
  for (const page of [first, second]) {
    page.on("pageerror", (error) => errors.push(error.message));
  }
  await first.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          document.documentElement.dataset.copiedRoom = text;
        },
      },
    });
  });
  try {
    await enterLobby(first, "Ania", roomId);
    await expect(first.getByLabel(UI.nameLabel)).toHaveAttribute(
      "placeholder",
      "np. Zosia",
    );
    await first
      .getByRole("button", { name: UI.createRoom, exact: true })
      .click();
    await expect(tiles(first)).toHaveCount(9);
    await expect(first).toHaveURL(new RegExp(`${roomPath}$`));
    await expect(first.locator("main h1")).toBeFocused();
    await first.getByRole("button", { name: UI.copyRoom }).click();
    await expect(first.locator("html")).toHaveAttribute(
      "data-copied-room",
      roomId,
    );
    await expect(first.getByText(UI.roomCopied, { exact: true })).toBeVisible();

    await enterLobby(second, "Kuba", roomId);
    await expect(
      second.getByRole("status").filter({ hasText: UI.existingRoom(3) }),
    ).toBeVisible();
    await expect(second.getByRole("button", { name: "3 × 3" })).toBeDisabled();
    await second
      .getByRole("button", { name: UI.joinRoom, exact: true })
      .click();
    await expect(tiles(second)).toHaveCount(9);
    for (const page of [first, second]) {
      await expect(
        page.getByRole("heading", { name: `${UI.playersPrefix} (2)` }),
      ).toBeVisible();
    }

    const firstLayout = await tiles(first).allTextContents();
    const secondLayout = await tiles(second).allTextContents();
    expect(firstLayout).not.toEqual(secondLayout);
    await tiles(second).nth(8).click();
    await expect(tiles(second).nth(8)).toHaveAttribute("aria-pressed", "true");
    await expect(tiles(first).nth(8)).toHaveAttribute("aria-pressed", "false");
    const markedText = await tiles(second)
      .nth(8)
      .locator(".tile-text")
      .textContent();
    if (!markedText) throw new Error("Marked tile has no text");
    await expect(
      first.getByRole("status").filter({ hasText: markedText }),
    ).toBeVisible();

    for (const index of [0, 1, 2]) {
      await tiles(first).nth(index).click();
    }
    for (const page of [first, second]) {
      await expect(page).toHaveURL(new RegExp(`${roomPath}/podsumowanie$`));
      await expect(
        page.getByRole("heading", { name: UI.summaryTitle }),
      ).toBeVisible();
      await expect(page.locator("main h1")).toBeFocused();
      const results = page.locator(".summary-results li");
      await expect(results).toHaveCount(2);
      await expect(results.nth(0)).toContainText("Ania");
      await expect(results.nth(0)).toContainText("3 / 9");
      await expect(results.nth(1)).toContainText("Kuba");
      await expect(results.nth(1)).toContainText("1 / 9");
    }

    await first.evaluate(() => {
      delete document.documentElement.dataset.copiedRoom;
    });
    await first.getByRole("button", { name: UI.copyRoom }).click();
    await expect(first.locator("html")).toHaveAttribute(
      "data-copied-room",
      roomId,
    );
    await first.getByRole("button", { name: UI.replay, exact: true }).click();
    await expect(
      first.getByRole("button", { name: UI.waiting }),
    ).toBeDisabled();
    await expect(
      second.getByText(`${UI.readinessPrefix} 1 / 2.`, { exact: false }),
    ).toBeVisible();
    await second.getByRole("button", { name: UI.replay, exact: true }).click();
    for (const page of [first, second]) {
      await expect(page).toHaveURL(new RegExp(`${roomPath}$`));
      await expect(tiles(page)).toHaveCount(9);
      await expect(
        tiles(page).filter({ has: page.locator(".tile-check") }),
      ).toHaveCount(0);
      await expect(page.locator(".board-count")).toHaveText("0 / 9");
      await expect(page.locator("main h1")).toBeFocused();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    expect(await tiles(first).allTextContents()).not.toEqual(firstLayout);
    expect(await tiles(second).allTextContents()).not.toEqual(secondLayout);
    expect(await tiles(first).allTextContents()).not.toEqual(
      await tiles(second).allTextContents(),
    );

    await second.getByRole("button", { name: UI.leave, exact: true }).click();
    await expect(second.getByLabel(UI.nameLabel)).toBeVisible();
    await expect(
      first.getByRole("heading", { name: `${UI.playersPrefix} (1)` }),
    ).toBeVisible();
    await first.getByRole("button", { name: UI.leave, exact: true }).click();
    await expect(first.getByLabel(UI.nameLabel)).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await secondContext.close();
  }
});
