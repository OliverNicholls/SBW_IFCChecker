# IFC Checker Widget for StreamBIM

A StreamBIM widget for performing IFC (Industry Foundation Classes) model quality checks using IDS (Information Delivery Specification) files. The widget loads IDS specifications and validates your BIM model against data requirements, with results visualized directly on the 3D model.

## Features

- **IDS File Loading** — Load IDS specifications from URLs (local files, StreamBIM documents, or external sources)
- **Automated Validation** — Run specifications against the IFC model to check compliance
- **3D Visualization** — Color-code objects by pass/fail status (green = pass, red = fail)
- **Interactive Results** — Click on failed objects to navigate and inspect them in the 3D view
- **Multiple Specifications** — Select which specifications to run; useful for different compliance levels
- **Support for IDS 0.9.x and 1.0** — Compatible with both legacy and current IDS versions

## Prerequisites

- **StreamBIM Account** — A valid StreamBIM project with an IFC model
- **Widget Whitelist** — Contact support@rendra.io to whitelist this widget for your project
- **IDS File** — An `.ids` XML file containing your data requirements (see IDS File Format below)

## Installation & Setup

### 1. Build the Widget

```bash
cd tools/ifc-checker
npm install
npm run build
```

This creates a self-contained bundle in `dist/`.

### 2. Upload to StreamBIM

In StreamBIM:
1. Navigate to your project settings
2. Upload the contents of the `dist/` folder to your project's documents/widgets area
3. Note the URL to `index.html` (e.g., `https://your-project.streambim.io/widgets/ifc-checker/index.html`)

### 3. Create a Widget Instance

1. In StreamBIM, go to **Tools** > **Add Widget**
2. Paste the URL from step 2
3. Configure the IDS file URL (see Configuration below)

## Configuration

### IDS File URL

The widget loads IDS files from a URL. You can:

- **Host externally** — Store `.ids` files on your web server, AWS S3, or similar. Paste the full URL.
- **Store in StreamBIM** — Upload `.ids` files to StreamBIM's documents area. The widget can fetch them via authenticated API calls to `/pgw/{project-id}/api/v1/documents/...`
- **Use a shared link** — Cloud storage services (Google Drive, OneDrive) can provide direct-download URLs.

**Example Configuration:**
```
https://my-bim-standards.example.com/structural-requirements.ids
```

The widget will fetch the file and parse the specifications automatically.

## Usage

### Basic Workflow

1. **Load IDS File**
   - Paste the URL to your `.ids` file
   - Click **"Load IDS File"**
   - The widget displays all specifications found in the file

2. **Select Specifications**
   - Review the list of specifications
   - Check/uncheck which ones to run (all are checked by default)
   - Each spec shows its applicability and requirement counts

3. **Run Checks**
   - Click **"Run Checks"**
   - The widget queries the IFC model and validates each specification
   - Results are displayed in collapsible cards

4. **Review Results**
   - Expand each specification card to see pass/fail counts
   - If there are failures, a list of failed objects appears
   - Click any **GUID** to jump to and highlight that object in the 3D view

5. **Visualize on Model**
   - Click **"Visualise Results"**
   - Objects are color-coded on the 3D model:
     - 🟢 Green = passed all checks
     - 🔴 Red = failed one or more checks
   - The legend appears on the model view

6. **Clear All**
   - Click **"Clear All"** to reset and remove color coding

## IDS File Format

IDS files are XML-based specifications defined by buildingSMART International. Here's a minimal example:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ids xmlns="http://standards.buildingsmart.org/IDS"
     xmlns:xs="http://www.w3.org/2001/XMLSchema"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://standards.buildingsmart.org/IDS
       http://standards.buildingsmart.org/IDS/1.0/ids.xsd">

  <info>
    <title>Structural Requirements v1.0</title>
    <description>Quality checks for structural elements</description>
    <author>your-email@example.com</author>
    <date>2024-01-01</date>
    <purpose>Delivery validation</purpose>
  </info>

  <specifications>
    <!-- Specification 1: All walls must have fire rating -->
    <specification name="Walls must have FireRating"
                   description="Every concrete wall must specify a fire rating in Pset_WallCommon"
                   minOccurs="1" maxOccurs="unbounded">
      <applicability>
        <entity>
          <name>
            <simpleValue>IFCWALL</simpleValue>
          </name>
        </entity>
      </applicability>
      <requirements>
        <property dataType="IFCLABEL">
          <propertySet>
            <simpleValue>Pset_WallCommon</simpleValue>
          </propertySet>
          <baseName>
            <simpleValue>FireRating</simpleValue>
          </baseName>
        </property>
      </requirements>
    </specification>

    <!-- Specification 2: Doors must have hardware assembly code -->
    <specification name="Doors must have Mark attribute"
                   minOccurs="0" maxOccurs="unbounded">
      <applicability>
        <entity>
          <name>
            <simpleValue>IFCDOOR</simpleValue>
          </name>
        </entity>
      </applicability>
      <requirements>
        <attribute>
          <name>
            <simpleValue>Mark</simpleValue>
          </name>
        </attribute>
      </requirements>
    </specification>
  </specifications>
