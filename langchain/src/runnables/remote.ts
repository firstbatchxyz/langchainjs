import {
  Runnable,
  RunnableBatchOptions,
  RunnableConfig,
} from "@langchain/core/runnables";
import { Document } from "@langchain/core/documents";
import { CallbackManagerForChainRun } from "@langchain/core/callbacks/manager";
import {
  ChatPromptValue,
  StringPromptValue,
} from "@langchain/core/prompt_values";
import {
  LogStreamCallbackHandler,
  type LogStreamCallbackHandlerInput,
  type RunLogPatch,
} from "@langchain/core/tracers/log_stream";
import {
  AIMessage,
  AIMessageChunk,
  ChatMessage,
  ChatMessageChunk,
  FunctionMessage,
  FunctionMessageChunk,
  HumanMessage,
  HumanMessageChunk,
  SystemMessage,
  SystemMessageChunk,
  ToolMessage,
  ToolMessageChunk,
} from "@langchain/core/messages";
import {
  GenerationChunk,
  ChatGenerationChunk,
  RUN_KEY,
} from "@langchain/core/outputs";
import {
  getBytes,
  getLines,
  getMessages,
  convertEventStreamToIterableReadableDataStream,
} from "@langchain/community/utils/event_source_parse";
import { IterableReadableStream } from "@langchain/core/utils/stream";

type RemoteRunnableOptions = {
  timeout?: number;
  headers?: Record<string, unknown>;
};

