import { DriaSearchTool, DriaQueryTool } from "@langchain/community/tools/dria";

// using Bitcoin Whitepaper at: https://dria.co/knowledge/2KxNbEb040GKQ1DSDNDsA-Fsj_BlQIEAlzBNuiapBR0
const contractId = "2KxNbEb040GKQ1DSDNDsA-Fsj_BlQIEAlzBNuiapBR0";

// search
const searchTool = new DriaSearchTool({ contractId });
const searchPrompt = "What is Bitcoin?";
const searchResults = await searchTool.invoke(searchPrompt);
console.log(searchResults);

// query
const queryTool = new DriaQueryTool({ contractId });
const queryVector = Array.from({ length: 768 }, () => Math.random());
const queryResults = await queryTool.invoke({ vector: queryVector });
console.log(queryResults);
