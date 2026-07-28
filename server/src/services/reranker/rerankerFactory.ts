import { env } from "../../config/env";
import type { CrossEncoderProvider } from "./rerankerTypes";
import {
  BgeCrossEncoderProvider,
  JinaCrossEncoderProvider,
  CohereCrossEncoderProvider,
} from "./crossEncoder";

export type RerankProviderId = "bge" | "jina" | "cohere";

const providerCache = new Map<RerankProviderId, CrossEncoderProvider>();

export function createRerankProvider(
  providerId?: string
): CrossEncoderProvider {
  const id = (providerId ?? env.RERANK_PROVIDER).toLowerCase() as RerankProviderId;

  const cached = providerCache.get(id);
  if (cached) return cached;

  let provider: CrossEncoderProvider;

  switch (id) {
    case "jina":
      provider = new JinaCrossEncoderProvider();
      break;
    case "cohere":
      provider = new CohereCrossEncoderProvider();
      break;
    case "bge":
    default:
      provider = new BgeCrossEncoderProvider();
      break;
  }

  providerCache.set(id, provider);
  return provider;
}

/** Clear cached providers (for tests) */
export function resetRerankProviderCache(): void {
  providerCache.clear();
}

/** Resolve default provider: BGE when HF key present, otherwise Jina if configured */
export function resolveDefaultProviderId(): RerankProviderId {
  if (env.RERANK_PROVIDER) {
    return env.RERANK_PROVIDER.toLowerCase() as RerankProviderId;
  }
  if (env.HUGGINGFACE_API_KEY) return "bge";
  if (env.JINA_API_KEY) return "jina";
  if (env.COHERE_API_KEY) return "cohere";
  return "bge";
}
