import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { NOTIFICATION_UI } from "../../src/data/notificationFeedback.ts";
import { UI } from "../../src/data/uiTexts.ts";
import {
  MAX_PLAYER_NAME_LENGTH,
  MAX_ROOM_NAME_LENGTH,
} from "../../src/shared/limits.ts";

async function expectLayoutFits(page: Page) {
  const overflow = await page
    .locator("main, .topbar, .notification-controls")
    .evaluateAll((regions) => {
      const viewport = document.documentElement.clientWidth;
      return regions.flatMap((region) =>
        [
          region,
          ...region.querySelectorAll(
            "button, input, h1, h2, .bingo-grid, .player-chip",
          ),
        ]
          .filter((element) => {
            const bounds = element.getBoundingClientRect();
            return (
              bounds.width > 0 &&
              (bounds.left < -1 ||
                bounds.right > viewport + 1 ||
                (element.tagName !== "INPUT" &&
                  element.scrollWidth > element.clientWidth + 1))
            );
          })
          .map((element) => `${element.tagName}.${element.className}`),
      );
    });
  expect(overflow).toEqual([]);
}
for (const fontSize of [16, 32]) {
  test(`lobby, board and summary fit narrow screens with ${fontSize}px root text`, async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByLabel(UI.roomLabel, { exact: true })).toHaveValue(
      "",
    );
    await expect(
      page.getByLabel(UI.roomLabel, { exact: true }),
    ).toHaveAttribute("placeholder", UI.roomPlaceholder);
    if (
      await page
        .getByRole("button", { name: NOTIFICATION_UI.vibrationOff })
        .isEnabled()
    ) {
      await expect(page.getByText(NOTIFICATION_UI.vibrationHint)).toBeVisible();
    }
    await expect(page.locator(".page-footer")).toHaveCSS(
      "padding-bottom",
      "80px",
    );
    await expect(page.getByLabel(UI.nameLabel)).toHaveAttribute(
      "maxlength",
      String(MAX_PLAYER_NAME_LENGTH),
    );
    await expect(
      page.getByLabel(UI.roomLabel, { exact: true }),
    ).toHaveAttribute("maxlength", String(MAX_ROOM_NAME_LENGTH));
    await page.evaluate((size) => {
      document.documentElement.style.fontSize = `${size}px`;
    }, fontSize);
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expectLayoutFits(page);
    }
    await page.getByLabel(UI.nameLabel).fill("Alex");
    await page
      .getByLabel(UI.roomLabel, { exact: true })
      .fill(`rwd-${randomUUID()}`);
    await page.locator("form button[type=submit]").click();
    const board = page.getByRole("region", { name: UI.boardLabel });
    await expect(board).toBeVisible();
    await expect(board.locator(".tile-text").first()).toHaveCSS(
      "font-size",
      `${(fontSize * 15) / 16}px`,
    );
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expectLayoutFits(page);
    }
    for (const index of [0, 1, 2]) {
      await board.getByRole("button").nth(index).click();
    }
    await expect(
      page.getByRole("heading", { name: UI.summaryTitle }),
    ).toBeVisible();
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expectLayoutFits(page);
    }
  });
}
