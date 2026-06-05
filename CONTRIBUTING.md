# Contributing to Atuin Desktop

*Note:* This repository contains a `runbooks/` folder, which contains an offline Atuin Desktop workspace with runbooks that can be useful for development and testing. Create a new offline workspace and choose the `runbooks/` folder as the workspace directory to open it. We will be expanding this workspace with more runbooks and information over time.

## Prerequisites

Developing on Atuin Desktop requires:

* Node.js 24.11.1 (see `.tool-versions` for most up-to-date information)
* [Bun](https://bun.sh/docs/installation)
* Latest Rust stable

Since Atuin Desktop is a Tauri app, you'll also need all of the prerequisites listed in the [Tauri Prerequisites doc](https://tauri.app/start/prerequisites/) for your platform.

## Optional tools

For development, you may find it useful to have the following tools installed:

* [direnv](https://direnv.net/)

For documentation, you may find it useful to have the following tools installed:

* [uv](https://docs.astral.sh/uv/#installation)

## Installing dependencies

```
bun install
```

## Running development

```
./script/dev
```

`script/dev` accepts the following options:

```
$ ./script/dev --help
Usage: script/dev [OPTIONS]

Options:
  -p --profile VALUE   Start with the given dev profile
  -s --no-sync         Start with automatic sync disabled
  -d --devtools        Start with devtools opened
  -h --help            Display this help message and exit
```

By default, the app will use the profile `dev`. You can pass a different profile name to use a different set of databases.

## Building

### Building a binary (no packaging)

```
bun run tauri dev --no-bundle
```

### Building a package

```
bun run tauri build
```

### Regenerating TS-RS bindings from Rust structs

```
bun run generate-bindings
```

## Developer Tools

A global `app` object lives on the `window`. Items can be added to it via `DevConsole.addAppObject()`. The following items are currently available on the object:

* `app.useStore` - the store instance
* `app.state` - a proxy that forwards all property access to `useStore.getState()`
* `app.api` - API functions
* `app.invoke` - Tauri invoke function
* `app.serverObserver` - the server observer instance
* `app.socketManager` - the socket manager instance
* `app.notificationManager` - the notification manager instance
* `app.workspaceSyncManager` - the workspace sync manager instance
* `app.queryClient` - the React-Query client
* `app.AppBus` - the application bus instance
* `app.SSHBus` - the SSH bus instance
* `app.EditorBus` - the editor bus instance
* `app.BlockBus` - the block bus instance
* `app.SharedStateManager` - the shared state manager
* `app.models` - model classes (Runbook, Workspace, Operation)
* `app.handleDeepLink` - function to handle deep links
* `app.setHubCredentials` - function to set hub credentials in development
* `app.editor` - the BlockNote editor instance (when available)

## Contributing to Custom Features (i18n & AI Fixes)

This fork introduces **experimental i18n support** and specific **AI provider bug fixes**. If you have questions, feedback, or want to contribute to these new features:

1. **Reporting Custom Bugs:** Please report any GUI breakages, translation errors, or bugs specifically related to the patched AI providers directly to **this repository's issue tracker**, *not* the official Atuin repository.
2. **Adding Languages:** Since i18n is experimental, community contributions for new translations or fixing existing ones are highly welcomed.
3. **Questions:** If you have questions about how the experimental i18n or AI fixes work, feel free to open a discussion or issue in this repository.

## Common Issues

### Node.js runs out of memory running `bun run tauri build`

You can increase the memory limit by setting the `NODE_OPTIONS` environment variable to `--max-old-space-size=6144`. For example:

```
NODE_OPTIONS=--max-old-space-size=6144 bun run tauri build
```

This repository contains an `.envrc` file that sets this for you if you use [direnv](https://direnv.net/).

### I can't create online workspaces or runbooks

Creating online workspaces and runbooks requires the user to be logged in to Atuin Hub. Atuin Hub is not currently open source, but we are exploring options to make it possible to work on this part of the app without it.
