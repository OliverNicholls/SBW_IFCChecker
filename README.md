# Tikab Tools

A collection of reusable tools and utilities for Tikab projects.

## Project Structure

```
0002_StreamBIM_Widget/
├── tools/                   # Individual tool implementations
│   ├── tool-1/
│   ├── tool-2/
│   └── ...
├── shared/                  # Shared utilities, styles, and components
├── docs/                    # Documentation
├── .gitignore
├── README.md
└── package.json            # Root package manager config
```

## Tools

Each tool is a separate, self-contained module that can be developed and deployed independently.

### Adding a New Tool

Create a new folder under `tools/` with the following structure:

```
tools/my-tool/
├── src/
├── dist/
├── package.json
├── README.md
└── .gitignore
```

## Getting Started

1. Clone the repository
2. Navigate to a specific widget directory
3. Install dependencies and follow widget-specific setup instructions

## Development

Each widget can have its own development setup. See the individual widget README files for specific instructions.

## License

Tikab Strukturmekanik AB
