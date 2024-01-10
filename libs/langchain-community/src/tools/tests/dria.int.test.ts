import { it, describe } from "@jest/globals";
import {
  DriaQueryTool,
  type DriaQueryParams,
  DriaSearchTool,
  type DriaSearchParams,
} from "../dria.js";

describe("Dria tools", () => {
  // to run, go to langchain-community directory and then:
  // yarn test:single ./src/tools/tests/dria.int.test.ts

  const PARAMS = {
    apiKey: "not-an-api-key",
    contractId: "ABCD1234",
  };

  describe("DriaQuery", () => {
    PARAMS satisfies DriaQueryParams;

    it("should have correct fields", async () => {
      const tool = new DriaQueryTool(PARAMS);
      expect(tool.name).toBe("dria_query");
      expect(DriaQueryTool.lc_name()).toBe("DriaQueryTool");
    });

    it("should throw error if K is out of range", () => {
      expect(() => new DriaQueryTool({ ...PARAMS, k: 0 })).toThrow();
      expect(() => new DriaQueryTool({ ...PARAMS, k: 21 })).toThrow();
    });

    it("should throw error if level is out of range", () => {
      expect(() => new DriaQueryTool({ ...PARAMS, level: 0 })).toThrow();
      expect(() => new DriaQueryTool({ ...PARAMS, level: 5 })).toThrow();
    });
  });

  describe("DriaSearch", () => {
    PARAMS satisfies DriaSearchParams;

    it("should have correct fields", () => {
      const tool = new DriaSearchTool(PARAMS);
      expect(tool.name).toBe("dria_search");
      expect(DriaSearchTool.lc_name()).toBe("DriaSearchTool");
    });

    it("should throw error if K is out of range", () => {
      expect(() => new DriaSearchTool({ ...PARAMS, k: 0 })).toThrow();
      expect(() => new DriaSearchTool({ ...PARAMS, k: 20 + 1 })).toThrow();
    });
  });
});
