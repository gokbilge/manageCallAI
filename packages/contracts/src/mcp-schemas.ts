/**
 * JSON Schema objects derived from Zod schemas for use in MCP tool definitions.
 *
 * Importing from this module rather than hand-writing JSON Schema in the MCP
 * tools package ensures that schema changes in contracts are automatically
 * reflected in the MCP tool inputSchemas. The CI drift check
 * (scripts/check-mcp-contracts.mjs) validates this alignment on every PR.
 */
import { zodToJsonSchema } from 'zod-to-json-schema';
import { SimulationScenarioSchema } from './schemas/ivr-flows.js';

function toMcpSchema(schema: Parameters<typeof zodToJsonSchema>[0]): Record<string, unknown> {
  const full = zodToJsonSchema(schema, { target: 'jsonSchema7' }) as Record<string, unknown>;
  // Strip the top-level $schema annotation — MCP doesn't use it.
  const result = { ...full };
  delete result['$schema'];
  return result;
}

export const SimulationScenarioMcpSchema = toMcpSchema(SimulationScenarioSchema);
