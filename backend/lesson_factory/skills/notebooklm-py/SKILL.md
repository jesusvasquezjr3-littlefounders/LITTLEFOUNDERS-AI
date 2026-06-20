# NotebookLM — Grounding Tool

Programmatic access to Google NotebookLM for building a local knowledge base.
Create notebooks, add sources, chat with content, and generate artifacts.

## Quick Reference

| Task | Command |
|------|---------|
| Authenticate | `notebooklm login` |
| List notebooks | `notebooklm list` |
| Create notebook | `notebooklm create "Title"` |
| Set context | `notebooklm use <id>` |
| Add URL | `notebooklm source add "https://..."` |
| Add file | `notebooklm source add ./file.pdf` |
| Add YouTube | `notebooklm source add "https://youtube.com/..."` |
| Chat with sources | `notebooklm ask "question"` |
| Chat with refs | `notebooklm ask "question" --json` |
| Web research (fast) | `notebooklm source add-research "query"` |
| Web research (deep) | `notebooklm source add-research "query" --mode deep` |
| Generate podcast | `notebooklm generate audio "instructions"` |
| Generate report | `notebooklm generate report --format briefing-doc` |
| Generate quiz | `notebooklm generate quiz` |
| Generate flashcards | `notebooklm generate flashcards` |
| Download audio | `notebooklm download audio ./output.mp3` |

## Common Workflow

```
notebooklm create "Research: Topic"
notebooklm source add ./doc.pdf
notebooklm source add "https://..."
notebooklm ask "Summarize key points"
notebooklm generate audio "Focus on..."
notebooklm download audio ./podcast.mp3
```

## Key Notes

- Sources must be indexed before chat/generation (use `source wait` or check `source list --json`)
- Reliable operations: list, create, delete, source management, chat, mind-map, reports, data-tables
- Rate-limited operations: audio, video, quiz, flashcard, infographic generation
- Use `--json` for structured output parsing
- Use `--prompt-file` for long prompts exceeding shell limits
- Supported source types: PDFs, YouTube, URLs, Google Docs, text, Markdown, EPUB, audio, video, images