</ids>
```

### Supported Facets (v0.1.0)

| Facet | Purpose | Example |
|-------|---------|---------|
| **entity** | Filter by IFC class | `<name><simpleValue>IFCWALL</simpleValue></name>` |
| **property** | Require a property in a property set | `<propertySet>Pset_WallCommon</propertySet> + <baseName>FireRating</baseName>` |
| **attribute** | Require an IFC attribute | `<name><simpleValue>Name</simpleValue></name>` |
| **material** | Filter/require materials | Not yet fully supported |
| **classification** | Filter by classification (Uniclass, OmniClass, etc.) | Not yet supported |
| **partOf** | Require spatial containment | Not yet supported |

**Property Values:**

Properties can specify:
- **Existence check** — Property must exist and be non-empty (no value element)
- **Exact match** — `<simpleValue>FireRating60</simpleValue>`
- **Enumeration** — `<restriction><enumeration value="A"/><enumeration value="B"/></restriction>`
- **Pattern/Range** — `<restriction><pattern value="^[A-Z]{2}\d{3}$"/></restriction>`

See the [buildingSMART IDS specification](https://technical.buildingsmart.org/projects/information-delivery-specification-ids/) for full details.

## Limitations & Future Work

- **Material & Classification facets** — Parsing is supported, but validation is limited
- **Numeric constraints** — Numeric range checks (`[10..50]`) are parsed but not fully validated
- **Large models** — Checking against very large models may be slow; consider specifying applicability facets to reduce the number of objects checked
- **Predefined Types** — Advanced entity predefined type matching not yet implemented

## Development

### Local Development

```bash
npm run dev
```

Starts a dev server on `http://localhost:3001` with hot reload.

### Build for Production

```bash
npm run build
```

Outputs a minified, self-contained widget to `dist/`.

### Project Structure

```
src/
├── index.ts          # Widget entry point, UI, orchestration
├── index.html        # HTML template + all CSS styles
├── ids-parser.ts     # IDS XML parsing via DOMParser
└── checker.ts        # IDS validation logic using StreamBIM API
```

## Troubleshooting

### "Failed to load IDS: Invalid XML format"
- Ensure your `.ids` file is valid XML
- Check the IDS namespace URL matches your IDS version (1.0 vs 0.9.x)
- Use a free XML validator: https://www.xmlvalidation.com/

### "Failed to query applicable objects"
- The StreamBIM API returned an error. Check the browser console for details.
- Ensure your property set and property names match the IFC model exactly (case-sensitive)
- If using custom property sets, verify they exist in the model

### "No objects to color code"
- No objects met the applicability criteria, or all checks passed (and thus nothing failed to visualize)
- Expand the result cards to see details

### Widget doesn't connect to StreamBIM
- Ensure the widget is whitelisted for your project (contact support@rendra.io)
- Check browser console for connection errors
- Ensure you're accessing the widget from within StreamBIM, not directly

## Examples

### Example 1: Concrete Walls Must Have Fire Rating

```xml
<specification name="Concrete Walls - FireRating Requirement" minOccurs="1">
  <applicability>
    <entity>
      <name><simpleValue>IFCWALL</simpleValue></name>
    </entity>
  </applicability>
  <requirements>
    <property dataType="IFCLABEL">
      <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>
      <baseName><simpleValue>FireRating</simpleValue></baseName>
      <value>
        <restriction>
          <enumeration value="30"/>
          <enumeration value="60"/>
          <enumeration value="90"/>
          <enumeration value="120"/>
        </restriction>
      </value>
    </property>
  </requirements>
</specification>
```

### Example 2: All Doors Must Have Mark

```xml
<specification name="Doors - Mark Required" minOccurs="0">
  <applicability>
    <entity>
      <name><simpleValue>IFCDOOR</simpleValue></name>
    </entity>
  </applicability>
  <requirements>
    <attribute>
      <name><simpleValue>Mark</simpleValue></name>
    </attribute>
  </requirements>
</specification>
```

## License

MIT — See [LICENSE](../../LICENSE) in the repository root.

## Links

- [buildingSMART IDS Specification](https://technical.buildingsmart.org/projects/information-delivery-specification-ids/)
- [IDS Test Cases & Examples](https://github.com/buildingsmart/IDS)
- [StreamBIM Documentation](https://support.rendra.io/)
- [Parent Repository](../../)

## Support

For issues, feature requests, or questions:
- Open an issue on the [GitHub repository](https://github.com/tikab-ab/0002-streambim-widget)
- Contact the widget developer
- For StreamBIM-specific questions, contact StreamBIM support@rendra.io
