import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { withRetry } from "../retry"
import { ApiHandlerOptions, ModelInfo, DriveXModelId, drivexDefaultModelId, drivexModels } from "@shared/api"
import { ApiHandler } from "../index"
import { convertToOpenAiMessages } from "@/api/transform/openai-format"
import { ApiStream } from "@api/transform/stream"
import { convertToR1Format } from "@api/transform/r1-format"

export class DriveXHandler implements ApiHandler {
	private options: ApiHandlerOptions
	private client: OpenAI

	constructor(options: ApiHandlerOptions) {
		this.options = options
		this.client = new OpenAI({
			baseURL: "https://api.drivex.ai/v1",
			apiKey: this.options.drivexApiKey,
		})
	}

	@withRetry()
	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const model = this.getModel()

		let openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		const modelId = model.id.toLowerCase()

		if (modelId.includes("deepseek") || modelId.includes("qwen") || modelId.includes("qwq")) {
			openAiMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
		}

		const stream = await this.client.chat.completions.create({
			model: this.getModel().id,
			messages: openAiMessages,
			temperature: 0,
			stream: true,
			stream_options: { include_usage: true },
		})

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta
			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			if (chunk.usage) {
				yield {
					type: "usage",
					inputTokens: chunk.usage.prompt_tokens || 0,
					outputTokens: chunk.usage.completion_tokens || 0,
				}
			}
		}
	}

	getModel(): { id: string; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in drivexModels) {
			const id = modelId as DriveXModelId
			return { id, info: drivexModels[id] }
		}
		return {
			id: drivexDefaultModelId,
			info: drivexModels[drivexDefaultModelId],
		}
	}
}
