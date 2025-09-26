import { Injectable } from '@nestjs/common';
import { BaseMessage, HumanMessage } from '@langchain/core/messages';
import { END, START, StateGraph } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { agentCategories } from '@gitroom/nestjs-libraries/agent/agent.categories';
import { z } from 'zod';
import { agentTopics } from '@gitroom/nestjs-libraries/agent/agent.topics';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { AIProviderManagerService } from '@gitroom/nestjs-libraries/openai/ai-provider-manager.service';
import { AIProviderDiscoveryService } from '@gitroom/nestjs-libraries/openai/ai-provider-discovery.service';

interface WorkflowChannelsState {
  messages: BaseMessage[];
  topic?: string;
  category: string;
  hook?: string;
  content?: string;
}

const category = z.object({
  category: z.string().describe('The category for the post'),
});

const topic = z.object({
  topic: z.string().describe('The topic of the post'),
});

const hook = z.object({
  hook: z.string().describe('The hook of the post'),
});

@Injectable()
export class AgentGraphInsertService {
  private model: ChatOpenAI;

  constructor(
    private _postsService: PostsService,
    private readonly providerManager: AIProviderManagerService,
    private readonly discoveryService: AIProviderDiscoveryService
  ) {
    this.initializeModel();
  }

  /**
   * Initialize the ChatOpenAI model with dynamic provider selection
   */
  private initializeModel(): void {
    const enabledProviders = this.discoveryService.getEnabledProviders();

    if (enabledProviders.size > 0) {
      // Use new provider system
      const provider = this.providerManager.getNextProvider({ taskType: 'smart' });
      if (provider) {
        this.model = new ChatOpenAI({
          apiKey: provider.key,
          model: provider.smartModel,
          temperature: 0,
          ...(provider.url && {
            openAIApiKey: provider.key,
            configuration: { baseURL: provider.url }
          }),
        });
      } else {
        this.createLegacyModel();
      }
    } else {
      this.createLegacyModel();
    }
  }

  /**
   * Create legacy model for backward compatibility
   */
  private createLegacyModel(): void {
    this.model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'sk-proj-',
      model: process.env.SMART_LLM || 'gpt-4o-2024-08-06',
      temperature: 0,
      ...(process.env.OPENAI_BASE_URL && {
        openAIApiKey: process.env.OPENAI_API_KEY,
        configuration: { baseURL: process.env.OPENAI_BASE_URL }
      }),
    });
  }
  static state = () =>
    new StateGraph<WorkflowChannelsState>({
      channels: {
        messages: {
          reducer: (currentState, updateValue) =>
            currentState.concat(updateValue),
          default: () => [],
        },
        topic: null,
        category: null,
        hook: null,
        content: null,
      },
    });

  /**
   * Find category for the post using AI classification
   */
  async findCategory(state: WorkflowChannelsState) {
    const { messages } = state;
    const structuredOutput = this.model.withStructuredOutput(category);
    return ChatPromptTemplate.fromTemplate(
      `
You are an assistant that get a social media post and categorize it into to one from the following categories:
{categories}
Here is the post:
{post}
    `
    )
      .pipe(structuredOutput)
      .invoke({
        post: messages[0].content,
        categories: agentCategories.join(', '),
      });
  }

  /**
   * Find topic for the post using AI classification
   */
  findTopic(state: WorkflowChannelsState) {
    const { messages } = state;
    const structuredOutput = this.model.withStructuredOutput(topic);
    return ChatPromptTemplate.fromTemplate(
      `
You are an assistant that get a social media post and categorize it into one of the following topics:
{topics}
Here is the post:
{post}
    `
    )
      .pipe(structuredOutput)
      .invoke({
        post: messages[0].content,
        topics: agentTopics.join(', '),
      });
  }

  /**
   * Extract hook from the post using AI
   */
  findHook(state: WorkflowChannelsState) {
    const { messages } = state;
    const structuredOutput = this.model.withStructuredOutput(hook);
    return ChatPromptTemplate.fromTemplate(
      `
You are an assistant that get a social media post and extract the hook, the hook is usually the first or second of both sentence of the post, but can be in a different place, make sure you don't change the wording of the post use the exact text:
{post}
    `
    )
      .pipe(structuredOutput)
      .invoke({
        post: messages[0].content,
      });
  }

  /**
   * Save the analyzed post to the database
   */
  async savePost(state: WorkflowChannelsState) {
    await this._postsService.createPopularPosts({
      category: state.category,
      topic: state.topic!,
      hook: state.hook!,
      content: state.messages[0].content! as string,
    });

    return {};
  }

  /**
   * Process a new post through the AI analysis workflow
   * @param post - The post content to analyze
   */
  newPost(post: string) {
    const state = AgentGraphInsertService.state();
    const workflow = state
      .addNode('find-category', this.findCategory.bind(this))
      .addNode('find-topic', this.findTopic.bind(this))
      .addNode('find-hook', this.findHook.bind(this))
      .addNode('save-post', this.savePost.bind(this))
      .addEdge(START, 'find-category')
      .addEdge('find-category', 'find-topic')
      .addEdge('find-topic', 'find-hook')
      .addEdge('find-hook', 'save-post')
      .addEdge('save-post', END);

    const app = workflow.compile();
    return app.invoke({
      messages: [new HumanMessage(post)],
    });
  }
}
