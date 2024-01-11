import { it, describe } from "@jest/globals";
import {
  DriaQueryTool,
  type DriaQueryParams,
  DriaSearchTool,
  type DriaSearchParams,
} from "../dria.js";

describe("Dria tools", () => {
  const PARAMS = {
    apiKey: "not-an-api-key",
    contractId: "2KxNbEb040GKQ1DSDNDsA-Fsj_BlQIEAlzBNuiapBR0",
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

    it("should throw error without an API key", () => {
      expect(
        () => new DriaQueryTool({ contractId: PARAMS.contractId, k: 0 })
      ).toThrow();
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

    it("should throw error without an API key", () => {
      expect(
        () => new DriaSearchTool({ contractId: PARAMS.contractId, k: 0 })
      ).toThrow();
    });
  });
});
