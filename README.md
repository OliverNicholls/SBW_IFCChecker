# StreamBIM Widgets by Tikab

A collection of custom widgets for [StreamBIM](https://www.rendra.io/streambim/) — a web-based BIM/IFC 3D visualization and collaboration platform.

This monorepo contains reusable tools that integrate with StreamBIM projects to provide additional functionality such as object selection, data validation, and model quality checking.

## Widgets

### 1. IFC Checker (`tools/ifc-checker/`)

Validate IFC objects against IDS (Information Delivery Specification) files with flexible object selection and batch validation.

**Use Case:** Enforce data quality standards — check that objects comply with IDS specifications. Select objects manually by clicking in the 3D view, or validate all visible elements at once.

**Key Features:**
- Load IDS specification files from StreamBIM documents or local upload
- Click objects in the 3D view to add them to your selection
- Validate all objects or just your manual selection
- Real-time validation results with pass/fail status
- Selection summary showing total elements and pass rate
- Color-coded 3D visualization (green for passed, red for failed)
- CSV export with validation results and selection source

[📖 IFC Checker README](tools/ifc-checker/README.md)

## Project Structure

```
tools/
├── ifc-checker/          # IDS-based IFC object validation & selection
│   ├── src/
│   │   ├── index.ts
│   │   ├── index.html
│   │   ├── checker.ts
│   │   └── ids-parser.ts
│   ├── package.json
│   ├── webpack.config.js
│   └── README.md
└── (future tools)
shared/                   # Shared utilities & components (future)
docs/                     # Documentation (future)
```

## Getting Started

### Prerequisites

- Node.js 16+ (for development)
- npm or yarn
- A StreamBIM project (for deployment)

### Development Setup

Each tool is independently buildable. To develop the IDS validator widget:

```bash
cd tools/group-selector
npm install
npm run dev
```

The widget will be served on `http://localhost:3000` with hot reload.

### Production Build

```bash
npm run build
```

This generates a self-contained bundle in `dist/` that can be uploaded to StreamBIM.

## Architecture

Each widget is a standalone TypeScript + Webpack application that:

1. **Runs in an iframe** within StreamBIM
2. **Connects via postMessage** using the `streambim-widget-api` library (which wraps `penpal`)
3. **Queries IFC data** through authenticated API calls
4. **Visualizes results** directly on the 3D model (color-coding, highlighting, etc.)

### Technology Stack

- **Language:** TypeScript 5
- **Bundler:** Webpack 5
- **Build Tool:** ts-loader, HtmlWebpackPlugin
- **StreamBIM API:** streambim-widget-api (v2.0+)
- **No frameworks** — vanilla DOM for minimal bundle size and simplicity

### StreamBIM API Usage

The `streambim-widget-api` library provides:

- **Object queries** — `getObjectInfoForSearch()`, `findObjects()`
- **Visualization** — `colorCodeObjects()`, `highlightObject()`, `gotoObject()`
- **Camera control** — `getCameraState()`, `setCameraState()`
- **Low-level API** — `makeApiRequest()` for authenticated HTTP calls to StreamBIM backend

See the [StreamBIM API Reference](https://github.com/rendra-io/streambim-widget-api) for full details.

## Deployment

### Prerequisites

- Your widget must be **whitelisted** for your StreamBIM project
- Contact support@rendra.io to request whitelisting

### Steps

1. **Build the widget:**
   ```bash
   cd tools/[widget-name]
   npm run build
   ```

2. **Upload the `dist/` folder** to your StreamBIM project's documents/widgets area (or any publicly accessible web server)

3. **Create a widget instance** in StreamBIM:
   - Go to **Tools** > **Add Widget**
   - Paste the URL to `dist/index.html`
   - Configure the widget settings (e.g., IDS file URL)

4. **Use the widget** within your project

## Contributing

To add a new widget:

1. Create a new directory in `tools/`
2. Copy the structure from `tools/group-selector/`
3. Implement your widget in TypeScript
4. Write a comprehensive `README.md`
5. Test locally with `npm run dev`
6. Build with `npm run build`
7. Open a PR with your changes

## License

MIT — See [LICENSE](LICENSE) file.

All widgets are released under the MIT license. See individual tool READMEs for details.

## Support & Feedback

- **Issues & Feature Requests** — Open an issue on [GitHub](https://github.com/OliverNicholls/SBW_IFCChecker)
- **StreamBIM Support** — Contact support@rendra.io
- **Documentation** — See individual tool READMEs in `tools/[widget-name]/README.md`

## Related Resources

- [buildingSMART IDS Specification](https://technical.buildingsmart.org/projects/information-delivery-specification-ids/)
- [StreamBIM Widget API](https://github.com/rendra-io/streambim-widget-api)
- [IFC (Industry Foundation Classes) Overview](https://technical.buildingsmart.org/standards/ifc/)
- [buildingSMART International](https://www.buildingsmart.org/)

## Author

**Tikab Strukturmekanik AB**

A Swedish structural engineering firm specializing in BIM and digital construction workflows.

---

**Last Updated:** April 16, 2026
