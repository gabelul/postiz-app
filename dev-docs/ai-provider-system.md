# AI Provider System Documentation

## Overview

The AI Provider System enables Postiz to work with multiple AI providers simultaneously, offering automatic load balancing, failover, and cost optimization. Instead of being limited to a single OpenAI API key, you can now configure multiple providers like OpenAI, OpenRouter, Azure OpenAI, Groq, and more.

## Key Features

- **Multi-Provider Support**: Configure multiple AI providers with individual API keys
- **Automatic Rotation**: Round-robin, random, weighted, or failover strategies
- **Task-Based Model Selection**: Different models for complex vs. simple tasks
- **Automatic Failover**: Retry with different providers on failure
- **Cost Optimization**: Route tasks to the most cost-effective providers
- **Health Monitoring**: Track provider performance and availability
- **Backward Compatibility**: Existing single-provider configurations continue to work

## Configuration

### Environment Variable Naming Convention

Each AI provider uses a consistent naming pattern:

```
AI_PROVIDERNAME_URL=""           # API endpoint (optional, uses defaults)
AI_PROVIDERNAME_KEY=""           # API key (required)
AI_PROVIDERNAME_SMART=""         # Model for complex tasks
AI_PROVIDERNAME_FAST=""          # Model for simple tasks
AI_PROVIDERNAME_ENABLED=""       # Enable/disable provider (default: true)
AI_PROVIDERNAME_WEIGHT=""        # Weight for weighted rotation (default: 1)
```

### Global Settings

```env
AI_ROTATION="round-robin"        # Rotation strategy
AI_RETRY_FAILED="true"          # Retry with next provider on failure
AI_MAX_RETRIES="3"              # Maximum retries across providers
```

## Supported Providers

### OpenAI

```env
AI_OPENAI_URL=""                # Optional, defaults to https://api.openai.com/v1
AI_OPENAI_KEY="sk-proj-xxx"
AI_OPENAI_SMART="gpt-4.1"
AI_OPENAI_FAST="gpt-4o-mini"
AI_OPENAI_ENABLED="true"
```

### OpenRouter (for Claude, Gemini, etc.)

```env
AI_OPENROUTER_URL="https://openrouter.ai/api/v1"
AI_OPENROUTER_KEY="sk-or-v1-xxx"
AI_OPENROUTER_SMART="anthropic/claude-3.5-sonnet"
AI_OPENROUTER_FAST="anthropic/claude-3-haiku"
AI_OPENROUTER_ENABLED="true"
```

### Azure OpenAI

```env
AI_AZURE_URL="https://mycompany.openai.azure.com"
AI_AZURE_KEY="azure-key-xxx"
AI_AZURE_SMART="gpt-4"
AI_AZURE_FAST="gpt-35-turbo"
AI_AZURE_ENABLED="true"
```

### Groq (Fast Inference)

```env
AI_GROQ_URL="https://api.groq.com/openai/v1"
AI_GROQ_KEY="gsk-xxx"
AI_GROQ_SMART="mixtral-8x7b-32768"
AI_GROQ_FAST="llama3-8b-8192"
AI_GROQ_ENABLED="true"
```

### Together AI

```env
AI_TOGETHER_URL="https://api.together.xyz/v1"
AI_TOGETHER_KEY="xxx"
AI_TOGETHER_SMART="mistralai/Mixtral-8x22B-Instruct-v0.1"
AI_TOGETHER_FAST="meta-llama/Llama-3-8b-chat-hf"
AI_TOGETHER_ENABLED="true"
```

### Custom/Self-Hosted

```env
AI_CUSTOM_URL="https://my-llm-server.com/v1"
AI_CUSTOM_KEY="custom-key"
AI_CUSTOM_SMART="my-large-model"
AI_CUSTOM_FAST="my-small-model"
AI_CUSTOM_ENABLED="true"
```

## Task Types

The system automatically selects the appropriate model based on task complexity:

### Smart Tasks (Complex)
- Image prompt generation
- Voice text conversion
- Slide generation from text
- Social media post categorization
- Content analysis and extraction

**Uses**: `AI_PROVIDER_SMART` model

