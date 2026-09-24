import { beforeEach, describe, expect, it, vi } from "vitest";
import { YoutubeTranscript } from "youtube-transcript";
import { fetchTranscript } from "../transcriptService";

vi.mock("youtube-transcript", () => ({
  YoutubeTranscript: {
    fetchTranscript: vi.fn(),
  },
}));

const fetchTranscriptMock = vi.mocked(YoutubeTranscript.fetchTranscript);

describe("fetchTranscript", () => {
  beforeEach(() => {
    fetchTranscriptMock.mockReset();
  });

  it("falls back from a regional metadata language to the base caption language", async () => {
    fetchTranscriptMock.mockImplementation(async (_videoId, options) => {
      if (options?.lang === "en-US") {
        throw new Error(
          "No transcripts are available in en-US this video. Available languages: en"
        );
      }

      return [
        {
          text: "Transcript line one",
          offset: 0,
          duration: 2.5,
          lang: "en",
        },
        {
          text: "Transcript line two",
          offset: 2.5,
          duration: 2,
          lang: "en",
        },
      ];
    });

    const transcript = await fetchTranscript("abc123def45", "en-US");

    expect(fetchTranscriptMock).toHaveBeenNthCalledWith(1, "abc123def45", {
      lang: "en-US",
    });
    expect(fetchTranscriptMock).toHaveBeenNthCalledWith(2, "abc123def45", {
      lang: "en",
    });
    expect(transcript.language).toBe("en");
    expect(transcript.segments[0]).toMatchObject({
      text: "Transcript line one Transcript line two",
      startSeconds: 0,
      endSeconds: 4.5,
      durationSeconds: 4.5,
    });
  });

  it("normalizes millisecond-based transcript offsets", async () => {
    fetchTranscriptMock.mockResolvedValue([
      {
        text: "Millisecond timing",
        offset: 125000,
        duration: 3000,
        lang: "en",
      },
    ]);

    const transcript = await fetchTranscript("abc123def45", "en");

    expect(transcript.segments[0]).toMatchObject({
      text: "Millisecond timing",
      startSeconds: 125,
      endSeconds: 128,
      durationSeconds: 3,
    });
  });

  it("returns a clear no-transcript error after language fallbacks are exhausted", async () => {
    fetchTranscriptMock.mockRejectedValue(
      new Error("Transcript is disabled on this video")
    );

    await expect(fetchTranscript("abc123def45", "en-US")).rejects.toMatchObject({
      statusCode: 422,
      message: "No transcript available for this video. Captions may be disabled.",
    });
  });
});
