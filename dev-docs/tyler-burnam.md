# How I use Claude Code. Claude Code has become an essential… | by Tyler Burnam | Jun, 2025 | Medium

[Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) has become an essential tool in my day-to-day work as a software engineer, both in my side projects and in my work at Netflix. Like many of you, I've been using LLMs in my dev workflow for some time now. In the last ~ three months, I’ve transitioned from a primarily _copy-and-paste-into-chat_ workflow to using coding agents in my IDE.

As part of the AI working group in my org, I’ve used [Cline](https://github.com/cline/cline), [Roo](https://github.com/RooCodeInc/Roo-Code), [Aider](https://aider.chat/), [OpenAI Codex](https://github.com/openai/codex), [GitHub Copilot](https://github.com/features/copilot), and [Claude Code](https://github.com/anthropics/claude-code) to examine their suitability for “enterprise engineering”. For a few AI years (i.e., 3 months), I mostly used Roo. The “[custom mode](https://docs.roocode.com/features/custom-modes)” feature turns Roo into a highly customizable agentic platform, and I had written several specialized “agents” at work for various workflows. This was great, especially when Netflix pays the bills. But at home, I found my Roo sessions increasingly hitting the triple-digit territory, and my wealth advisor (Claude with a [Monarch](https://www.monarchmoney.com/) CSV file) told me I need to spend less on AI. That’s when I turned to Claude Code.

Claude Code works as a CLI tool and at first glance appears to be less customizable than Roo. In some ways, that’s true; in others, I think it’s not true (we’ll dig into that below). My initial impression of Claude was good; it’s brilliant out of the box, as good or better than other agents. However, once you integrate some best practices, Claude Code transforms into a (slightly intimidating) mini software engineer and is, in my opinion, the best coding agent available right now. Here’s how I use Claude Code:

## **Install Claude Code**

```
npm install -g @anthropic-ai/claude-code
```

I recommend using the [Claude Max](https://www.anthropic.com/pricing) plan for Claude Code billing. However, you can also use it via the Anthropic API (though it will cost more money).

## **CLAUDE.md**

CLAUDE.md files fine-tune Claude Code to your codebase, making it noticeably more effective. You can provide important **rules**, **examples**, **style guides**, and other **specialized context** for any part of your application.

Treat CLAUDE.md files as **living docs**. Developers (and Claude Code) should be encouraged to update them frequently. As an AI-powered SWE, if you see Claude Code make a fixable mistake, you should update the CLAUDE.md accordingly.

## Nested CLAUDE.md files

CLAUDE.md files get picked up whenever Claude Code goes into a directory where one exists. For example, if you have:

```
app/
├─ CLAUDE.md
└─ components/
   ├─ CLAUDE.md
   └─ SomeSpecializedComponent/
      ├─ CLAUDE.md
      └─ SomeFile.tsx <--- claude code is looking here
```

And Claude Code is looking at `@SomeFile.tsx`, it will pick up:  
`app/CLAUDE.md   components/CLAUDE.md   SomeSpecializedComponent/CLAUDE.md`

I strongly recommend you take advantage of nested CLAUDE.md files. Well-structured nested CLAUDE.md files allow Claude Code to navigate through your codebase and grab enriched context as needed based on the actual work it does.

## Writing Good CLAUDE.md files

**DRY (Don’t repeat yourself)  
**Context is a valuable and limited resource. Always optimize for your context window. Nested CLAUDE.md files **should reduce the context load** for general prompts by providing only critical information for their specific level and then pointing to where more details can be found.

Example: If your app does A, B, C, and D, and you ask about C, the model may not need to know about A, B, and D. Your top-level CLAUDE.md shouldn’t explain how to do all four tasks — instead, provide high-level context and point to where each feature is documented (ideally in their own CLAUDE.md files).

**Brevity**  
Try to keep your CLAUDE.md files to a maximum of 100-200 lines. There will be exceptions, but long CLAUDE.md files are a code smell and take up precious context. Include only essential information for that level of the application.

**XML Tags  
**[This isn’t my idea](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags), but I’ve found it works better. It definitely encourages consistency and clarity. Here are some common ones I use (and an example [Claude Code command](https://gist.github.com/tburnam/9fe77e0a4278514fa3cade9706340f16) I use to edit CLAUDE.md files):

- **<system_context>** — overview and purpose
- **<critical_notes>** — must-know information
- **<paved_path>** — the canonical way
- **<file_map>** — where to find things
- **<patterns>** — common code patterns
- **<example>** — examples
- **<workflow>** — for chain of thought steps
- **<common_tasks>** — step-by-step guides
- **<hatch>** — alternative approaches
- **<advanced_pattern>** — complex use cases
- **<fatal_implications>** — for when Claude Code will not listen :P

**Pointers  
**Make liberal usage of `<file_map>`/pointing to example files in your CLAUDE.md. Claude Code is smart enough to know if it should go look, and you’ll save precious context by keeping your CLAUDE.md cleaner. Ex:

```
<file_map>
app/features/intervals/IntervalSelector/ - Complex date range picker with calendar, preset dropdowns, and custom input validation
app/lib/api/intervals/ - Server-side interval calculation and caching logic
</file_map>
```

**Examples**  
LLMs love examples. You can provide code examples, input/output examples, or point to examples:

```
<example>
Lazy-loaded value - /path/to/example.tsx, search:`getSentimentScore`
Custom-rendered value - /path/to/example2.tsx, search:`renderPriceLine`
Interactive value - /path/to/example3.tsx, search:`targetPrice`
</example>
and/or
<example>
I need to add sharpe ratio to the UI:
// app/libraries/intervals/GridConfig.ts
export const sharpeRatio: IntervalRow = {
  rowId: "sharpe-ratio",
  displayName: "Sharpe Ratio",
  getter: (row) => row.sharpe_ratio <---- MAKE SURE THIS IS AVAILABLE
}
</example>
```

## Prompt Engineering

**File tagging  
**Use @ syntax to tag files. Claude Code does not make an index of the codebase, so when asking a question, you’ll save time and context by pointing to relevant files. Here’s a real prompt I used in a side project:

```
I need you to add HistoricalNewsService fetching to
@app/libraries/intervals/IntervalEnricher/enrich-with-context.ts,
update the news service client in
@app/shared/services/internal-apis/news-service.client.ts
to add getByDateRange() method with circuit breaker,
add pro tier check in @shared/auth/subscription-gates.ts
using the FEATURES.HISTORICAL_NEWS flag,
and update the interval response schema
in @app/api/intervals/[symbol]/route.ts to include news[] array
when enriched=true param is passed
```

**Parallel Agents  
**Claude Code will often spin up parallel agents to read files. You can force this by telling it: `"...use parallel tasks/agents..."` in your prompt.

You can also run:  
`claude config set -g parallelTasksCount N`, where N is a number. This is a great way to analyze large codebases to generate CLAUDE.md files.

Press enter or click to view image in full size

`parallelTasksCount` is currently an undocumented feature, but you can force more parallelization by setting this config.

From monitoring context usage, I’ve gathered that Claude Code has a “main agent,” and these subagents get their own context to perform their task. If you have well-structured nested CLAUDE.md files, you can squeeze maximum context efficiency for surprisingly large tasks with parallel subagents.

Typically, my workflow is to spawn parallel agents in plan mode, with the main agent’s task being to synthesize findings and create a plan. Based on that plan, I’ll then iterate with the main agent before kicking it off to edit-mode.

## **Images**

Press enter or click to view image in full size

_Prompt: Can you fix this dropdown border to match the control pane border when selected?_

Press enter or click to view image in full size

Claude Code is super powerful with images. It understands them well, and you can just drag and drop them in—you can even annotate them! I’ve taken screenshots and circled areas that I wanted changed, and Claude Code will often one-shot the fix. In this example above, I didn’t like the border on the dropdown input not matching.

You can also use [playwright MCP](https://github.com/microsoft/playwright-mcp) (Model Context Protocol) (more on this in Advanced Usage) for a live UI development loop, (perhaps with a custom command), tell Claude Code to implement, launch, screenshot, compare to reference shot, repeat until completion.

## General Prompt Engineering Tips

- Use `// CLAUDE TODO`:  
  I use these to mark ephemeral context for Claude Code. It’s a great way to black box functions, mark bugs, or mark refactors. I instruct my Claude Code to search for these first.
- Use `/compact` at around 20-30% available context
- `Shift+Tab` into Plan Mode mode before implementation
- Use `"ultrathink"` in your prompts to force Claude Code to think deeper
- Use `!`to enter bash mode and run a command in Claude Code’s context window
- Use dictation (I use [superwhisper](https://superwhisper.com/), others are good too)

## Commands

Claude Code supports `/slash-commands` that allow you to access saved prompts. I use commands for repeatable workflows, QA, document generation, and more. They’re a super powerful tool to save and reuse highly specialized prompts.

You save these prompts in `.claude/commands/<command-name>.md` and can call them from your chat prompt with `/<command-name>`. Some example commands:

- `/add-question-to-form <question-details>`: a command to add a question to a form. Defines required information, exact steps, MCP calls, and instructs Claude Code to ask clarifying questions if anything is missing/unclear.
- `/monday-summary`: a command that uses scripts/mcp to pull Slack messages, Jira tickets, PRs, custom scripts, and personal todos to generate an executive summary of the week ahead (non-repo specific).

## MCP (Model Context Protocol) Servers

Claude Code supports remote and local MCP servers. MCP servers give Claude Code access to external tools and services. These can be very powerful (and very dangerous). Be very careful with MCP servers, especially in an enterprise environment.

You can add remote MCPs easily via the command line:  
`claude mcp add context7 — npx -y [@upstash/context7-mcp](http://twitter.com/upstash/context7-mcp)`

For more information on how to add MCP servers, check out the [Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code/mcp).

**Alternative to MCP  
**MCP is most useful when you don’t have to maintain it. Alternatively, I prefer to write bash scripts (or any program really) and describe how to use it to Claude Code. This often allows me to iterate more quickly and retain complete control over what the tools can do. Here are some examples of scripts I’ve written:

- `getSlackMessagesFromChannel <channel_name> <from_date> <to_date>` — gets cleaned messages from a Slack channel for a given timeframe
- `broadcastBuild` — runs the app, sets up ngrok tunnel, sends a notification
- `sendMail/getMail` — script wrapper around testmail.app

## Advanced Usage

## Git Worktrees

You can use git worktrees to run parallel instances of Claude Code on different branches in your repository. I typically use git worktrees when I want to test out different prompts for the same task.

```
git worktree add ../experiments/approach-1 experiment/approach-1
git worktree add ../experiments/approach-2 experiment/approach-2
git worktree add ../experiments/approach-3 experiment/approach-3
git worktree add ../experiments/approach-4 experiment/approach-4
```

Then you can run `claude` in each directory and test it however you like. Once you choose a winner, just merge it into your branch and clean up:

```
# Merge winner
git checkout <source-branch>
git merge experiment/winner
# Clean up
git worktree remove ../experiments/approach-...
git branch -d experiment/approach-...
```

The [Anthropic docs](https://docs.anthropic.com/en/docs/claude-code/common-workflows#run-parallel-claude-code-sessions-with-git-worktrees) cover setting up Git Worktrees.

## **QA Agent**

I’ve been using Claude Code as a QA agent, and it’s unsurprisingly very good.

`claude mcp add playwright — npx -y [@playwright/mcp](http://twitter.com/playwright/mcp)@latest`

Then, you can tell Claude Code to use playwright. Pro-tip: create a command `.claude/commands/qa-<flow>.md` for each flow you want to test. Include entry point, test account info (if applicable, user persona, and report formatting. Claude Code will take screenshots, read HTML, and determine what to do. The nice part about QA is that you really shouldn’t provide a ton of context, since a new user won’t have that context.

For my QA agent flow, I want it to be more empowered and usable in a feedback loop with a coding agent. I typically add the [Sentry MCP](https://docs.sentry.io/product/sentry-mcp/):

`claude mcp add sentry — npx -y @sentry/mcp-server@latest — access-token=\”$SENTRY_ACCESS_TOKEN\” — host=myhost.sentry.io`

and will instruct it to check Sentry if it runs into an error. If nothing’s there, I tell it to run a script that gives a tail of the runtime logs, then provide as much context as possible in their QA report.

I’ve included a basic QA command example in the Appendix.

Side note: I’m fascinated by the QA agent space, and would love to work on something open-source. Please reach out if you’re also interested or know of a good project.

## **YOLO**

Sometimes the stakes are low or the risks are asymmetric. In that case, you can let Claude Code run wild with:

`claude --dangerously-skip-permissions`

I don’t recommend doing this at work, and if you do it outside of work, be sure to execute it in an isolated environment, like [the one Anthropic recommends](https://github.com/anthropics/claude-code/tree/main/.devcontainer).

This mode is useful for internal tools or wild ideas. I’ve used this mode to create several free versions of paid tools.

## Appendix

**.claude/commands/qa-agent (**[**gist**](https://gist.github.com/tburnam/15748cf3455422ecfb420a4fc0a3ab63)**):**

```
# QA Agent Command
<system_context>
You are an expert QA agent. Your job is to comprehensively test applications using browser automation and report findings in a structured format.
Your default entry point is http://localhost:3000/
</system_context>
<critical_notes>
## CRITICAL NOTES
- **READ ONLY MODE**: You will NEVER make or commit any changes to the codebase
- **Context Aware**: Balance thoroughness with context efficiency - be detailed where it matters
- **Structured Reporting**: Separate bugs/errors from improvements/observations
</critical_notes>
<prerequisites>
## PREREQUISITES CHECK
1. **Check for Playwright MCP**
   - Verify playwright MCP is available
   - If not available, STOP and inform user: "Playwright MCP is required. Install with: `claude mcp add playwright - npx -y @playwright/mcp@latest`"
   - Only proceed if playwright is confirmed available
</prerequisites>
<app_manifest>
## APP MANIFEST
TODO: ADD HIGH LEVEL LIST OF FLOWS IN YOUR APP SO THE QA AGENT KNOWS ONCE EVERYTHING IS TESTED
</app_manifest>
<workflow>
## QA TESTING WORKFLOW
1. **Parse Test Requirements**
   - Extract entry point URL from prompt
   - Identify test accounts/auth credentials
   - Note specific flows or areas to focus on
   - If no specifics given, test all flows in app_manifest
2. **Launch Playwright**
   - Navigate to provided entry point
   - Handle authentication if credentials provided
   - Set up appropriate viewport and browser context
3. **Execute Comprehensive Testing**
   - For each flow in app_manifest:
     - Test happy path completely
     - Test edge cases and error states
     - Verify data persistence and state management
     - Check responsive behavior
     - Test accessibility basics (keyboard nav, ARIA)
   - Document every observation meticulously
4. **Error Classification**
   - **Bugs/Errors**: Broken functionality, crashes, data loss
   - **Improvements**: UX issues, performance, inconsistencies
   - **Observations**: Notable patterns, potential optimizations
5. **Continuous Documentation**
   - Keep running log of all tests performed
   - Screenshot critical issues
   - Note reproduction steps for any bugs
</workflow>
<testing_checklist>
## COMPREHENSIVE TESTING AREAS
### Functionality
- All interactive elements work as expected
- Forms validate and submit correctly
- Navigation flows are logical
- Data saves and loads properly
- Error states display appropriately
### Visual & UX
- Layout consistency across pages
- Loading states present where needed
- Feedback for user actions
- Mobile responsiveness
- No visual glitches or overlaps
### Performance & Reliability
- Page load times reasonable
- No console errors
- Network requests complete successfully
- Graceful handling of failures
- No memory leaks in long sessions
### Edge Cases
- Empty states handled
- Maximum input lengths respected
- Special characters in inputs
- Rapid clicking/interaction
- Browser back/forward behavior
</testing_checklist>
<report_format>
## FINAL REPORT STRUCTURE
### Executive Summary
- Total flows tested: X
- Critical bugs found: Y
- Improvements suggested: Z
- Overall app stability: [Stable/Unstable]
### Bugs & Errors (Priority: Critical/High/Medium/Low)
```

BUG-001: [Title]
Flow: [Which flow]
Steps to Reproduce:

1. [Step 1]
2. [Step 2]
   Expected: [What should happen]
   Actual: [What happened]
   Impact: [User impact]
   Screenshot: [If applicable]

```
### Improvements & Observations
```

IMP-001: [Title]
Flow: [Which flow]
Current: [Current behavior]
Suggested: [Improvement suggestion]
Rationale: [Why this matters]

```
### Test Coverage Summary
- List all flows tested
- Note any areas not tested and why
- Confidence level in each flow
</report_format>
<execution_tips>
## EXECUTION TIPS
- Take as long as needed for thoroughness
- Use explicit waits over arbitrary delays
- Test one flow completely before moving to next
- Clear browser state between major flows
- Document unexpected behaviors immediately
- Use descriptive selectors when reporting issues
</execution_tips>
```

**.claude/commands/claude-editor (**[**gist**](https://gist.github.com/tburnam/9fe77e0a4278514fa3cade9706340f16)**)**:

````
<system_context>
You are an expert CLAUDE.md editor. IMPORTANT: If you make any changes that makes any CLAUDE.md file out of date, please update the CLAUDE.md file accordingly.
</system_context>
<critical_notes>
## MISSION CRITICAL RULES
1. **Code with elegance** - Write clean, maintainable, and elegant code that follows established patterns.
2. **Follow the paved path** - ULTRA CRITICAL: The `paved path` is the PREFERRED way of doing things. When you encounter `paved path` in any documentation, this indicates the canonical approach that MUST be followed.
3. **Type safety is mandatory** - NEVER use `any` types. If you believe `any` is necessary, PAUSE and request explicit user approval, even in auto-accept mode.
4. **User runs the application** - Unless you are running a QA command, you do not run the app. Always ask the user to run the app and report results back to you.
5. **Clarify ambiguity** - Favor asking follow-up questions to ensure clear understanding of requirements before implementation.
6. **Preserve existing functionality** - NEVER reduce the scope of existing features/behaviors unless explicitly instructed to do so.
7. **CLAUDE.md as living documentation** - ULTRA CRITICAL: Treat all CLAUDE.md files as living API documentation for your future self. Always check for relevant CLAUDE.md files and update them when changes impact their accuracy.
8. **Writing expert CLAUDE.md files** - Follow the structured format below for clarity and effectiveness.
</critical_notes>
<claude_md_best_practices>
## CLAUDE.MD BEST PRACTICES
### Purpose & Philosophy
- **Living brain**: CLAUDE.md files are your persistent memory across sessions
- **API documentation**: Write for your future self as an expert coding agent
- **Token-aware**: Keep concise while preserving critical information
- **Current state only**: Document what IS, not what WAS (no changelogs)
### Structure & Format
#### 1. XML-Style Tags (Semantic Sections)
```markdown
<system_context>
Brief overview of what this module/system does. Set the stage for understanding.
</system_context>
<file_map>
## FILE MAP
- `/path/to/file` - Brief description
- `/path/to/folder/` - What's in this folder
</file_map>
<paved_path>
## ARCHITECTURE (PAVED PATH)
The canonical way to do things. Battle-tested patterns that MUST be followed.
</paved_path>
<patterns>
## PATTERNS
Common patterns with real code examples from the codebase.
</patterns>
<critical_notes>
## CRITICAL NOTES
- **Bold key points** with brief explanations
- Gotchas and edge cases
- Things that will break if done wrong
</critical_notes>
````

#### 1. Code Examples

```typescript
// BAD: Manual chunking
processChunk: (ticks: Tick[], size: number) => {
  const results = [];
  for (let i = 0; i < ticks.length; i += size) {
    results.push(ticks.slice(i, i + size).reduce(aggregateOHLCV));
  }
  return results;
};
// GOOD: Stream-based
processChunk: (ticks: Tick[], size: number) => {
  return Stream.from(ticks)
    .batch(size)
    .map(batch => batch.reduce(aggregateOHLCV))
    .toArray();
};
```

#### 2. Writing Style

- **Terse but complete**: Every word matters
- **Present tense**: "Store manages state" not "Store will manage"
- **Active voice**: "Use this pattern" not "This pattern should be used"
- **Imperatives for rules**: "MUST", "NEVER", "ALWAYS"

### Advanced Techniques

#### Chain of Thought

```markdown
<workflow>
## WORKFLOW
1. **Find interface** in `/shared/interfaces/market-data-provider.ts`
2. **Create directory** `/integrations/providers/YourProvider/`
3. **Create files** implement provider interface and rate limiting per `/integrations/providers/CLAUDE.md`
</workflow>
```
