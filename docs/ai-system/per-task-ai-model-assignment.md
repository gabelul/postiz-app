# Per-Task AI Model Assignment Guide

## Overview

This guide explains how to use different AI providers and models for different tasks in Postiz. You can assign:

- **Image generation** (DALL-E, Gemini, custom models)
- **Text generation** (GPT-4, Claude, other LLMs)
- **Video generation** (for slide/narration generation)
- **Agent/LLM** (for the Mastra AI agent)

## Quick Start

### Option 1: All OpenAI (Default)

```bash
# Already configured in .env.example
AI_IMAGE_PROVIDER=openai
AI_IMAGE_MODEL=dall-e-3
AI_TEXT_PROVIDER=openai
AI_TEXT_MODEL=gpt-4.1
AI_AGENT_PROVIDER=openai
AI_AGENT_MODEL=gpt-4.1
```

### Option 2: OpenAI Images + Claude Text

```bash
# Image generation with DALL-E
AI_IMAGE_PROVIDER=openai
AI_IMAGE_MODEL=dall-e-3

# Text generation with Claude
AI_TEXT_PROVIDER=anthropic
AI_TEXT_MODEL=claude-3-5-sonnet-20241022

# Agent with Claude
AI_AGENT_PROVIDER=anthropic
AI_AGENT_MODEL=claude-3-5-sonnet-20241022

# Set up Anthropic API key
ANTHROPIC_API_KEY=sk-ant-...
```

### Option 3: Mix Everything (Advanced)

```bash
# Images from Gemini (via OpenAI-compatible format)
AI_IMAGE_PROVIDER=gemini
AI_IMAGE_MODEL=gemini-2.0-flash

# Text from Claude
AI_TEXT_PROVIDER=anthropic
AI_TEXT_MODEL=claude-3-opus-20250219

# Agent from OpenAI (fallback to Claude)
AI_AGENT_PROVIDER=openai
AI_AGENT_FALLBACK_PROVIDER=anthropic

# Configure API keys
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
```

## Supported Providers

### 1. OpenAI

**Best for:** Image generation (DALL-E), reliable LLM access

```bash
AI_IMAGE_PROVIDER=openai
AI_IMAGE_MODEL=dall-e-3          # Recommended (1024x1024)
AI_IMAGE_MODEL=dall-e-2          # Alternative (1024x1024)

AI_TEXT_PROVIDER=openai
AI_TEXT_MODEL=gpt-4.1            # Most capable
AI_TEXT_MODEL=gpt-4o             # Latest, cheaper
AI_TEXT_MODEL=gpt-4o-mini        # Fast and cheap
AI_TEXT_MODEL=gpt-3.5-turbo      # Legacy, cheap
```

**Configuration:**

```bash
OPENAI_API_KEY=sk-proj-...
```

### 2. Anthropic (Claude)

**Best for:** Long context, nuanced text generation

```bash
AI_TEXT_PROVIDER=anthropic
AI_AGENT_PROVIDER=anthropic

AI_TEXT_MODEL=claude-3-5-sonnet-20241022    # Recommended (best balance)
AI_TEXT_MODEL=claude-3-opus-20250219        # Most capable
AI_TEXT_MODEL=claude-3-sonnet-20240229      # Older, still good
AI_TEXT_MODEL=claude-3-haiku-20240307       # Fast and cheap
```

**Configuration:**

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

**Note:** Anthropic does not offer image generation. Use a different provider for images.

### 3. OpenAI-Compatible Providers

These use the OpenAI API format but with custom endpoints.

#### Gemini (Google)

```bash
AI_TEXT_PROVIDER=gemini
AI_TEXT_MODEL=gemini-2.0-flash        # Latest, fast
AI_TEXT_MODEL=gemini-2.0-flash-exp    # Experimental
AI_TEXT_MODEL=gemini-1.5-pro          # Powerful
AI_TEXT_MODEL=gemini-1.5-flash        # Fast
```

**Configuration:**

```bash
GEMINI_API_KEY=...
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/openai/
```

#### Ollama (Local Models)

Run locally for free, no API costs!

```bash
AI_TEXT_PROVIDER=ollama
AI_TEXT_MODEL=mistral              # Good balance
AI_TEXT_MODEL=llama2               # Meta's model
AI_TEXT_MODEL=neural-chat          # Optimized for chat
AI_TEXT_MODEL=dolphin-mixtral      # High quality
```

**Setup:**

```bash
# Install Ollama from https://ollama.ai
# Run a model:
ollama run mistral

# Configure:
OLLAMA_BASE_URL=http://localhost:11434/v1
```

#### Together AI

```bash
AI_TEXT_PROVIDER=together
AI_TEXT_MODEL=meta-llama/Llama-3-70b-chat-hf
AI_TEXT_MODEL=mistralai/Mixtral-8x22B-Instruct
```

