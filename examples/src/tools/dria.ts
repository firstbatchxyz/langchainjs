import { DriaSearchTool, DriaQueryTool } from "@langchain/community/tools/dria";

const searchTool = new DriaSearchTool();
const channelResults = await searchTool.invoke("1153400523718938775");
console.log(channelResults);

const queryTool = new DriaQueryTool();
const sendMessageResults = await queryTool.invoke("test message");
console.log(sendMessageResults);