function isSuperset(set: Set<string>, subset: Set<string>) {
  for (const elem of subset) {
    if (!set.has(elem)) {
      return false;
    }
  }
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function revive(obj: any): any {
  if (Array.isArray(obj)) return obj.map(revive);
  if (typeof obj === "object") {
    // eslint-disable-next-line no-instanceof/no-instanceof
    if (!obj || obj instanceof Date) {
      return obj;
    }
    const keysArr = Object.keys(obj);
    const keys = new Set(keysArr);
    if (isSuperset(keys, new Set(["page_content", "metadata"]))) {
      return new Document({
        pageContent: obj.page_content,
        metadata: obj.metadata,
      });
    }

    if (isSuperset(keys, new Set(["content", "type", "additional_kwargs"]))) {
      if (obj.type === "HumanMessage" || obj.type === "human") {
        return new HumanMessage({
          content: obj.content,
        });
      }
      if (obj.type === "SystemMessage" || obj.type === "system") {
        return new SystemMessage({
          content: obj.content,
        });
      }
      if (obj.type === "ChatMessage" || obj.type === "chat") {
        return new ChatMessage({
          content: obj.content,
          role: obj.role,
        });
      }
      if (obj.type === "FunctionMessage" || obj.type === "function") {
        return new FunctionMessage({
          content: obj.content,
          name: obj.name,
        });
      }
      if (obj.type === "ToolMessage" || obj.type === "tool") {
        return new ToolMessage({
          content: obj.content,
          tool_call_id: obj.tool_call_id,
        });
      }
      if (obj.type === "AIMessage" || obj.type === "ai") {
        return new AIMessage({
          content: obj.content,
        });
      }
      if (obj.type === "HumanMessageChunk") {
        return new HumanMessageChunk({
          content: obj.content,
        });
      }
      if (obj.type === "SystemMessageChunk") {
        return new SystemMessageChunk({
          content: obj.content,
        });
      }
      if (obj.type === "ChatMessageChunk") {
        return new ChatMessageChunk({
          content: obj.content,
          role: obj.role,
        });
      }
      if (obj.type === "FunctionMessageChunk") {
        return new FunctionMessageChunk({
          content: obj.content,
          name: obj.name,
        });
      }
      if (obj.type === "ToolMessageChunk") {
        return new ToolMessageChunk({
          content: obj.content,
          tool_call_id: obj.tool_call_id,
        });
      }
      if (obj.type === "AIMessageChunk") {
        return new AIMessageChunk({
          content: obj.content,
        });
      }
    }
    if (isSuperset(keys, new Set(["text", "generation_info", "type"]))) {
      if (obj.type === "ChatGenerationChunk") {
        return new ChatGenerationChunk({
          message: revive(obj.message),
          text: obj.text,
          generationInfo: obj.generation_info,
        });
      } else if (obj.type === "ChatGeneration") {
        return {
          message: revive(obj.message),
          text: obj.text,
          generationInfo: obj.generation_info,
        };
      } else if (obj.type === "GenerationChunk") {
        return new GenerationChunk({
          text: obj.text,
          generationInfo: obj.generation_info,
        });
      } else if (obj.type === "Generation") {
        return {
          text: obj.text,
          generationInfo: obj.generation_info,
        };
      }
    }

    if (isSuperset(keys, new Set(["tool", "tool_input", "log", "type"]))) {
      if (obj.type === "AgentAction") {
        return {
          tool: obj.tool,
          toolInput: obj.tool_input,
          log: obj.log,
        };
      }
    }

    if (isSuperset(keys, new Set(["return_values", "log", "type"]))) {
      if (obj.type === "AgentFinish") {
        return {
          returnValues: obj.return_values,
          log: obj.log,
        };
      }
    }

    if (isSuperset(keys, new Set(["generations", "run", "type"]))) {
      if (obj.type === "LLMResult") {
        return {
          generations: revive(obj.generations),
          llmOutput: obj.llm_output,
          [RUN_KEY]: obj.run,
        };
      }
    }

    if (isSuperset(keys, new Set(["messages"]))) {
      // TODO: Start checking for type: ChatPromptValue and ChatPromptValueConcrete
      // when LangServe bug is fixed
      return new ChatPromptValue({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: obj.messages.map((msg: any) => revive(msg)),
      });
    }

    if (isSuperset(keys, new Set(["text"]))) {
      // TODO: Start checking for type: StringPromptValue
      // when LangServe bug is fixed
      return new StringPromptValue(obj.text);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const innerRevive: (key: string) => [string, any] = (key: string) => [
      key,
      revive(obj[key]),
    ];
    const rtn = Object.fromEntries(keysArr.map(innerRevive));
    return rtn;
  }
  return obj;
}
function deserialize<RunOutput>(str: string): RunOutput {
  const obj = JSON.parse(str);
  return revive(obj);
}

function removeCallbacks(
  options?: RunnableConfig
): Omit<RunnableConfig, "callbacks"> {
  const rest = { ...options };
  delete rest.callbacks;
  return rest;
}

export class RemoteRunnable<
  RunInput,
  RunOutput,
  CallOptions extends RunnableConfig
> extends Runnable<RunInput, RunOutput, CallOptions> {
  private url: string;

  private options?: RemoteRunnableOptions;

  lc_namespace = ["langchain", "schema", "runnable", "remote"];

  constructor(fields: { url: string; options?: RemoteRunnableOptions }) {
    super(fields);
    const { url, options } = fields;
    this.url = url.replace(/\/$/, ""); // remove trailing slash
    this.options = options;
  }

  private async post<Body>(path: string, body: Body) {
    return await fetch(`${this.url}${path}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        ...this.options?.headers,
      },
      signal: AbortSignal.timeout(this.options?.timeout ?? 60000),
    });
  }

  async invoke(
    input: RunInput,
    options?: Partial<CallOptions>
  ): Promise<RunOutput> {
    const [config, kwargs] =
      this._separateRunnableConfigFromCallOptions(options);
    const response = await this.post<{
      input: RunInput;
      config?: RunnableConfig;
      kwargs?: Omit<Partial<CallOptions>, keyof RunnableConfig>;
    }>("/invoke", {
      input,
      config: removeCallbacks(config),
      kwargs: kwargs ?? {},
    });
    return revive((await response.json()).output) as RunOutput;
  }

  async _batch(
    inputs: RunInput[],
    options?: Partial<CallOptions>[],
    _?: (CallbackManagerForChainRun | undefined)[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]> {
    if (batchOptions?.returnExceptions) {
      throw new Error("returnExceptions is not supported for remote clients");
    }
    const configsAndKwargsArray = options?.map((opts) =>
      this._separateRunnableConfigFromCallOptions(opts)
    );
    const [configs, kwargs] = configsAndKwargsArray?.reduce(
      ([pc, pk], [c, k]) =>
        [
          [...pc, c],
          [...pk, k],
        ] as [
          RunnableConfig[],
          Omit<Partial<CallOptions>, keyof RunnableConfig>[]
        ],
      [[], []] as [
        RunnableConfig[],
        Omit<Partial<CallOptions>, keyof RunnableConfig>[]
      ]
    ) ?? [undefined, undefined];
    const response = await this.post<{
      inputs: RunInput[];
      config?: (RunnableConfig & RunnableBatchOptions)[];
      kwargs?: Omit<Partial<CallOptions>, keyof RunnableConfig>[];
    }>("/batch", {
      inputs,
      config: (configs ?? [])
        .map(removeCallbacks)
        .map((config) => ({ ...config, ...batchOptions })),
      kwargs,
    });
    const body = await response.json();

    if (!body.output) throw new Error("Invalid response from remote runnable");

    return revive(body.output);
  }

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions?: false }
  ): Promise<RunOutput[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions: true }
  ): Promise<(RunOutput | Error)[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]> {
    if (batchOptions?.returnExceptions) {
      throw Error("returnExceptions is not supported for remote clients");
    }
    return this._batchWithConfig(
      this._batch.bind(this),
      inputs,
      options,
      batchOptions
    );
  }

  async stream(
    input: RunInput,
    options?: Partial<CallOptions>
  ): Promise<IterableReadableStream<RunOutput>> {
    const [config, kwargs] =
      this._separateRunnableConfigFromCallOptions(options);
    const response = await this.post<{
      input: RunInput;
      config?: RunnableConfig;
      kwargs?: Omit<Partial<CallOptions>, keyof RunnableConfig>;
    }>("/stream", {
      input,
      config,
      kwargs,
    });
    if (!response.ok) {
      const json = await response.json();
      const error = new Error(
        `RemoteRunnable call failed with status code ${response.status}: ${json.message}`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).response = response;
      throw error;
    }
    const { body } = response;
    if (!body) {
      throw new Error(
        "Could not begin remote stream. Please check the given URL and try again."
      );
    }
    const stream = new ReadableStream({
      async start(controller) {
        const enqueueLine = getMessages((msg) => {
          if (msg.data) controller.enqueue(deserialize(msg.data));
        });
        const onLine = (
          line: Uint8Array,
          fieldLength: number,
          flush?: boolean
        ) => {
          enqueueLine(line, fieldLength, flush);
          if (flush) controller.close();
        };
        await getBytes(body, getLines(onLine));
      },
    });
    return IterableReadableStream.fromReadableStream(stream);
  }

  async *streamLog(
    input: RunInput,
    options?: Partial<CallOptions>,
    streamOptions?: Omit<LogStreamCallbackHandlerInput, "autoClose">
  ): AsyncGenerator<RunLogPatch> {
    const [config, kwargs] =
      this._separateRunnableConfigFromCallOptions(options);
    const stream = new LogStreamCallbackHandler({
      ...streamOptions,
      autoClose: false,
    });
    const { callbacks } = config;
    if (callbacks === undefined) {
      config.callbacks = [stream];
    } else if (Array.isArray(callbacks)) {
      config.callbacks = callbacks.concat([stream]);
    } else {
      const copiedCallbacks = callbacks.copy();
      copiedCallbacks.inheritableHandlers.push(stream);
      config.callbacks = copiedCallbacks;
    }
    // The type is in camelCase but the API only accepts snake_case.
    const camelCaseStreamOptions = {
      include_names: streamOptions?.includeNames,
      include_types: streamOptions?.includeTypes,
      include_tags: streamOptions?.includeTags,
      exclude_names: streamOptions?.excludeNames,
      exclude_types: streamOptions?.excludeTypes,
      exclude_tags: streamOptions?.excludeTags,
    };
    const response = await this.post<{
      input: RunInput;
      config?: RunnableConfig;
      kwargs?: Omit<Partial<CallOptions>, keyof RunnableConfig>;
      diff: false;
    }>("/stream_log", {
      input,
      config,
      kwargs,
      ...camelCaseStreamOptions,
      diff: false,
    });
    const { body } = response;
    if (!body) {
      throw new Error(
        "Could not begin remote stream log. Please check the given URL and try again."
      );
    }
    const runnableStream = convertEventStreamToIterableReadableDataStream(body);
    for await (const log of runnableStream) {
      yield revive(JSON.parse(log));
    }
  }
}
