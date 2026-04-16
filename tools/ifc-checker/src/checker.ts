import { IDSSpecification, IDSFacet } from './ids-parser';

export interface ObjectResult {
  guid: string;
  name: string;
  passed: boolean;
  failedRequirements: string[];
}

export interface SpecificationResult {
  specification: IDSSpecification;
  applicableCount: number;
  passedCount: number;
  failedCount: number;
  failedObjects: ObjectResult[];
  passedObjects: ObjectResult[];
  status: 'pass' | 'fail' | 'not_applicable' | 'error';
  errorMessage?: string;
}

// StreamBIM search query format (nested arrays: outer = OR, inner = AND)
interface SearchRule {
  psetName?: string;
  propKey?: string;
  propValue?: string;
  operator?: string;
}

interface SearchQuery {
  filter: { rules: SearchRule[][] };
  page: { limit: number; skip: number };
}

export async function checkSpecification(
  spec: IDSSpecification,
  streamBIM: any
): Promise<SpecificationResult> {
  const query = buildSearchQuery(spec.applicability);

  if (!query) {
    return makeResult(spec, 'not_applicable', 'No applicability facets defined');
  }

  let applicableObjects: any[] = [];
  try {
    const raw = await streamBIM.getObjectInfoForSearch(query);
    applicableObjects = Array.isArray(raw) ? raw : [];
  } catch (err) {
    return makeResult(spec, 'error', `Query failed: ${(err as Error).message}`);
  }

  if (applicableObjects.length === 0) {
    return { ...makeResult(spec, 'pass'), applicableCount: 0 };
  }

  const failedObjects: ObjectResult[] = [];
  const passedObjects: ObjectResult[] = [];

  for (const obj of applicableObjects) {
    const failures = checkRequirements(spec.requirements, obj);
    const result: ObjectResult = {
      guid: obj.guid,
      name: obj.name || 'Unnamed',
      passed: failures.length === 0,
      failedRequirements: failures,
    };
    (result.passed ? passedObjects : failedObjects).push(result);
  }

  return {
    specification: spec,
    applicableCount: applicableObjects.length,
    passedCount: passedObjects.length,
    failedCount: failedObjects.length,
    failedObjects,
    passedObjects,
    status: failedObjects.length === 0 ? 'pass' : 'fail',
  };
}

function makeResult(
  spec: IDSSpecification,
  status: SpecificationResult['status'],
  errorMessage?: string
): SpecificationResult {
  return {
    specification: spec,
    applicableCount: 0,
    passedCount: 0,
    failedCount: 0,
    failedObjects: [],
    passedObjects: [],
    status,
    errorMessage,
  };
}

function buildSearchQuery(facets: IDSFacet[]): SearchQuery | null {
  const rules: SearchRule[] = [];

  for (const facet of facets) {
    switch (facet.type) {
      case 'entity':
        if (facet.entityName) {
          rules.push({
            psetName: 'Ifc2x3~Object',
            propKey: 'ifcclass',
            propValue: facet.entityName,
          });
        }
        break;

      case 'property':
        if (facet.psetName && facet.propertyName) {
          const rule: SearchRule = { psetName: facet.psetName, propKey: facet.propertyName };
          if (facet.value && !Array.isArray(facet.value)) rule.propValue = facet.value;
          rules.push(rule);
        }
        break;

      case 'attribute':
        if (facet.propertyName) {
          const rule: SearchRule = { psetName: 'Ifc2x3~Object', propKey: facet.propertyName };
          if (facet.value && !Array.isArray(facet.value)) rule.propValue = String(facet.value);
          rules.push(rule);
        }
        break;

      case 'material':
        if (facet.value && !Array.isArray(facet.value)) {
          rules.push({ psetName: 'Ifc2x3~Object', propKey: 'Material', propValue: facet.value });
        }
        break;

      default:
        break;
    }
  }

  if (rules.length === 0) return null;

  // Wrap in outer array (AND group) — StreamBIM uses [[...]] for a single AND clause
  return {
    filter: { rules: [rules] },
    page: { limit: 10000, skip: 0 },
  };
}

function checkRequirements(requirements: IDSFacet[], obj: any): string[] {
  const props: Record<string, string> = obj.ifcProperties || obj.properties || {};
  return requirements.flatMap(req => {
    const failure = checkFacet(req, obj, props);
    return failure ? [failure] : [];
  });
}

function checkFacet(facet: IDSFacet, obj: any, props: Record<string, string>): string | null {
  switch (facet.type) {
    case 'entity':
      return null; // Already filtered by applicability query

    case 'property': {
      if (!facet.psetName || !facet.propertyName) return null;
      const value = findPropValue(props, [
        `${facet.psetName}~${facet.propertyName}`,
        `${facet.psetName}.${facet.propertyName}`,
        facet.propertyName,
      ]);
      if (value === undefined) {
        return `Missing property '${facet.propertyName}' in '${facet.psetName}'`;
      }
      return checkValue(facet.propertyName, value, facet.value);
    }

    case 'attribute': {
      if (!facet.propertyName) return null;
      const direct = obj[facet.propertyName] !== undefined ? String(obj[facet.propertyName]) : undefined;
      const value = direct ?? findPropValue(props, [
        `Ifc2x3~Object~${facet.propertyName}`,
        facet.propertyName,
      ]);
      if (value === undefined) return `Missing attribute '${facet.propertyName}'`;
      return checkValue(facet.propertyName, value, facet.value);
    }

    case 'material': {
      const value = findPropValue(props, ['Material', 'Ifc2x3~Object~Material']);
      if (value === undefined) return 'No material assigned';
      return checkValue('Material', value, facet.value);
    }

    case 'classification':
    case 'partOf':
      return null; // Not yet implemented — skip rather than false-fail

    default:
      return null;
  }
}

function findPropValue(
  props: Record<string, string>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    if (props[key] !== undefined && props[key] !== '') return props[key];
  }
  return undefined;
}

function checkValue(
  label: string,
  actual: string,
  expected: string | string[] | null | undefined
): string | null {
  if (!expected) return null; // existence check only — value is present, so pass

  if (Array.isArray(expected)) {
    return expected.includes(actual)
      ? null
      : `'${label}' = '${actual}', expected one of: ${expected.join(', ')}`;
  }

  // Numeric range [min..max] — basic existence pass for now
  if (/^\[.*\.\.\.*\]$/.test(expected)) return null;

  return actual === expected
    ? null
    : `'${label}' = '${actual}', expected '${expected}'`;
}
