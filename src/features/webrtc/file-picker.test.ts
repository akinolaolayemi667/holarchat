import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openFilePicker } from "./file-picker";

describe("openFilePicker", () => {
  it("returns false for null or disabled inputs without throwing", () => {
    assert.equal(openFilePicker(null), false);
    const disabled = {
      disabled: true,
      click() {
        assert.fail("click should not run when disabled");
      },
    } as unknown as HTMLInputElement;
    assert.equal(openFilePicker(disabled), false);
  });

  it("invokes click() on an enabled input", () => {
    let clicked = false;
    const input = {
      disabled: false,
      click() {
        clicked = true;
      },
    } as unknown as HTMLInputElement;
    assert.equal(openFilePicker(input), true);
    assert.equal(clicked, true);
  });
});
