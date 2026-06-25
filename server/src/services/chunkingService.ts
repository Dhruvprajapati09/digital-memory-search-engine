/**
 * @deprecated Import from ./chunking/topicChunkingService instead.
 * Re-exported for backward compatibility with existing imports/tests.
 */
export { chunkText, chunkTextByTopics } from "./chunking/topicChunkingService";

/** Legacy constants kept for tests that reference fixed-size chunking */
export const TARGET_CHUNK_WORDS = 700;
export const OVERLAP_WORDS = 100;
