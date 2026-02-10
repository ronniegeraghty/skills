# AzSDK Tools Agent - Inner Loop

## Sprint 12 Update

Feb 9th, 2026

## Executive Summary

The team made solid progress in Sprint 12, advancing strategic capabilities that extend the reach and reliability of our agent workflow. To showcase where we are, the team recorded a [demo video](<INSERT_DEMO_LINK_HERE>) that walks through the full end-to-end experience—from authoring a change on a service TypeSpec all the way to generating PRs for all five SDK languages. A major milestone was completing the approval for data plane self-serve, which enables service teams to initiate SDK generation through the Release Planner—a workflow previously available only for Management Plane. This broadens automated SDK generation to a much larger set of service teams. On the TypeSpec authoring front, the team completed building a custom agent that leverages the Azure Knowledge Base and resolved key design questions around [add-new-version scenarios](https://github.com/Azure/azure-sdk-tools/issues/13568), including ARM resource operations, versioning workflows, and resource type distinctions. The [cross-language client.tsp strategy work](https://github.com/Azure/azure-sdk-tools/issues/12183) brought together Java, .NET, and Go teams to standardize approaches for handling breaking changes, ensuring consistency as we extend customization capabilities across all language SDKs.

Several improvements landed to strengthen the day-to-day developer experience and the underlying tooling architecture. [Git worktree support](https://github.com/Azure/azure-sdk-tools/issues/13630) was added by replacing LibGit2Sharp with direct git CLI calls, unblocking developers who rely on worktree workflows. The team [centralized tsp-client execution](https://github.com/Azure/azure-sdk-tools/issues/13667), replacing on-demand `npx` fetching with the managed installation from `eng/common/tsp-client` for improved security and version consistency. The [VerifySetup architecture was refactored from JSON config to code](https://github.com/Azure/azure-sdk-tools/issues/13554), enabling OS/language/repo-specific conditional instructions and fixing a bug bash issue where the agent incorrectly suggested global TypeSpec installs. The team also [migrated 15+ Python tox checks to CLI commands](https://github.com/Azure/azure-sdk-tools/issues/12024)—including mypy, pylint, black, pyright, ruff, and bandit—modernizing the Python validation story and enabling tighter integration with the agent workflow.

The team completed an [investigation into using Skills](https://github.com/Azure/azure-sdk-tools/issues/13784) to replace instruction files that provide workflow context to the agent, with the goal of reducing initial context load and improving token efficiency. Looking ahead, the team will focus on completing the 8 in-progress items—particularly in SDK Code Customization and TypeSpec Authoring—while Sprint 13 brings substantial planned work across Integration & AI Tooling, Package Metadata & Docs, and TypeSpec Authoring.

## Overall Project RAG Status

🟢 **Green** — Most items complete, remaining items in progress and on track. Major milestones achieved include data plane self-serve approval, completion of the TypeSpec authoring agent with Azure Knowledge Base, and delivery of SDK customization Phase B detection capabilities.

## Milestones & Progress

*Bug Bash column indicates work completed based on feedback collected during bug bash.*

| Category | Task | Status | Bug Bash | Notes |
|----------|------|--------|----------|-------|
| TypeSpec Authoring | [[Typespec Authoring] Build custom agent to author typespec with Azure Knowledge base](https://github.com/Azure/azure-sdk-tools/issues/13501) | ✅ Done |  | Scenario 2 |
| TypeSpec Authoring | [[Epic][Typespec Authoring] enhance Azure knowledge Base to better support typespec authoring](https://github.com/Azure/azure-sdk-tools/issues/13502) | 🔄 In Progress |  | Scenario 2 |
| TypeSpec Authoring | [[TypeSpec Authoring] Figure out the the best way to write TypeSpec for add new version scenario](https://github.com/Azure/azure-sdk-tools/issues/13568) | 🔄 In Progress |  | Scenario 2 |
| TypeSpec Authoring | [[TypeSpec Authoring] Investigate and add an ARM Skill targeting to do authoring for ARM cases](https://github.com/Azure/azure-sdk-tools/issues/13569) | 🔄 In Progress |  | Scenario 2 |
| Environment Setup | [Clarify .NET version needed](https://github.com/Azure/azure-sdk-tools/issues/12970) | ✅ Done | ✅ | CLI mode |
| Environment Setup | [[Bug Bash] azure-rest-api-specs - agent really wants to install typespec/tcgc globally](https://github.com/Azure/azure-sdk-tools/issues/13342) | ✅ Done | ✅ | Fixed with VerifySetup refactor |
| Environment Setup | [Refactor VerifySetup Requirements to be in code instead of json](https://github.com/Azure/azure-sdk-tools/issues/13554) | ✅ Done |  | Enables OS/language/repo-specific instructions |
| Environment Setup | [Plan verifysetup scenario 2 implementation](https://github.com/Azure/azure-sdk-tools/issues/13629) | ✅ Done |  | Auto-install planning |
| Environment Setup | [Investigate Skill for VerifySetup (Conclusion Included)](https://github.com/Azure/azure-sdk-tools/issues/13784) | ✅ Done |  | Research on Skills vs MCP tools |
| Environment Setup | [Add auto-install functionality to VerifySetup](https://github.com/Azure/azure-sdk-for-python/issues/45065) | ✅ Done |  |  |
| SDK Generation | [Updated copilot instruction in SDK language repos for local SDK generation workflow](https://github.com/Azure/azure-sdk-tools/issues/13540) | ✅ Done |  | All tier-1 language repos updated |
| SDK Generation | [Use centrally managed tsp-client installation instead of on-demand npx execution](https://github.com/Azure/azure-sdk-tools/issues/13667) | ✅ Done |  | Security and consistency improvement |
| SDK Generation | [[azsdk] azsdk_package_build_code fails if file path has spaces](https://github.com/Azure/azure-sdk-tools/issues/13731) | ✅ Done |  | Path quoting fix |
| SDK Generation | [[Go] Generator tool fails to detect repo root when using git work tree](https://github.com/Azure/azure-sdk-tools/issues/13816) | ✅ Done |  | Git worktree support |
| SDK Code Customization | [Implement Phase B activation detection based on customization file presence](https://github.com/Azure/azure-sdk-tools/issues/13543) | ✅ Done |  | Language-specific customization file detection |
| SDK Code Customization | [Define ManualGuidanceDetail structure for Phase B uncertain cases](https://github.com/Azure/azure-sdk-tools/issues/13544) | ✅ Done |  | Structured responses with actionable guidance |
| SDK Code Customization | [Review and resolve the SDK breaking changes after SDK generation](https://github.com/Azure/azure-sdk-tools/issues/11579) | 🔄 In Progress |  |  |
| SDK Code Customization | [Strategies for updating client.tsp](https://github.com/Azure/azure-sdk-tools/issues/12183) | 🔄 In Progress |  | Cross-language coordination |
| SDK Code Customization | [Implement SDK regeneration after Phase B code patches](https://github.com/Azure/azure-sdk-tools/issues/13547) | 🔄 In Progress |  |  |
| SDK Code Customization | [Create Phase A microagent for TypeSpec client customizations](https://github.com/Azure/azure-sdk-tools/issues/13553) | 🔄 In Progress |  |  |
| Samples & Sample Generation | [[azsdk-cli] Investigate using copilot instead of Foundry for samples generation](https://github.com/Azure/azure-sdk-tools/issues/13748) | ✅ Done |  | Copilot SDK investigation |
| Samples & Sample Generation | [Samples generation core](https://github.com/Azure/azure-sdk-tools/issues/11434) | 🔄 In Progress |  |  |
| Package Metadata & Docs Updates | [Support version and release date update in the CHANGELOG.md](https://github.com/Azure/azure-sdk-tools/issues/13830) | ✅ Done |  | ChangelogHelper implementation |
| Validation | [Add azpysdk CLI Checks](https://github.com/Azure/azure-sdk-tools/issues/12024) | ✅ Done |  | 15+ tox checks migrated to CLI |
| Validation | [Investigate scenarios for validation and workflow](https://github.com/Azure/azure-sdk-tools/issues/12687) | ✅ Done |  |  |
| Releasing | [[Bug Bash] MCP call azsdk_check_package_release_readiness hangs](https://github.com/Azure/azure-sdk-tools/issues/13409) | ✅ Done | ✅ | Fixed hang issue |
| Releasing | [Add MCP tool for abandoning a release plan using work item or release plan ID](https://github.com/Azure/azure-sdk-tools/issues/13821) | ✅ Done |  | New azsdk_abandon_release_plan tool |
| Releasing | [Identify service ID and product ID from existing release plan for the given typespec project path.](https://github.com/Azure/azure-sdk-tools/issues/13886) | ✅ Done |  | Release plan lookup |
| Integration & AI Tooling | [Telemetry -> metrics and PowerBi board](https://github.com/Azure/azure-sdk-tools/issues/12316) | ✅ Done |  | Dashboard setup |
| Integration & AI Tooling | [AzSDK MCP server: Investigate CLI telemetry not being uploaded](https://github.com/Azure/azure-sdk-tools/issues/12616) | ✅ Done |  | Telemetry fix |
| Integration & AI Tooling | [Get approval for data plane self serve change](https://github.com/Azure/azure-sdk-tools/issues/12808) | ✅ Done |  | Major milestone |
| Integration & AI Tooling | [Azure SDK Tools MCP Server Telemetry & Dashboard Requirements](https://github.com/Azure/azure-sdk-tools/issues/12486) | ✅ Done |  | Telemetry schema design |
| Integration & AI Tooling | [[AI Evaluations] Provide a mechanism to evaluate MCP tool calls](https://github.com/Azure/azure-sdk-tools/issues/13317) | ✅ Done | ✅ | PromptToToolMatchEvaluator |
| Integration & AI Tooling | [Support git worktree working directories](https://github.com/Azure/azure-sdk-tools/issues/13630) | ✅ Done |  | Replaced LibGit2Sharp with git CLI |
| Other | [Update EngHub documentation based on process changes because of MCP](https://github.com/Azure/azure-sdk-tools/issues/12807) | ✅ Done |  | Documentation updates |
| Other | [Package Info is missing SDK type for  .NET](https://github.com/Azure/azure-sdk-tools/issues/12839) | ✅ Done |  | Package info fix |

## Value Delivered

- Validation workflows provide clearer feedback for service teams
- MCP integration is more reliable with improved telemetry and diagnostics
- Developers experience smoother environment setup with improved tooling and configuration
- Release process is streamlined with new planning and tracking tools
- Teams have better control over SDK customizations with new detection and guidance features
- Service teams can now author TypeSpec more effectively with enhanced Azure knowledge base support
- SDK generation workflow is now more reliable with git worktree support and centralized tsp-client execution

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| No significant risks identified | N/A | Continue monitoring Sprint progress |

## Next Steps (Sprint 13 Focus)

### Carry-Over from Sprint 12 (In Progress)
- **Samples & Sample Generation**: Complete [Samples generation core](https://github.com/Azure/azure-sdk-tools/issues/11434)
- **SDK Code Customization**: Complete [Review and resolve SDK breaking changes](https://github.com/Azure/azure-sdk-tools/issues/11579), [Strategies for updating client.tsp](https://github.com/Azure/azure-sdk-tools/issues/12183), [SDK regeneration after Phase B](https://github.com/Azure/azure-sdk-tools/issues/13547), [Phase A microagent for TypeSpec customizations](https://github.com/Azure/azure-sdk-tools/issues/13553)
- **TypeSpec Authoring**: Complete [Enhance Azure Knowledge Base](https://github.com/Azure/azure-sdk-tools/issues/13502), [Best approach for add-new-version scenario](https://github.com/Azure/azure-sdk-tools/issues/13568), [ARM Skill investigation](https://github.com/Azure/azure-sdk-tools/issues/13569)

### Sprint 13 New Work

**TypeSpec Authoring (11 items)**
- [Support add new preview version case](https://github.com/Azure/azure-sdk-tools/issues/TBD)
- [Support create/read/delete operations to existing resource](https://github.com/Azure/azure-sdk-tools/issues/TBD)
- [Support add update (PATCH) operations to existing resource](https://github.com/Azure/azure-sdk-tools/issues/TBD)
- [MCP tools should validate azure-rest-api-specs PR CI checks before PR creation](https://github.com/Azure/azure-sdk-tools/issues/13735)
- [Ingest ARM library into Azure Knowledge Base](https://github.com/Azure/azure-sdk-tools/issues/TBD) *(In Progress)*

**SDK Code Customization (7 items)**
- [Phase B-specific stall detection with separate error tracking](https://github.com/Azure/azure-sdk-tools/issues/13545)
- [Create Phase B microagent with ClientCustomizationCodePatchTool](https://github.com/Azure/azure-sdk-tools/issues/13546)
- [Integrate APIView feedback entry point into CustomizedCodeUpdateTool](https://github.com/Azure/azure-sdk-tools/issues/13497)
- [Client Customizations feedback/error classifier](https://github.com/Azure/azure-sdk-tools/issues/TBD)

**Integration & AI Tooling (14 items)**
- [Publish Azure SDK Tools MCP into 1ES MCP registry](https://github.com/Azure/azure-sdk-tools/issues/13084) *(In Progress)*
- [Investigate microagents vs GitHub Copilot SDK](https://github.com/Azure/azure-sdk-tools/issues/13744) *(In Progress)*
- [Self service SDK and custom GitHub coding agent](https://github.com/Azure/azure-sdk-tools/issues/12903)
- [Documentation update to reflect MCP strategy](https://github.com/Azure/azure-sdk-tools/issues/12752)
- [Update rest repositories documentation with MCP information](https://github.com/Azure/azure-sdk-tools/issues/12806)

**Package Metadata & Docs (14 items)**
- Add support for generating package artifacts (.NET, Java, Python, JS)
- Support version updates in language-specific package files (all languages)
- [Add pack tool azsdk_package_pack](https://github.com/Azure/azure-sdk-tools/issues/TBD)
- [Add tool for CI file update](https://github.com/Azure/azure-sdk-tools/issues/TBD)

**Validation (5 items)**
- [azsdk_package_run_check runs for entire service instead of singular package](https://github.com/Azure/azure-sdk-tools/issues/TBD)
- [Investigate chronus](https://github.com/Azure/azure-sdk-tools/issues/TBD)
- [Feature Request: MCP Tool to Pull CI Logs for Local Debugging](https://github.com/Azure/azure-sdk-tools/issues/TBD)

**Releasing (5 items)**
- [Release plan steps not correctly updated](https://github.com/Azure/azure-sdk-tools/issues/12967)
- [Determine first release for management plane namespace approval](https://github.com/Azure/azure-sdk-tools/issues/12969)
- [Get product and service details from existing release plan](https://github.com/Azure/azure-sdk-tools/issues/13883) *(In Progress)*

**Environment Setup (2 items)**
- [Implement auto-install for verifysetup](https://github.com/Azure/azure-sdk-tools/issues/TBD) *(In Progress)*
- [Setup Env on Local Machine](https://github.com/Azure/azure-sdk-tools/issues/11707) *(In Progress)*

**Testing (3 items)**
- [Run Samples tool](https://github.com/Azure/azure-sdk-tools/issues/12292)
- [Investigate more detailed test runner contract](https://github.com/Azure/azure-sdk-tools/issues/12526)
- [Bug Bash: Asked to run Python tests, failed and tried to bypass MCP](https://github.com/Azure/azure-sdk-tools/issues/TBD)