**Configuration:**

```bash
TOGETHER_API_KEY=...
TOGETHER_BASE_URL=https://api.together.xyz/v1
```

#### Custom OpenAI-Compatible API

```bash
AI_TEXT_PROVIDER=openai-compatible
AI_TEXT_MODEL=your-model-name

# Configure:
OPENAI_COMPATIBLE_API_KEY=your-key
OPENAI_COMPATIBLE_BASE_URL=https://your-api.com/v1
```

## Configuration Schema

### Task Types

```
image           - Image generation (DALL-E, etc.)
text            - Text generation (posts, slides, narration)
video-slides    - Video slide generation (uses text models)
agent           - Mastra AI agent (LLM for reasoning)
```

### Environment Variables

For each task type, set:

```bash
AI_<TASKTYPE>_PROVIDER=<provider>              # Provider name
AI_<TASKTYPE>_MODEL=<model-id>                 # Model identifier
AI_<TASKTYPE>_FALLBACK_PROVIDER=<provider>     # Optional fallback
AI_<TASKTYPE>_FALLBACK_MODEL=<model-id>        # Optional fallback model
```

### Examples

```bash
# Image generation using DALL-E
AI_IMAGE_PROVIDER=openai
AI_IMAGE_MODEL=dall-e-3
AI_IMAGE_FALLBACK_PROVIDER=openai
AI_IMAGE_FALLBACK_MODEL=dall-e-2

# Text generation using Claude
AI_TEXT_PROVIDER=anthropic
AI_TEXT_MODEL=claude-3-5-sonnet-20241022
AI_TEXT_FALLBACK_PROVIDER=openai
AI_TEXT_FALLBACK_MODEL=gpt-4o-mini

# Video slides using Gemini
AI_VIDEO_SLIDES_PROVIDER=gemini
AI_VIDEO_SLIDES_MODEL=gemini-2.0-flash
AI_VIDEO_SLIDES_FALLBACK_PROVIDER=openai
AI_VIDEO_SLIDES_FALLBACK_MODEL=gpt-4.1

# Agent using Claude with OpenAI fallback
AI_AGENT_PROVIDER=anthropic
AI_AGENT_MODEL=claude-3-opus-20250219
AI_AGENT_FALLBACK_PROVIDER=openai
AI_AGENT_FALLBACK_MODEL=gpt-4.1
```

## Architecture

### Components

1. **AITaskConfigService** (`ai-task-config.service.ts`)
   - Manages per-task configuration
   - Loads from environment variables
   - Provides task-specific provider/model details

2. **AIProviderAdapterFactory** (`ai-provider-adapter.factory.ts`)
   - Creates appropriate adapter for each provider
   - Caches adapters for reuse
   - Handles provider initialization

3. **Provider Adapters**
   - `OpenAIAdapter` - OpenAI (GPT, DALL-E)
   - `AnthropicAdapter` - Anthropic (Claude)
   - `OpenAICompatibleAdapter` - Generic OpenAI-compatible APIs
   - Support for Gemini, Ollama, Together AI, custom providers

4. **Integration Points**
   - `LoadToolsService.agent()` - Agent LLM selection
   - `MediaService.generateImage()` - Image generation
   - `MediaService.generateVideo()` - Video generation
   - `OpenaiService` - Text generation for slides/narration

### Flow Diagram

```
User Request
    ↓
Task Type (image/text/video/agent)
    ↓
AITaskConfigService
    ↓
Get Provider + Model
    ↓
AIProviderAdapterFactory
    ↓
Create Adapter (OpenAI/Anthropic/Compatible)
    ↓
Execute Task
    ↓
Success → Return Result
    ↓
Failure → Try Fallback Provider (if configured)
```

## Use Cases

### Use Case 1: Cost Optimization

**Goal:** Use cheaper models for simple tasks, premium for complex ones

```bash
# Text: Use fast, cheap model for simple tasks
AI_TEXT_PROVIDER=openai
AI_TEXT_MODEL=gpt-4o-mini

# Agent: Use more powerful model for complex reasoning
AI_AGENT_PROVIDER=openai
AI_AGENT_MODEL=gpt-4.1
```

### Use Case 2: Leveraging Different Strengths

**Goal:** Use best provider for each task

```bash
# Images: DALL-E is best for image generation
AI_IMAGE_PROVIDER=openai
AI_IMAGE_MODEL=dall-e-3

# Text: Claude is better for nuanced writing
AI_TEXT_PROVIDER=anthropic
AI_TEXT_MODEL=claude-3-5-sonnet-20241022

# Agent: Use Claude's reasoning
AI_AGENT_PROVIDER=anthropic
AI_AGENT_MODEL=claude-3-opus-20250219
```

