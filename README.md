# StreamBIM IDS Checker Widget

A StreamBIM widget for validating IFC (Industry Foundation Classes) files against IDS (Information Delivery Specifications) rules.

## Overview

This widget enables automatic validation of IFC models against machine-readable IDS specifications. The IDS standard, officially approved by buildingSMART in June 2024, allows for computer-interpretable data requirements that can be automatically checked against IFC models.

## Features

- **IFC File Support**: Upload IFC files in text (.ifc) or JSON (.ifcjson) formats
- **IDS Validation**: Validate against IDS XML specifications
- **Detailed Reporting**: Get comprehensive validation results with pass/fail status and detailed messages
- **StreamBIM Integration**: Embedded widget for use within StreamBIM projects

## Technology Stack

- **Frontend**: TypeScript, HTML, CSS
- **Build Tool**: Vite
- **Libraries**:
  - `bsdd-ids-validator` - IDS validation engine
  - `streambim-widget-api` - StreamBIM integration

## Development

### Prerequisites

- Node.js 16+ and npm

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Runs the development server at `http://localhost:5173`

### Build

```bash
npm run build
```

Generates optimized production build in the `dist/` directory.

### Type Checking

```bash
npm run type-check
```

## Project Structure

```
src/
├── main.ts           # Widget entry point
├── widget.ts         # Main widget component
├── validator.ts      # IDS validation logic
└── index.html        # HTML template
```

## Usage

1. **Upload IFC File**: Select an IFC file (text or JSON format)
2. **Upload IDS Specification**: Select an IDS XML file with validation rules
3. **Validate**: Click "Validate" to run the validation
4. **Review Results**: Check the detailed validation report

## IDS Standard

IDS (Information Delivery Specification) is a buildingSMART standard for defining information requirements in IFC models:

- Machine-readable XML format
- Automatic validation support
- Improved data quality and compliance checking
- Reduces manual verification needs

Learn more: [buildingSMART IDS Standard](https://www.buildingsmart.org/standards/bsi-standards/information-delivery-specification-ids/)

## Contributing

Contributions are welcome. Please ensure all code is properly typed and passes type checking.

## License

See LICENSE file for details.
