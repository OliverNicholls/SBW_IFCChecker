import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wwneeohhoavtrpmwfsgj.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3bmVlb2hob2F2dHJwbXdmc2dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTEzMDgsImV4cCI6MjA5Mjk4NzMwOH0.MVtLWQQCVNHJAtewYCP3udHUc5TWJG00tTBCeCZDU3Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface ValidationCheck {
  ids_file: string | null;
  requirement_ref: string | null;
  spec_name: string | null;
  requirement_type: string | null;
  property_set: string | null;
  property_name: string | null;
  expected_value: string | null;
  actual_value: string | null;
  result: string | null;
  reason: string | null;
}

export interface ValidationElement {
  global_id: string;
  entity_type: string | null;
  entity_name: string | null;
  checks: ValidationCheck[];
}

export interface ValidationData {
  ifc_file: string;
  generated_at: string;
  summary: {
    total_elements: number;
    elements_with_failures: number;
    total_checks: number;
    total_failures: number;
  };
  elements: ValidationElement[];
}

async function fetchFromSupabase(): Promise<ValidationData> {
  console.log('Fetching from Supabase...');
  const { data, error } = await supabase
    .from('validation_results')
    .select('*')
    .order('ifc_file', { ascending: false })
    .order('global_id', { ascending: true });

  if (error) {
    throw new Error(`Supabase fetch error: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return {
      ifc_file: 'No data',
      generated_at: new Date().toISOString(),
      summary: { total_elements: 0, elements_with_failures: 0, total_checks: 0, total_failures: 0 },
      elements: [],
    };
  }

  // Transform flat rows into nested structure
  const elementsMap = new Map<string, ValidationElement>();
  let totalChecks = 0;
  let totalFailures = 0;

  data.forEach((row: any) => {
    const guid = row.global_id;

    if (!elementsMap.has(guid)) {
      elementsMap.set(guid, {
        global_id: guid,
        entity_type: row.entity_type,
        entity_name: row.entity_name,
        checks: [],
      });
    }

    const check: ValidationCheck = {
      ids_file: row.ids_file,
      requirement_ref: row.requirement_ref,
      spec_name: row.spec_name,
      requirement_type: row.requirement_type,
      property_set: row.property_set,
      property_name: row.property_name,
      expected_value: row.expected_value,
      actual_value: row.actual_value,
      result: row.result,
      reason: row.reason,
    };

    elementsMap.get(guid)!.checks.push(check);
    totalChecks++;

    if (row.result?.toUpperCase() === 'FAIL') {
      totalFailures++;
    }
  });

  const elements = Array.from(elementsMap.values());
  const elementsWithFailures = elements.filter((el) =>
    el.checks.some((c) => c.result?.toUpperCase() === 'FAIL')
  ).length;

  const ifc_file = data[0]?.ifc_file || 'From Database';
  const generated_at = data[0]?.created_at || new Date().toISOString();

  return {
    ifc_file,
    generated_at,
    summary: {
      total_elements: elements.length,
      elements_with_failures: elementsWithFailures,
      total_checks: totalChecks,
      total_failures: totalFailures,
    },
    elements,
  };
}

async function fetchFromJSON(file: File): Promise<ValidationData> {
  console.log('Loading from JSON file...');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);

        if (!Array.isArray(json.elements)) {
          throw new Error('Invalid JSON: missing "elements" array');
        }

        resolve({
          ifc_file: json.ifc_file || file.name,
          generated_at: json.generated_at || new Date().toISOString(),
          summary: json.summary || {
            total_elements: json.elements.length,
            elements_with_failures: 0,
            total_checks: 0,
            total_failures: 0,
          },
          elements: json.elements,
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export const DataService = {
  fetchFromSupabase,
  fetchFromJSON,
};
