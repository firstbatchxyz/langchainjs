import { Tool, ToolParams, StructuredTool } from "@langchain/core/tools";
import { z } from "zod";

/** Return type of a Dria API call. */
type DriaAPIReturnType = {
  success: number;
  data: {
    id: number; // embedding id
    metadata: string; // text
    score: number; // relevance
  }[];
  code: number;
};

/** Common parameters for both Dria tools. */
interface DriaCommonParams extends ToolParams {
  /** Number of top results, i.e. K parameter for KNN (defaults to 10).
   *
   * For `k > 1`, the returned string from this tool will be results concatenated together as a string.
   *
   * Must be an integer in range (0, 20].
   */
  k?: number;
  /**
   * Contract ID for the knowledge, corresponding to the transaction id of a contract deployment on Arweave.
   *
   * In Dria, this can be seen at the top of the page when viewing a knowledge.
   */
  contractId: string;
  /** User API key, accessible on your profile page at [Dria](https://dria.co/profile). */
  apiKey: string;
}

/** Parameters for Dria search tool. */
export interface DriaSearchParams extends DriaCommonParams {
  /** If enabled, will re-rank the results from most to least semantically relevant to the given search query. */
  rerank?: boolean;
}

/**
 * A tool in the LangChain framework that allows an agent to tap-into knowledge uploaded to [Dria](https://dria.co/).
 *
 * Dria Search tool takes input a string, and makes a search request to the knowledge at the provided contract, which will return the most-relevant text piece
 * with respect to the input prompt.
 */
export class DriaSearchTool extends Tool {
  readonly k: number;

  readonly contractId: string;

  readonly url: "https://search.dria.co/hnsw/search";

  readonly rerank: boolean;

  private readonly headers: Record<string, string>;

  static lc_name() {
    return "DriaSearchTool";
  }

  name = "dria-search";

  description =
    "Exposes the search endpoint of Dria, enabling an agent to tap into permissionless knowledge uploaded to Dria by providing.";

  constructor(params: DriaSearchParams) {
    super(params);

    this.contractId = params.contractId;
    this.headers = {
      "x-api-key": params.apiKey,
      "Content-Type": "application/json",
    };

    this.k = Math.round(params.k ?? 1);
    if (this.k <= 0 || this.k > 20) {
      throw new Error("k must be in range (0, 20].");
    }

    this.rerank = params.rerank ?? true;
  }

  /** @ignore */
  async _call(input: string) {
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          rerank: this.rerank,
          top_n: this.k,
          contract_id: this.contractId,
          query: input,
        }),
      });

      if (!res.ok) {
        return `Dria Search tool failed with ${res.statusText} (${res.status}).`;
      }

      const body: DriaAPIReturnType = await res.json();

      // return metadata (texts) added together
      const searchResult = body.data.map((d) => d.metadata).join("\n");

      return searchResult;
    } catch (error) {
      // return error in a stringified form, similar to the Request Tool (requests.ts in this dir)
      return `${error}`;
    }
  }
}

/** Parameters for Dria Query tool. */
export interface DriaQueryParams extends DriaCommonParams {
  /** The level of detail for the searc. Must be an integer 1, 2, 3, or 4. Defaults to 2. */
  level?: number;
}

/**
 * A tool in the LangChain framework that allows an agent to send a vectory query to some knowledge uploaded to [Dria](https://dria.co/).
 *
 * Dria Query tool takes input a vector (array of numbers), and makes a query to the knowledge at the provided contract, which will return the most-relevant text piece
 * with respect to the query vector.
 */
export class DriaQueryTool extends StructuredTool {
  readonly k: number;

  readonly contractId: string;

  readonly url: "https://search.dria.co/hnsw/query";

  readonly level: number;

  private readonly headers: Record<string, string>;

  static lc_name() {
    return "DriaQueryTool";
  }

  schema = z.object({
    vector: z.array(z.number()),
  });

  name = "dria-query";

  description =
    "Exposes the query endpoint of Dria, enabling K-NN queries over a knowledge with a query vector.";

  constructor(params: DriaQueryParams) {
    super(params);

    this.contractId = params.contractId;
    this.headers = {
      "x-api-key": params.apiKey,
      "Content-Type": "application/json",
    };

    this.k = Math.round(params.k ?? 1);
    if (this.k <= 0 || this.k > 20) {
      throw new Error("k must be in range (0, 20].");
    }

    this.level = Math.round(params.level ?? 2);
    if (this.level < 1 || this.level > 4) {
      throw new Error("level must be an integer, one of: 1, 2, 3, 4.");
    }
  }

  /** @ignore */
  async _call({ vector }: z.infer<this["schema"]>) {
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          level: this.level,
          top_n: this.k,
          contract_id: this.contractId,
          vector,
        }),
      });

      if (!res.ok) {
        return `Dria Query tool failed with ${res.statusText} (${res.status}).`;
      }

      const body: DriaAPIReturnType = await res.json();

      // return metadata (texts) added together
      const queryResult = body.data.map((d) => d.metadata).join("\n");

      return queryResult;
    } catch (error) {
      // return error in a stringified form, similar to the Request Tool (requests.ts in this dir)
      return `${error}`;
    }
  }
}
