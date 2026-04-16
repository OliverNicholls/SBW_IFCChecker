# GroupSelector - StreamBIM Tool

A StreamBIM widget that allows users to select all objects with the same property value.

**How it works:**
1. User specifies a property name (e.g., `ifcclass`, `type`, `category`)
2. User clicks an element in the 3D view
3. The widget automatically selects all elements that have the same value for that property

**Example:** If the user specifies `ifcclass` as the property and clicks on a wall element, the tool will select all walls in the model.

## Features

✅ **Get object properties** - Fetches property values from selected objects using `getObjectInfo()`
✅ **Search for matches** - Queries all objects with matching property values using `getObjectInfoForSearch()`
✅ **Select all matches** - Applies search results as the active selection using `applyObjectSearch()`
✅ **Real-time feedback** - Shows count of matched objects and property values in UI

## API Methods Used

- `getObjectInfo(guid)` - Retrieve full object properties
- `getObjectInfoForSearch(query)` - Search for objects by property
- `applyObjectSearch(query, replace)` - Apply search as selection
- `pickedObject(callback)` - Receive user object selections

## Quick Start

### Installation

```bash
npm install
```

### Development

Run the development server with hot reload:

```bash
npm run dev
```

The widget will be available at `http://localhost:3000`

### Production Build

Build for production:

```bash
npm run build
```

This creates an optimized build in the `dist/` folder.

### Watch Mode

Continuously rebuild on file changes:

```bash
npm run watch
```

## Project Structure

```
├── src/
│   ├── index.ts       # Main widget logic
│   └── index.html     # Widget HTML template
├── dist/              # Built output (generated)
├── package.json       # Dependencies and scripts
├── tsconfig.json      # TypeScript configuration
├── webpack.config.js  # Webpack build configuration
└── README.md          # This file
```

## Widget API Overview

### Connection Methods

#### For widgets running inside StreamBIM:
```typescript
import StreamBIM from 'streambim-widget-api';

await StreamBIM.connectToParent(window, {
  pickedObject: (data) => { /* handle */ },
  spacesChanged: (spaces) => { /* handle */ },
  cameraChanged: (camera) => { /* handle */ }
});
```

#### For embedding StreamBIM in your app:
```typescript
await StreamBIM.connectToChild(iframe, callbacks);
```

### Available Callbacks

- **pickedObject(data)**: Called when user clicks an object in the 3D view
  - `data.position`: 3D coordinate [x, y, z]
  - `data.guid`: Object identifier

- **spacesChanged(spaces)**: Called when user enters/leaves a space
  - `spaces`: Array of IFC space GUIDs

- **cameraChanged(camera)**: Called when camera moves/rotates
  - `camera`: Contains position and orientation data

## Building Your Tool

1. **Rename the folder** to your tool name
2. **Update package.json** with your tool's name and description
3. **Modify src/index.ts** to implement your tool logic
4. **Update src/index.html** to match your UI design
5. **Install dependencies**: `npm install`
6. **Start development**: `npm run dev`

## Deployment

After building with `npm run build`:

1. Upload the `dist/` folder contents to a web server
2. Contact StreamBIM support at `support@rendra.io` to:
   - Whitelist your widget URL
   - Enable it for your StreamBIM project(s)

The widget will then be available in StreamBIM's widget manager.

## Resources

- [StreamBIM Widget API GitHub](https://github.com/streambim/streambim-widget-api)
- [streambim-widget-api on NPM](https://www.npmjs.com/package/streambim-widget-api)

## Support

For StreamBIM-specific questions, contact: `support@rendra.io`