### Use Case 3: Self-Hosted Infrastructure

**Goal:** Run everything locally without external APIs

```bash
# All tasks use local Ollama
AI_IMAGE_PROVIDER=ollama
AI_IMAGE_MODEL=mistral

AI_TEXT_PROVIDER=ollama
AI_TEXT_MODEL=mistral

AI_AGENT_PROVIDER=ollama
AI_AGENT_MODEL=mistral

OLLAMA_BASE_URL=http://localhost:11434/v1
```

**Note:** Local models are slower and less capable than cloud models. Good for testing/development.

### Use Case 4: Hybrid Cloud + Local

**Goal:** Use cloud for quality, local for cost

```bash
# Production: Use cloud providers
AI_IMAGE_PROVIDER=openai
AI_IMAGE_MODEL=dall-e-3

AI_TEXT_PROVIDER=anthropic
AI_TEXT_MODEL=claude-3-opus-20250219

# Development: Fall back to local
AI_IMAGE_FALLBACK_PROVIDER=ollama
AI_TEXT_FALLBACK_PROVIDER=ollama

OLLAMA_BASE_URL=http://localhost:11434/v1
```

## Troubleshooting

### Issue: "Provider not initialized"

**Cause:** Missing API key for the configured provider

**Solution:**

1. Check `.env` file has the right API key:
   ```bash
   OPENAI_API_KEY=sk-proj-...  # For OpenAI
   ANTHROPIC_API_KEY=sk-ant-... # For Anthropic
   GEMINI_API_KEY=...           # For Gemini
   ```

2. Restart the application

3. Check logs for detailed error message

### Issue: "Model not found"

**Cause:** Using incorrect model name or provider doesn't support the model

**Solution:**

1. Check valid models for the provider:
   - OpenAI: `gpt-4.1`, `gpt-4o`, `gpt-3.5-turbo`, `dall-e-3`, etc.
   - Anthropic: `claude-3-5-sonnet-20241022`, `claude-3-opus-20250219`, etc.
   - Gemini: `gemini-2.0-flash`, `gemini-1.5-pro`, etc.

2. Update `.env` with correct model name

3. Restart application

### Issue: "Fallback provider failed"

**Cause:** Both primary and fallback provider are unavailable

**Solution:**

1. Verify API keys are correct
2. Check network connectivity
3. Check provider status pages
4. Review application logs for specific errors

## Examples

### Complete .env Configuration

```bash
# ===== IMAGE GENERATION =====
# Use DALL-E for images
AI_IMAGE_PROVIDER=openai
AI_IMAGE_MODEL=dall-e-3
OPENAI_API_KEY=sk-proj-...

# ===== TEXT & AGENT =====
# Use Claude for better text quality
AI_TEXT_PROVIDER=anthropic
AI_TEXT_MODEL=claude-3-5-sonnet-20241022

AI_VIDEO_SLIDES_PROVIDER=anthropic
AI_VIDEO_SLIDES_MODEL=claude-3-5-sonnet-20241022

AI_AGENT_PROVIDER=anthropic
AI_AGENT_MODEL=claude-3-opus-20250219

ANTHROPIC_API_KEY=sk-ant-...

# ===== FALLBACK CONFIGURATION =====
# If Claude is down, fall back to GPT
AI_TEXT_FALLBACK_PROVIDER=openai
AI_TEXT_FALLBACK_MODEL=gpt-4o-mini

AI_AGENT_FALLBACK_PROVIDER=openai
AI_AGENT_FALLBACK_MODEL=gpt-4.1
```

### Runtime Configuration

Change providers at runtime in your code:

```typescript
import { AITaskConfigService } from '@gitroom/nestjs-libraries/chat/ai-task-config.service';

export class MyService {
  constructor(private taskConfig: AITaskConfigService) {}

  changeImageProvider() {
    // Switch to Gemini for image generation
    this.taskConfig.updateTaskConfig('image', {
      provider: 'gemini',
      model: 'gemini-2.0-flash',
    });
  }
}
```

## Best Practices

1. **Always configure fallbacks**: If a provider goes down, have a fallback
2. **Test before deploying**: Test with actual API keys in staging
3. **Monitor costs**: Different models have different pricing
4. **Keep API keys secure**: Use environment variables, never commit keys
5. **Use local models for dev**: Use Ollama locally to reduce API costs during development
6. **Log provider usage**: Monitor which providers/models are being used

## See Also

- `ai-task-config.service.ts` - Task configuration service
- `ai-provider-adapter.factory.ts` - Provider factory
- `openai-adapter.ts` - OpenAI implementation
- `anthropic-adapter.ts` - Anthropic implementation
- `openai-compatible-adapter.ts` - Custom provider implementation
- `.env.example` - Complete configuration reference
