import { Tool, ToolParams } from "@langchain/core/tools";

/**
 * Parameters for Dria search tool.
 */
export interface DriaParams extends ToolParams {
  /** Number of top results, i.e. K parameter for KNN. Defaults to 10. */
  k?: number;
  /** Contract ID for the knowledge. In Dria, this can be seen at the top of the page when viewing a knowledge. */
  contractId: string;
  /** User API key. */
  apiKey: string;
}

/**
 * A tool in the LangChain framework that allows an agent to tap-into knowledge uploaded to Dria.
 *
 * Dria tool takes input a string, and makes a search request to the knowledge at the provided contract, which will return the most-relevant text piece
 * with respect to the input prompt.
 *
 * Example: https://dria.co/knowledge/0USsyWjNe6nXWGkebYfYKC-VjQwJaA2ZS2HzALzgpgU
 */
export class DriaTool extends Tool {
  readonly k: number;

  readonly contractId: string;

  readonly url: "https://search.dria.co/hnsw/search";

  private readonly headers: Record<string, string>;

  static lc_name() {
    return "DriaTool";
  }

  name = "dria";

  description =
    "Dria tool exposes the search endpoint of Dria, enabling an agent to tap into permissionless knowledge uploaded to Dria.";

  constructor(params: DriaParams) {
    super(params);

    this.k = params.k ?? 1;
    this.contractId = params.contractId;
    this.headers = {
      "x-api-key": params.apiKey,
      "Content-Type": "application/json",
    };
  }

  /** @ignore */
  async _call(input: string) {
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          rerank: true,
          top_n: this.k,
          contract_id: this.contractId,
          query: input,
        }),
      });

      if (!res.ok) {
        return `Dria Search tool failed with ${res.statusText} (${res.status}).`;
      }

      const body: {
        success: number;
        data: {
          id: number;
          metadata: string;
          score: number;
        }[];
        code: number;
      } = await res.json();

      // return metadata (texts) added together
      const searchResult = body.data.map((d) => d.metadata).join("\n");

      return searchResult;
    } catch (error) {
      // return error in a stringified form, similar to the Request Tool (requests.ts in this dir)
      return `${error}`;
    }
  }
}
