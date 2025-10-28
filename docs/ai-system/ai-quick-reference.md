# AI Provider Configuration - Quick Reference

## TL;DR

Set these environment variables to control which AI provider/model is used for each task:

```bash
# Task: Image Generation
AI_IMAGE_PROVIDER=openai
AI_IMAGE_MODEL=dall-e-3

# Task: Text Generation (posts, slides, narration)
AI_TEXT_PROVIDER=openai
AI_TEXT_MODEL=gpt-4.1

# Task: Video Slide Generation
AI_VIDEO_SLIDES_PROVIDER=openai
AI_VIDEO_SLIDES_MODEL=gpt-4.1

# Task: AI Agent (Mastra)
AI_AGENT_PROVIDER=openai
AI_AGENT_MODEL=gpt-4.1
```

## Popular Configurations

### All OpenAI (Default)
```bash
AI_IMAGE_PROVIDER=openai
AI_IMAGE_MODEL=dall-e-3
AI_TEXT_PROVIDER=openai
AI_TEXT_MODEL=gpt-4.1
AI_VIDEO_SLIDES_PROVIDER=openai
AI_VIDEO_SLIDES_MODEL=gpt-4.1
AI_AGENT_PROVIDER=openai
AI_AGENT_MODEL=gpt-4.1
OPENAI_API_KEY=sk-proj-...
```

### OpenAI Images + Claude Text
```bash
AI_IMAGE_PROVIDER=openai
AI_IMAGE_MODEL=dall-e-3
OPENAI_API_KEY=sk-proj-...

AI_TEXT_PROVIDER=anthropic
AI_TEXT_MODEL=claude-3-5-sonnet-20241022
AI_VIDEO_SLIDES_PROVIDER=anthropic
AI_VIDEO_SLIDES_MODEL=claude-3-5-sonnet-20241022
AI_AGENT_PROVIDER=anthropic
AI_AGENT_MODEL=claude-3-opus-20250219
ANTHROPIC_API_KEY=sk-ant-...
```

### Local Ollama (Free, No API Keys!)
```bash
AI_TEXT_PROVIDER=ollama
AI_TEXT_MODEL=mistral
AI_VIDEO_SLIDES_PROVIDER=ollama
AI_VIDEO_SLIDES_MODEL=mistral
AI_AGENT_PROVIDER=ollama
AI_AGENT_MODEL=mistral
OLLAMA_BASE_URL=http://localhost:11434/v1

# For images, still use cloud:
AI_IMAGE_PROVIDER=openai
AI_IMAGE_MODEL=dall-e-3
OPENAI_API_KEY=sk-proj-...
```

### Google Gemini
```bash
AI_TEXT_PROVIDER=gemini
AI_TEXT_MODEL=gemini-2.0-flash
GEMINI_API_KEY=...

AI_AGENT_PROVIDER=gemini
AI_AGENT_MODEL=gemini-2.0-flash
```

## Provider Models List

### OpenAI
- **Image**: `dall-e-3` (recommended), `dall-e-2`
- **Text**: `gpt-4.1`, `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`

### Anthropic (Claude)
- `claude-3-5-sonnet-20241022` (best balance)
- `claude-3-opus-20250219` (most capable)
- `claude-3-sonnet-20240229` (older, still good)
- `claude-3-haiku-20240307` (fast, cheap)

### Gemini (via OpenAI-compatible API)
- `gemini-2.0-flash` (latest, recommended)
- `gemini-2.0-flash-exp` (experimental)
- `gemini-1.5-pro` (powerful)
- `gemini-1.5-flash` (fast)

### Ollama (Local)
- `mistral` (good balance)
- `llama2` (Meta's model)
- `neural-chat` (optimized for chat)
- `dolphin-mixtral` (high quality)

### Together AI
- `meta-llama/Llama-3-70b-chat-hf`
- `mistralai/Mixtral-8x22B-Instruct`

## Setup Instructions by Provider

### 1. OpenAI
```bash
# Get key from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-...
```

### 2. Anthropic (Claude)
```bash
# Get key from https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Ollama (Local, Free)
```bash
# Install from https://ollama.ai
# Run locally:
ollama run mistral

# Configure:
OLLAMA_BASE_URL=http://localhost:11434/v1
```

### 4. Google Gemini
```bash
# Get key from https://ai.google.dev
GEMINI_API_KEY=...
```

### 5. Together AI
```bash
# Get key from https://www.together.ai
TOGETHER_API_KEY=...
```

## Fallback Configuration

If a provider goes down, automatically use a fallback:

```bash
# Primary
AI_TEXT_PROVIDER=anthropic
AI_TEXT_MODEL=claude-3-opus-20250219

# Fallback to OpenAI if Claude is down
AI_TEXT_FALLBACK_PROVIDER=openai
AI_TEXT_FALLBACK_MODEL=gpt-4o-mini
```

## Cost Optimization

### Cheap Setup
```bash
# Use gpt-4o-mini (cheap)
AI_TEXT_MODEL=gpt-4o-mini
AI_AGENT_MODEL=gpt-4o-mini

# Use local Ollama (free!)
AI_AGENT_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434/v1
```

### Quality Setup
```bash
# Use best models
AI_TEXT_MODEL=gpt-4.1
AI_AGENT_MODEL=gpt-4.1
AI_IMAGE_MODEL=dall-e-3
```

### Balanced Setup
```bash
# Fast/cheap for simple tasks
AI_TEXT_MODEL=gpt-4o-mini

# Powerful for agent (needs better reasoning)
AI_AGENT_PROVIDER=anthropic
AI_AGENT_MODEL=claude-3-opus-20250219
```

## Debugging

### Check Current Configuration
```typescript
// In your code:
const config = this._taskConfigService.getTaskConfig('image');
console.log('Image provider:', config.provider, 'Model:', config.model);
```

### Enable Verbose Logging
Check application logs for provider initialization messages:
```
Initialized AITaskConfigService with per-task configurations
Initializing Mastra agent with provider: openai, model: gpt-4.1
```

### Test a Provider
Change `.env` temporarily to test:
```bash
# Test Claude
AI_AGENT_PROVIDER=anthropic
AI_AGENT_MODEL=claude-3-5-sonnet-20241022
```

Restart and check logs.

## Environment Variable Pattern

```
AI_<TASKTYPE>_PROVIDER=<provider>
AI_<TASKTYPE>_MODEL=<model>
AI_<TASKTYPE>_FALLBACK_PROVIDER=<provider>
AI_<TASKTYPE>_FALLBACK_MODEL=<model>
```

Where:
- `<TASKTYPE>` = `IMAGE`, `TEXT`, `VIDEO_SLIDES`, `AGENT`
- `<PROVIDER>` = `openai`, `anthropic`, `gemini`, `ollama`, `together`, `custom`
- `<MODEL>` = provider-specific model name

## See Also

- **Detailed Guide**: `per-task-ai-model-assignment.md`
- **Technical Details**: `ai-provider-integration-summary.md`
- **Configuration Reference**: `.env.example`
