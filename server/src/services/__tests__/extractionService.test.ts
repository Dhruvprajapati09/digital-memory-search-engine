import { describe, expect, it } from "vitest";
import { resolveSafeUploadPath } from "../extractionService";
import path from "path";
import { UPLOAD_DIR } from "../../middleware/upload";

describe("resolveSafeUploadPath", () => {
  it("resolves filenames inside uploads directory", () => {
    const resolved = resolveSafeUploadPath("test-file.pdf");
    expect(resolved).toBe(path.join(UPLOAD_DIR, "test-file.pdf"));
  });

  it("rejects path traversal attempts", () => {
    expect(() => resolveSafeUploadPath("../secret.txt")).toThrow(
      "Invalid file path"
    );
  });

  it("rejects nested traversal attempts", () => {
    expect(() => resolveSafeUploadPath("..\\..\\windows\\system.ini")).toThrow(
      "Invalid file path"
    );
  });
});
