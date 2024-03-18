# v0.7.0

- Changed: preserve official output format
- Changed: customizable token estimation
- Changed: default api version at `2024-02-01`

# v0.6.1

- Changed: default api version at `2024-02-15-preview`

# v0.6.0

- Fixed: tools API typing

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
