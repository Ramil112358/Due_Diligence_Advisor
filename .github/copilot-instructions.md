Always test your code after making changes to ensure that it works as expected - open the app in the integrated browser and check if both frontent and backend are working correctly. If you encounter any issues, review your changes and debug as necessary.
Update README.md and other relevant documentation to reflect any changes you made, especially if they change overall architecture, add new functionality or affect how to set up or run the project. This will help other developers understand the new changes and how to work with them.
Always ask for clarification with follow-up questions using askQuestions tool if there are any uncertainties about the requirements or implementation details or if there are more than one approach or interpretation of the task instead of making assumptions. 
Always research the viability of the task requirements and construct detailed implementation plan before starting to code. If you find any issues or architectural constraints/concerns, ask for clarification and suggest alternative approaches that may be more feasible or efficient based on the repo and best practices.
Update this instruction file with any findings or insights you discover during implementation that may be helpful for future reference or for other developers working on the project. This could include architectural decisions, trade-offs, challenges faced, mistakes and how you resolved them so that you don't make the same mistakes again.

Implementation note: when adding new SQLAlchemy columns to existing SQLite-backed models in this repo, include a lightweight startup schema upgrade in `backend/app/db.py` because the app relies on `Base.metadata.create_all(...)` rather than migrations.

UI theming note: Klarus brand presentation is mostly neutral and editorial (white/off-white backgrounds, dark graphite text, subtle slate borders, rounded pill CTAs) with restrained accent usage; prefer understated hierarchy over saturated gradients or heavy glow effects.

Intake metadata note: when adding new intake form fields (for example `client`), propagate the field across frontend `FormData`, backend route `Form(...)` args, SQLAlchemy `Session` model, response schemas, and `_ensure_schema_updates()` for existing SQLite databases.

Generation UX reliability note: `GET /api/sessions/{id}/generate` is stream-based and can be interrupted by network/browser conditions; keep frontend state resilient by polling `GET /api/sessions/{id}` (for example every second while pending summaries/Q&A exist) so UI updates without manual refresh.

Generation completion note: avoid status-only checks like `status !== "done"` for global loading indicators; questions with `error` may still contain an answer payload, so pending should require both non-done status and missing answer.

Session layout note: keep Data Room and Due Diligence Q&A in separate sidebars around chat and preserve symmetric collapse/expand controls on both sides so users can reclaim workspace width without losing quick access to either panel.

Generation throughput note: for `GET /api/sessions/{id}/generate`, prefer bounded concurrency (`asyncio.gather` + `asyncio.Semaphore`) for both file summaries and DD Q&A so LLM calls run in parallel without overwhelming provider limits; keep per-item DB writes and SSE item events intact.

File summary status note: track file summaries with an explicit `files.status` (`pending`/`done`/`error`) and drive frontend loading from that status rather than `summary == null`, so LLM/provider failures (for example quota 429) resolve to visible `error` instead of infinite spinners.