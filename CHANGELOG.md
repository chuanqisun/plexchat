# v1.1.1

- Added: Auto-abort when unsubscribing from the stream mode
- Fixed: Abort control does not take effect until task started

# v1.1.0

- Added: stream mode

# v1.0.5

- Added: image input for vision models

# v1.0.1

- Added: status api

# v0.18.0

- Added: json mode support

# v0.16.0

- Added: richer logging

# v0.14.0

- Added: gpt-4o models

# v0.13.0

- Added: `SortRule` support for custom priority

# v0.12.0

- Changed: Simplied `globalTimeout` rule interface

# v0.11.0

- Changed: Simplied API

# v0.10.0

- Added: Sweep rules
- Changed: Factory interface rules

# v0.9.1

- Fixed: Task abortion leaked to unselected tasks

# v0.9.0

- Changed: More intuitive `MatchRule` interface

# v0.8.1

- Fixed: `metadata` was not applied in task submission

# v0.8.0

- Added: Task and worker can be extended with `metadata`
- Added: Customizable rules for task-to-worker matching

# v0.7.0

- Changed: Preserve official output format
- Changed: Customizable token estimation
- Changed: Default api version at `2024-02-01`

# v0.6.1

- Changed: Default api version at `2024-02-15-preview`

# v0.6.0

- Fixed: Tools API typing

# v0.5.2

- Fixed: `content` can be `null`, rather than `undefined`

# v0.5.1

- Fixed: Missing `name` parameter on message
- Fixed: `content` should be optional

# v0.5.0

- Added: Expose tool use API in preparation for function calling deprecation

# v0.4.1

- Added: Consistent typing for input params

# v0.4.0

- Changed: API cleanup and refactor

# v0.3.0

- Added: Individual task `abort` api

# v0.2.2

- Fixed: Non-retryable error verbosity

# v0.2.1

- Fixed: Respect non-retryable error

# v0.2.0

- Added: `abortAll` api

# v0.1.2

- Fixed: Added missing type export for `LogLevel`, with default level being `Error`

# v0.0.7

- Fixed: Logger level handling

# v0.0.5

- Fixed: Token estimation error for function calling

# v0.0.4

- Changed: Simplified chat proxy, allowing model override

# v0.0.1

- Initial release
