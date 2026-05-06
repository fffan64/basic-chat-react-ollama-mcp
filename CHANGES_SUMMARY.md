# MCP Refactoring - Cambios Rápidos

## 📝 Resumen: 3 Archivos Modificados

### 1. `src/types/index.ts`

**Qué cambió:** Tipos mejorados para el protocolo MCP

**Antes:**

```typescript
// Tipos genéricos sin estructura clara
interface MCPContext {
  tools?: Array<{name: string; description?: string; ...}>;
  resources?: Array<{uri: string; name?: string; ...}>;
}
```

**Después:**

```typescript
// Tipos específicos y bien definidos
interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

interface MCPToolResult {
  type: "text" | "image" | "resource" | "error";
  text?: string;
  data?: unknown;
  error?: string;
}
```

---

### 2. `src/services/MCPService.ts`

**Qué cambió:** Separación clara de responsabilidades y adición del execution logic

**Métodos Nuevos:**

```typescript
// ✅ NUEVO: Obtener herramientas (tools/list)
async listTools(): Promise<MCPTool[]>

// ✅ NUEVO: Ejecutar herramienta (tools/call) - CRÍTICO
async callTool(toolName: string, params: Record<string, unknown>): Promise<MCPToolResult>

// ✅ NUEVO: Parsear intención de LLM de usar herramientas
parseToolCall(content: string): {toolName: string; params: Record<string, unknown>} | null

// ✅ NUEVO: Obtener contexto en paralelo
async getContext(): Promise<{tools: MCPTool[]; resources: MCPResource[]}>
```

**Métodos Eliminados:**

```typescript
// ❌ VIEJO: queryContext() → Reemplazado por getContext()
// ❌ VIEJO: formatContextAsString() → Reemplazado por formatToolsForPrompt()
```

**Mejoras Internas:**

- Generación de IDs únicos para cada request JSON-RPC
- Mejor manejo de errores y logging
- Eliminación de dependencia en headers personalizados

---

### 3. `src/hooks/useChat.ts`

**Qué cambió:** Adición de la boucle d'exécution agentic

**Nueva Función - `executionLoop()`:**

```typescript
const executionLoop = async (
  systemPrompt: string,
  conversationHistory: OllamaMessage[],
  availableTools: string,
): Promise<string> => {
  // Loop que:
  // 1. Envía mensaje al LLM
  // 2. Detecta si LLM quiere usar una herramienta
  // 3. Ejecuta la herramienta en MCP server
  // 4. Reinyecta resultado
  // 5. Repite hasta que LLM termine (máx 5 iteraciones)
};
```

**Cambios en `sendMessage()`:**

```typescript
// ANTES: Inyección simple de context
const mcpContextString = await mcpService.queryContext(userText);

// DESPUÉS: Carga de herramientas + loop de ejecución
const { tools } = await mcpService.getContext();
const availableToolsString = mcpService.formatToolsForPrompt(tools);
const finalResponse = await executionLoop(
  systemPrompt,
  conversationHistory,
  availableToolsString,
);
```

---

## 🔄 Flujo Antes vs Después

### ❌ ANTES (No Funciona)

```
User: "Get my todos"
    ↓
LLM recibe: "Available tools: get_todos"
    ↓
LLM responde: "I see I have get_todos, I'll use it"
    ↓
(NADA PASA - La herramienta nunca se ejecuta)
```

### ✅ DESPUÉS (Funciona)

```
User: "Get my todos"
    ↓
getContext() → Carga herramientas de MCP
    ↓
LLM recibe: "Available tools: get_todos: [description]"
    ↓
LLM responde: {"tool": "get_todos", "params": {}}
    ↓
parseToolCall() detecta la intención
    ↓
callTool("get_todos", {}) → Ejecuta en MCP server
    ↓
Resultado se reinyecta
    ↓
LLM continúa: "Tienes 3 tareas: ..."
    ↓
parseToolCall() → null (no hay más herramientas)
    ↓
✓ Respuesta final enviada al usuario
```

---

## 📊 Comparación de Métodos

| Operación             | Antes                     | Después                          |
| --------------------- | ------------------------- | -------------------------------- |
| Obtener herramientas  | `queryContext()`          | `listTools()`                    |
| Ejecutar herramienta  | ❌ No existía             | `callTool()` + `parseToolCall()` |
| Obtener recursos      | `queryContext()`          | `listResources()`                |
| Formatear para prompt | `formatContextAsString()` | `formatToolsForPrompt()`         |
| Manejo de sesión      | Headers personalizados    | JSON-RPC con IDs                 |

---

## ✅ Checklist para Usar

- [ ] El MCP server devuelve la lista de herramientas en `tools/list`
- [ ] El MCP server ejecuta herramientas en `tools/call`
- [ ] El system prompt de Qwen instruye usar formato: `{"tool": "name", "params": {}}`
- [ ] Probar con una herramienta simple primero (ej: `get_todos`)
- [ ] Verificar logs: "✓ Loaded X tools from MCP"
- [ ] Verificar logs: "🔧 Executing tool: ..."

---

## 🐛 Debugging

Si algo no funciona, revisa en orden:

1. **¿Aparece "✓ Loaded N tools from MCP"?**
   - Si no → El servidor MCP no devuelve herramientas en `tools/list`

2. **¿Aparece "🔧 Executing tool:"?**
   - Si no → El LLM no está usando el formato correcto
   - Revisa el system prompt, debe tener instrucciones claras

3. **¿Aparece el resultado en la consola?**
   - Si hay error → El MCP server tiene problemas al ejecutar `tools/call`

4. **¿Loop infinito o timeout?**
   - Máximo 5 iteraciones por seguridad
   - Revisa que `parseToolCall()` funcione correctamente
