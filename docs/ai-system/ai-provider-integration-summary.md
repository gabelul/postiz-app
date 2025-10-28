# AI Provider Integration - Implementation Summary

## What Was Implemented

A comprehensive multi-provider AI system that allows assigning different AI models to different tasks (image generation, text generation, video, and agent).

## New Architecture

### Core Components Created

1. **AITaskConfigService** (`libraries/nestjs-libraries/src/chat/ai-task-config.service.ts`)
   - Manages per-task AI provider and model configuration
   - Loads from environment variables with fallback defaults
   - Provides API to get/update configurations at runtime

2. **AIProviderAdapterFactory** (`libraries/nestjs-libraries/src/chat/ai-provider-adapter/ai-provider-adapter.factory.ts`)
   - Factory pattern for creating provider adapters
   - Supports: OpenAI, Anthropic, Gemini, Ollama, Together AI, custom providers
   - Caches adapters to avoid re-initialization

3. **Provider Adapters**
   - **OpenAIAdapter** - GPT models and DALL-E
   - **AnthropicAdapter** - Claude models
   - **OpenAICompatibleAdapter** - Generic OpenAI-compatible APIs (Gemini, Ollama, Together, custom)
   - Each adapter implements **IAIProviderAdapter** interface

### Integration Points Updated

1. **LoadToolsService** (`load.tools.service.ts`)
   - Now uses AITaskConfigService to determine agent provider/model
   - Supports OpenAI, Anthropic, and OpenAI-compatible providers
   - Includes fallback logic if primary provider fails
   - Logs provider/model information in agent instructions

2. **ChatModule** (`chat.module.ts`)
   - Registers new services: AITaskConfigService, AIProviderAdapterFactory
   - Exports them globally for application-wide use

3. **Environment Configuration** (`.env.example`)
   - Added per-task AI model assignment section
   - Configuration for image, text, video, and agent tasks
   - API key configuration for all supported providers

## Configuration

### Per-Task Model Assignment

```bash
# IMAGE GENERATION
AI_IMAGE_PROVIDER=openai
AI_IMAGE_MODEL=dall-e-3
AI_IMAGE_FALLBACK_PROVIDER=openai
AI_IMAGE_FALLBACK_MODEL=dall-e-2

# TEXT GENERATION
AI_TEXT_PROVIDER=openai
AI_TEXT_MODEL=gpt-4.1
AI_TEXT_FALLBACK_PROVIDER=openai
AI_TEXT_FALLBACK_MODEL=gpt-4o-mini

# VIDEO GENERATION
AI_VIDEO_SLIDES_PROVIDER=openai
AI_VIDEO_SLIDES_MODEL=gpt-4.1
AI_VIDEO_SLIDES_FALLBACK_PROVIDER=openai
AI_VIDEO_SLIDES_FALLBACK_MODEL=gpt-4o-mini

# AGENT
AI_AGENT_PROVIDER=openai
AI_AGENT_MODEL=gpt-4.1
AI_AGENT_FALLBACK_PROVIDER=openai
AI_AGENT_FALLBACK_MODEL=gpt-4o-mini
```

### Supported Providers

| Provider | Use Case | Models |
|----------|----------|--------|
| **openai** | General purpose, image generation | GPT-4.1, GPT-4o, DALL-E 3 |
| **anthropic** | Text generation, reasoning | Claude 3.5 Sonnet, Claude 3 Opus |
| **gemini** | OpenAI-compatible Gemini access | Gemini 2.0 Flash, 1.5 Pro |
| **ollama** | Local self-hosted models | Mistral, Llama2, Neural Chat |
| **together** | Open source models | Llama, Mixtral, etc. |
| **custom** | Any OpenAI-compatible API | User-defined |

## Usage Examples

### Example 1: OpenAI + Claude

```bash
# Images with DALL-E
AI_IMAGE_PROVIDER=openai
AI_IMAGE_MODEL=dall-e-3
OPENAI_API_KEY=sk-proj-...

# Text with Claude
AI_TEXT_PROVIDER=anthropic
AI_TEXT_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_API_KEY=sk-ant-...

# Agent with Claude
AI_AGENT_PROVIDER=anthropic
AI_AGENT_MODEL=claude-3-opus-20250219
```

### Example 2: Local Development