### Fast Tasks (Simple)
- Social media post generation
- Website text extraction
- Simple text processing
- Quick content transformations

**Uses**: `AI_PROVIDER_FAST` model

## Rotation Strategies

### Round-Robin (Default)
Cycles through providers in order:
```
Request 1: OpenAI
Request 2: OpenRouter
Request 3: Azure
Request 4: OpenAI (cycles back)
```

### Random
Randomly selects from available providers:
```env
AI_ROTATION="random"
```

### Weighted
Distributes requests based on weights:
```env
AI_ROTATION="weighted"
AI_OPENAI_WEIGHT="3"     # Gets 60% of requests
AI_OPENROUTER_WEIGHT="2" # Gets 40% of requests
```

### Failover
Uses primary provider with fallbacks:
```env
AI_ROTATION="failover"
AI_OPENAI_WEIGHT="3"     # Primary (highest weight)
AI_OPENROUTER_WEIGHT="2" # Secondary
AI_GROQ_WEIGHT="1"       # Tertiary
```

## Usage Examples

### Cost-Optimized Setup

Route expensive tasks to cheaper providers:

```env
# Use OpenRouter for complex tasks (cheaper Claude)
AI_OPENROUTER_URL="https://openrouter.ai/api/v1"
AI_OPENROUTER_KEY="sk-or-v1-xxx"
AI_OPENROUTER_SMART="anthropic/claude-3.5-sonnet"
AI_OPENROUTER_FAST="anthropic/claude-3-haiku"
AI_OPENROUTER_ENABLED="true"

# Use OpenAI for image generation (DALL-E)
AI_OPENAI_KEY="sk-proj-xxx"
AI_OPENAI_SMART="gpt-4.1"
AI_OPENAI_FAST="gpt-4o-mini"
AI_OPENAI_ENABLED="true"

# Use Groq for fast inference
AI_GROQ_URL="https://api.groq.com/openai/v1"
AI_GROQ_KEY="gsk-xxx"
AI_GROQ_SMART="mixtral-8x7b-32768"
AI_GROQ_FAST="llama3-8b-8192"
AI_GROQ_ENABLED="true"
```

### High Availability Setup

Multiple providers for redundancy:

```env
# Primary OpenAI
AI_OPENAI_KEY="sk-proj-primary"
AI_OPENAI_WEIGHT="3"
AI_OPENAI_ENABLED="true"

# Backup OpenRouter
AI_OPENROUTER_URL="https://openrouter.ai/api/v1"
AI_OPENROUTER_KEY="sk-or-v1-backup"
AI_OPENROUTER_WEIGHT="1"
AI_OPENROUTER_ENABLED="true"

# Failover strategy
AI_ROTATION="failover"
AI_RETRY_FAILED="true"
AI_MAX_RETRIES="3"
```

### Multi-Account Load Balancing

Distribute load across multiple accounts:

```env
# OpenRouter Account 1
AI_OPENROUTER1_URL="https://openrouter.ai/api/v1"
AI_OPENROUTER1_KEY="sk-or-v1-account1"
AI_OPENROUTER1_SMART="anthropic/claude-3.5-sonnet"
AI_OPENROUTER1_FAST="anthropic/claude-3-haiku"
AI_OPENROUTER1_ENABLED="true"

# OpenRouter Account 2
AI_OPENROUTER2_URL="https://openrouter.ai/api/v1"
AI_OPENROUTER2_KEY="sk-or-v1-account2"
AI_OPENROUTER2_SMART="anthropic/claude-3.5-sonnet"
AI_OPENROUTER2_FAST="anthropic/claude-3-haiku"
AI_OPENROUTER2_ENABLED="true"

# Round-robin between accounts
AI_ROTATION="round-robin"
```

### Development/Testing Setup

Test new providers safely:

```env
# Production provider
AI_OPENAI_KEY="sk-proj-production"
AI_OPENAI_ENABLED="true"

# Test provider (disabled by default)
AI_EXPERIMENTAL_URL="https://new-provider.com/v1"
AI_EXPERIMENTAL_KEY="test-key"
AI_EXPERIMENTAL_SMART="new-model-large"
AI_EXPERIMENTAL_FAST="new-model-small"
AI_EXPERIMENTAL_ENABLED="false"  # Enable when ready to test
```

