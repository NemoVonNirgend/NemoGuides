# Nemo's Guides

AI-driven narrative guidance for SillyTavern via tool calls. The model autonomously decides when to invoke scene analysis, story planning, writing quality checks, and narrative tracking.

**Requires:** An API that supports tool calling (OpenAI, Claude, Gemini, etc.)

## Features

### Story Foundation
On a new chat, reads the character card and generates a complete story ruleset — genre, tone, prose craft, world logic, character dynamics, authorial voice selection (from world literature), and narrator personality (MBTI, Enneagram, dere type, temperament). Saved as a persistent lorebook entry.

### Scene Tracking
The AI can assess the scene across four aspects: **thinking** (character thoughts), **clothing** (appearance), **positions** (spatial state), **situation** (full scene summary). Clothing and positions persist as lorebook entries until updated.

### Response Planning
Multi-stage planning pipeline: **plan** (blueprint), **brainstorm** (creative ideas), **refine** (audit for consistency), or **full** (all three in sequence). Tools chain together — scene assessment feeds into plans.

### Polish Prose
Line-editor that fixes awkward phrasing, eliminates repetition, and enhances prose quality while maintaining character voice.

### DM Notes
Persistent narrative scratchpad with six sections: plot threads, off-screen events, character arcs, foreshadowing seeds, session notes, and narrative direction. Stored as a lorebook entry, always in context.

### Writing Quality Analysis
Client-side analysis (zero API calls) scanning AI messages for:
- Repetitive phrases and overused words
- 108 slop patterns across 6 categories (quippy writing, body clichés, voice clichés, action clichés, narrative clichés, overwrought language)
- Sentence structure repetition
- Weak constructions ("couldn't help but", "seemed to", etc.)
- ProsePolisher blacklist integration

Results are injected as warnings so the AI naturally adjusts its writing.

### Prompt Advisor
Scans your preset's prompt list and recommends which prompts to enable/disable for the current character — like a creative director making taste decisions. Works with any preset. Includes "Apply All" to auto-toggle recommendations.

### Activity Feed
Floating widget showing real-time tool activity with fade-in animations, completion effects, and clickable details showing full results and storage locations.

## Installation

1. In SillyTavern, go to Extensions → Install Extension
2. Enter: `https://github.com/NemoVonNirgend/NemoGuides`
3. Enable the extension
4. Create a lorebook called "NemosGuides-Trackers" and add it to your global World Info selection

## Tools (7)

| Tool | Type | What it does |
|------|------|-------------|
| Rule Setup | Sidecar gen | Character card → story rules + authorial voice + narrator personality |
| Scene Assessment | Sidecar gen | Thinking/clothing/positions/situation → lorebook trackers |
| Plan & Refine | Sidecar gen | Plan/brainstorm/refine/full pipeline |
| Polish Prose | Sidecar gen | Line-editing |
| Writing Check | Local analysis | Detailed quality report (no API call) |
| DM Notes | Lorebook CRUD | Read/update/append/remove narrative notes |
| Prompt Advisor | Sidecar gen | Preset prompt recommendations |

## Compatibility

- Works alongside TunnelVision (verified — no conflicts)
- Integrates with ProsePolisher's blacklist if installed
- Compatible with any Chat Completion preset

## Credits

- Inspired by [GuidedGenerations](https://github.com/Samueras/GuidedGenerations-Extension), [ProsePolisher](https://github.com/NemoVonNirgend/ProsePolisher), and [TunnelVision](https://github.com/Coneja-Chibi/TunnelVision)
- Slop pattern taxonomy adapted from the Atelier preset
- By [@NemoVonNirgend](https://github.com/NemoVonNirgend)

## License

GPL-3.0
