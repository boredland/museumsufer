export interface WebMcpToolDef {
  name: string;
  description: string;
  inputSchema: object;
  /** JS body executed in the browser. Receives `input` and `client` args.
   *  May return a value or Promise. */
  executeBody: string;
}

/** Self-contained JS snippet that registers the given tools with
 *  navigator.modelContext. Supports both the older provideContext shape
 *  (which isitagentready.com's scanner detects) and the spec-current
 *  registerTool form for forward compatibility. */
export function buildWebMcpScript(tools: WebMcpToolDef[]): string {
  const toolsLiteral = tools
    .map(
      (t) => `{
    name: ${JSON.stringify(t.name)},
    description: ${JSON.stringify(t.description)},
    inputSchema: ${JSON.stringify(t.inputSchema)},
    execute: function(input, client) { ${t.executeBody} }
  }`,
    )
    .join(",\n  ");
  return `if (navigator.modelContext) {
  var __webmcpTools = [${toolsLiteral}];
  if (typeof navigator.modelContext.provideContext === 'function') {
    navigator.modelContext.provideContext({ tools: __webmcpTools });
  } else if (typeof navigator.modelContext.registerTool === 'function') {
    __webmcpTools.forEach(function(t) { navigator.modelContext.registerTool(t); });
  }
}`;
}
