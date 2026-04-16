/**
 * IDS (Information Delivery Specification) XML Parser
 * Supports IDS 1.0 (http://standards.buildingsmart.org/IDS) and 0.9.x versions
 */

export interface IDSFacet {
  type: 'entity' | 'property' | 'attribute' | 'classification' | 'material' | 'partOf';
  entityName?: string;           // e.g. 'IFCWALL'
  psetName?: string;             // e.g. 'Pset_WallCommon'
  propertyName?: string;         // e.g. 'FireRating'
  value?: string | string[] | null;         // null = existence check only; string[] for enumerations
  dataType?: string;             // e.g. 'IFCLABEL'
  predefinedType?: string;       // e.g. for entity predefined type
}

export interface IDSSpecification {
  name: string;
  description?: string;
  minOccurs: number;
  maxOccurs: number | 'unbounded';
  applicability: IDSFacet[];
  requirements: IDSFacet[];
}

export interface IDSDocument {
  title: string;
  description?: string;
  author?: string;
  date?: string;
  specifications: IDSSpecification[];
}

/**
 * Parse an IDS XML string and extract specifications
 */
export function parseIDS(xmlString: string): IDSDocument {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  // Check for parsing errors
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Failed to parse IDS XML: Invalid XML format');
  }

  // Extract info section
  const infoEl = getFirstElement(doc.documentElement, 'info');
  const title = getTextContent(infoEl, 'title') || 'Unnamed IDS';
  const description = getTextContent(infoEl, 'description');
  const author = getTextContent(infoEl, 'author');
  const date = getTextContent(infoEl, 'date');

  // Extract specifications
  const specsEl = getFirstElement(doc.documentElement, 'specifications');
  const specElements = Array.from(specsEl?.children || []).filter(
    el => el.localName === 'specification'
  );

  const specifications = specElements.map(parseSpecification);

  return {
    title,
    description: description || undefined,
    author: author || undefined,
    date: date || undefined,
    specifications,
  };
}

function parseSpecification(el: Element): IDSSpecification {
  const name = el.getAttribute('name') || 'Unnamed Specification';
  const description = el.getAttribute('description') || undefined;
  const minOccurs = parseInt(el.getAttribute('minOccurs') || '0', 10);
  const maxOccursStr = el.getAttribute('maxOccurs') || 'unbounded';
  const maxOccurs = maxOccursStr === 'unbounded' ? 'unbounded' : parseInt(maxOccursStr, 10);

  const applicabilityEl = getFirstElement(el, 'applicability');
  const applicability = applicabilityEl ? parseFacets(applicabilityEl) : [];

  const requirementsEl = getFirstElement(el, 'requirements');
  const requirements = requirementsEl ? parseFacets(requirementsEl) : [];

  return {
    name,
    description,
    minOccurs,
    maxOccurs,
    applicability,
    requirements,
  };
}

function parseFacets(parentEl: Element): IDSFacet[] {
  const facets: IDSFacet[] = [];

  // Entity facets
  Array.from(parentEl.children).forEach(el => {
    if (el.localName === 'entity') {
      facets.push(parseEntityFacet(el));
    } else if (el.localName === 'property') {
      facets.push(parsePropertyFacet(el));
    } else if (el.localName === 'attribute') {
      facets.push(parseAttributeFacet(el));
    } else if (el.localName === 'classification') {
      facets.push(parseClassificationFacet(el));
    } else if (el.localName === 'material') {
      facets.push(parseMaterialFacet(el));
    } else if (el.localName === 'partOf') {
      facets.push(parsePartOfFacet(el));
    }
  });

  return facets;
}

function parseEntityFacet(el: Element): IDSFacet {
  const nameEl = getFirstElement(el, 'name');
  const entityName = getSimpleValue(nameEl);

  const predefinedTypeEl = getFirstElement(el, 'predefinedType');
  const predefinedType = getSimpleValue(predefinedTypeEl);

  return {
    type: 'entity',
    entityName: entityName ?? undefined,
    predefinedType: predefinedType ?? undefined,
  };
}