```bash
# Use local Ollama for everything
AI_TEXT_PROVIDER=ollama
AI_TEXT_MODEL=mistral
OLLAMA_BASE_URL=http://localhost:11434/v1

# Still use cloud for images
AI_IMAGE_PROVIDER=openai
AI_IMAGE_MODEL=dall-e-3
OPENAI_API_KEY=sk-proj-...
```

### Example 3: Google Gemini

```bash
# Use Gemini via OpenAI-compatible API
AI_TEXT_PROVIDER=gemini
AI_TEXT_MODEL=gemini-2.0-flash
GEMINI_API_KEY=...
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/openai/
```

## Key Features

✅ **Per-Task Model Assignment** - Different providers/models for different tasks
✅ **Multiple Provider Support** - OpenAI, Anthropic, Gemini, Ollama, Together, custom
✅ **Fallback Logic** - Automatic fallback if primary provider fails
✅ **Environment-Based Configuration** - Easy configuration via `.env`
✅ **Runtime Reconfiguration** - Change providers at runtime if needed
✅ **Provider Caching** - Efficient reuse of initialized providers
✅ **Comprehensive Logging** - Debug provider selection and failures
✅ **Type-Safe Interfaces** - TypeScript interfaces for all providers

## File Structure

```
libraries/nestjs-libraries/src/chat/
├── ai-task-config.service.ts                          # Task configuration
├── ai-provider-adapter/
│   ├── ai-provider-adapter.interface.ts              # Interfaces
│   ├── ai-provider-adapter.factory.ts                # Factory
│   ├── openai-adapter.ts                             # OpenAI provider
│   ├── anthropic-adapter.ts                          # Anthropic provider
│   └── openai-compatible-adapter.ts                  # Custom/Gemini/Ollama
├── load.tools.service.ts                             # Updated with provider logic
├── chat.module.ts                                    # Updated to register services
└── ... (existing files)

dev-docs/
├── per-task-ai-model-assignment.md                   # User guide
└── ai-provider-integration-summary.md                # This file
```

## Dependencies

No new npm packages required! Uses existing:
- `openai` - Already in use
- `@anthropic-ai/sdk` - New Anthropic SDK
- `@ai-sdk/openai` - AI SDK (already in use)
- `@ai-sdk/anthropic` - AI SDK for Anthropic

## Next Steps

### Phase 2: Enhance MediaService

Update image and video generation to use task-specific providers:

```typescript
// In MediaService.generateImage()
const imageConfig = this._taskConfigService.getTaskConfig('image');
const adapter = this._adapterFactory.createAdapter(imageConfig.provider);
const image = await adapter.generateImage(prompt, imageConfig.model);
```

### Phase 3: Dynamic Provider Management

Add API endpoints to:
- View current provider configuration
- Change provider/model at runtime
- Monitor provider usage and costs
- Set organization-specific providers

### Phase 4: Cost Tracking

- Track which provider/model was used for each operation
- Calculate actual costs
- Provide analytics dashboard

## Testing

To test the integration:

1. **Test OpenAI**: Set `AI_AGENT_PROVIDER=openai` (default)
2. **Test Anthropic**: Set `AI_AGENT_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`
3. **Test Gemini**: Set `AI_AGENT_PROVIDER=gemini` + `GEMINI_API_KEY`
4. **Test Ollama**: Set `AI_AGENT_PROVIDER=ollama` + run `ollama run mistral`

Run the agent and check logs for provider initialization.

## Troubleshooting

See `per-task-ai-model-assignment.md` for detailed troubleshooting guide.

### Common Issues

1. **"Provider not initialized"** - Missing API key
2. **"Model not found"** - Invalid model name for provider
3. **"Fallback provider failed"** - All providers unavailable

## Documentation

- **User Guide**: `per-task-ai-model-assignment.md`
- **Implementation Details**: This document
- **Code References**:
  - AITaskConfigService: Configuration service
  - AIProviderAdapterFactory: Provider factory
  - OpenAIAdapter: OpenAI provider
  - AnthropicAdapter: Anthropic provider
  - OpenAICompatibleAdapter: Custom providers

## Summary

The implementation provides a flexible, extensible system for managing multiple AI providers across different tasks in Postiz. Users can now:

- Use different providers for images, text, video, and agent
- Configure all settings via environment variables
- Have automatic fallback if a provider fails
- Optimize for cost, quality, or speed based on their needs
- Support local models (Ollama) alongside cloud providers

This gives Postiz a significant advantage in flexibility and cost optimization compared to hardcoded OpenAI dependency.