## Migration Guide

### From Single Provider

If you currently use:
```env
OPENAI_API_KEY="sk-proj-xxx"
OPENAI_BASE_URL="https://api.openai.com/v1"
SMART_LLM="gpt-4.1"
FAST_LLM="gpt-4o-mini"
```

This automatically becomes:
```env
# Legacy config (still works)
OPENAI_API_KEY="sk-proj-xxx"
OPENAI_BASE_URL="https://api.openai.com/v1"
SMART_LLM="gpt-4.1"
FAST_LLM="gpt-4o-mini"

# Or migrate to new format
AI_OPENAI_URL="https://api.openai.com/v1"
AI_OPENAI_KEY="sk-proj-xxx"
AI_OPENAI_SMART="gpt-4.1"
AI_OPENAI_FAST="gpt-4o-mini"
AI_OPENAI_ENABLED="true"
```

### Adding More Providers

Simply add environment variables for new providers:

```env
# Keep existing OpenAI
AI_OPENAI_KEY="sk-proj-xxx"

# Add OpenRouter
AI_OPENROUTER_URL="https://openrouter.ai/api/v1"
AI_OPENROUTER_KEY="sk-or-v1-xxx"
AI_OPENROUTER_SMART="anthropic/claude-3.5-sonnet"
AI_OPENROUTER_FAST="anthropic/claude-3-haiku"
AI_OPENROUTER_ENABLED="true"
```

## Monitoring and Debugging

### Provider Statistics

The system tracks usage statistics for each provider:
- Request count
- Error count
- Success rate
- Average response time
- Last used timestamp
- Health status

### Health Monitoring

Providers are automatically monitored for:
- API availability
- Response times
- Error rates
- Rate limiting

Unhealthy providers are temporarily disabled and retried periodically.

### Debugging

Enable debug logging to see provider selection:
```env
LOG_LEVEL="debug"
```

This will log:
- Which provider was selected for each request
- Rotation strategy decisions
- Failover attempts
- Health check results

## Security Considerations

- **API Keys**: Store securely, never commit to version control
- **Rate Limiting**: Each provider has its own rate limits
- **Cost Control**: Monitor usage across all providers
- **Access Control**: Use least-privilege API keys when possible

## Troubleshooting

### No Providers Available

**Error**: "No available AI providers"

**Solutions**:
1. Check at least one `AI_*_KEY` is set
2. Verify at least one provider has `AI_*_ENABLED="true"`
3. Check provider health status

### Provider Failures

**Error**: "Request failed after all retry attempts"

**Solutions**:
1. Check API keys are valid
2. Verify provider URLs are correct
3. Check rate limits aren't exceeded
4. Ensure models exist at the provider

### Model Not Found

**Error**: "Model not found" or "Invalid model"

**Solutions**:
1. Check model names are correct for each provider
2. Verify models are available in your provider account
3. Update model names to current versions

## Best Practices

1. **Start Simple**: Begin with one or two providers
2. **Test Configuration**: Use disabled providers to test before enabling
3. **Monitor Costs**: Track usage across all providers
4. **Use Appropriate Models**: Match model capabilities to task complexity
5. **Set Up Failover**: Always have backup providers configured
6. **Regular Updates**: Keep model names current as providers update offerings
7. **Security**: Rotate API keys regularly and use environment-specific keys

## Provider-Specific Notes

### OpenRouter
- Supports many models from different providers
- Pay-per-use pricing
- Good for accessing Claude, Gemini, etc.
- Model names include provider prefix (e.g., `anthropic/claude-3.5-sonnet`)

### Azure OpenAI
- Enterprise-grade OpenAI access
- Custom endpoints per deployment
- Different model naming convention
- May require specific API versions

### Groq
- Extremely fast inference
- Limited model selection
- Good for simple, fast tasks
- Cost-effective for high-volume usage

### Together AI
- Open-source model access
- Good variety of models
- Cost-effective for experimentation
- Some models may have limitations

The AI Provider System gives you flexibility, reliability, and cost control for all your AI needs in Postiz. Start with a simple configuration and expand as your needs grow!