function parsePropertyFacet(el: Element): IDSFacet {
  const psetEl = getFirstElement(el, 'propertySet');
  const psetName = getSimpleValue(psetEl);

  const baseNameEl = getFirstElement(el, 'baseName');
  const propertyName = getSimpleValue(baseNameEl);

  const dataType = el.getAttribute('dataType');

  const valueEl = getFirstElement(el, 'value');
  const value = extractValue(valueEl);

  return {
    type: 'property',
    psetName: psetName ?? undefined,
    propertyName: propertyName ?? undefined,
    value,
    dataType: dataType ?? undefined,
  };
}

function parseAttributeFacet(el: Element): IDSFacet {
  const nameEl = getFirstElement(el, 'name');
  const propertyName = getSimpleValue(nameEl);

  const valueEl = getFirstElement(el, 'value');
  const value = extractValue(valueEl);

  return {
    type: 'attribute',
    propertyName: propertyName ?? undefined,
    value,
  };
}

function parseClassificationFacet(el: Element): IDSFacet {
  const systemEl = getFirstElement(el, 'system');
  const system = getSimpleValue(systemEl);

  const valueEl = getFirstElement(el, 'value');
  const value = extractValue(valueEl);

  return {
    type: 'classification',
    psetName: system ?? undefined, // Reuse psetName field for classification system
    value,
  };
}

function parseMaterialFacet(el: Element): IDSFacet {
  const valueEl = getFirstElement(el, 'value');
  const value = extractValue(valueEl);

  return {
    type: 'material',
    value,
  };
}

function parsePartOfFacet(el: Element): IDSFacet {
  const relationEl = getFirstElement(el, 'relation');
  const entityName = getSimpleValue(relationEl);

  return {
    type: 'partOf',
    entityName: entityName ?? undefined,
  };
}

/**
 * Extract a value from a value element
 * Handles simpleValue, xs:restriction with enumerations, xs:restriction with other constraints
 */
function extractValue(valueEl: Element | null): string | string[] | null {
  if (!valueEl) return null;

  // Check for simpleValue
  const simpleValueEl = getFirstElement(valueEl, 'simpleValue');
  if (simpleValueEl && simpleValueEl.textContent) {
    return simpleValueEl.textContent;
  }

  // Check for xs:restriction with enumerations
  const restrictionEl = getFirstElement(valueEl, 'restriction');
  if (restrictionEl) {
    const enumerations = Array.from(restrictionEl.children)
      .filter(el => el.localName === 'enumeration')
      .map(el => el.getAttribute('value'))
      .filter((v): v is string => v !== null);

    if (enumerations.length > 0) {
      return enumerations;
    }

    // For other restrictions (pattern, min/max), extract pattern or bounds as string
    const patternEl = getFirstElement(restrictionEl, 'pattern');
    if (patternEl) {
      return patternEl.getAttribute('value') || null;
    }

    const minEl = getFirstElement(restrictionEl, 'minInclusive');
    const maxEl = getFirstElement(restrictionEl, 'maxInclusive');
    if (minEl || maxEl) {
      const min = minEl?.getAttribute('value');
      const max = maxEl?.getAttribute('value');
      return `[${min || ''}..${max || ''}]`;
    }
  }

  return null;
}

/**
 * Helper: get first child element with a specific local name (namespace-agnostic)
 */
function getFirstElement(parent: Element | null, localName: string): Element | null {
  if (!parent) return null;
  return Array.from(parent.children).find(el => el.localName === localName) || null;
}

/**
 * Helper: get text content of first matching child element
 */
function getTextContent(parent: Element | null, localName: string): string | null {
  const el = getFirstElement(parent, localName);
  return el?.textContent || null;
}

/**
 * Helper: get simpleValue text content
 */
function getSimpleValue(parent: Element | null): string | null {
  const simpleValueEl = getFirstElement(parent, 'simpleValue');
  return simpleValueEl?.textContent || null;
}
