# MCP (Model Context Protocol) - Guía Técnica

## 🎯 ¿Qué se cambió?

Tu servicio MCP anterior tenía 3 errores críticos que impedían que funcionara con servidores MCP reales. Se ha reescrito completamente para seguir correctamente el protocolo JSON-RPC 2.0.

---

## 1️⃣ **Error 1: Confusión entre Resources y Tools**

### ❌ Problema Anterior

```typescript
// INCORRECTO
method: "resources/list"; // Solo devuelve archivos/datos, no herramientas
```

### ✅ Solución

```typescript
// CORRECTO - Ahora hay dos métodos distintos:

// Para obtener herramientas EJECUTABLES
async listTools(): Promise<MCPTool[]>
→ Llama a: method: "tools/list"

// Para obtener recursos ESTÁTICOS (archivos, datos)
async listResources(): Promise<MCPResource[]>
→ Llama a: method: "resources/list"
```

**Diferencia crítica:**

- **Tools**: Funciones que el LLM puede EJECUTAR (get_todos, create_task, etc.)
- **Resources**: Datos que el LLM puede LEER (archivos, base de datos, etc.)

---

## 2️⃣ **Error 2: Flujo de Inicialización**

### ❌ Problema Anterior

```typescript
// Esperaba que el servidor devolviera un Mcp-Session-Id en headers
this.sessionId = response.headers.get("Mcp-Session-Id") || undefined;
```

### ✅ Solución

- El protocolo JSON-RPC 2.0 es stateless
- Cada solicitud tiene un ID único generado por el cliente
- Se eliminó la dependencia de headers personalizados

```typescript
private generateRequestId(): string {
  return `req-${++this.requestId}-${Date.now()}`;
}

// Cada request incluye esto:
{
  jsonrpc: "2.0",
  id: "req-1-1715000000000",  // ID único
  method: "tools/list",
  params: {}
}
```

---

## 3️⃣ **Error 3: Ausencia de Execution Loop (El problema más crítico)**

### ❌ Problema Anterior

El servicio solo **inyectaba** la lista de herramientas en el prompt:

```
LLM ve: "Tienes estas herramientas: get_todos, create_task"
LLM responde: "Voy a usar get_todos"
Resultado: ✗ NADA PASA - La herramienta nunca se ejecuta
```

### ✅ Solución: Agentic Execution Loop

Se agregó la función `executionLoop()` en `useChat.ts` que implementa el patrón agentic correcto:

```
┌─────────────────────────────────────────────────────┐
│  EXECUTION LOOP                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. LLM recibe tools en system prompt               │
│  2. LLM procesa y responde                          │
│       ↓                                             │
│  3. parseToolCall() detecta intención               │
│       ├─ Si NO hay tool call → Retorna respuesta   │
│       └─ Si hay tool call → Continúa               │
│       ↓                                             │
│  4. callTool() ejecuta en MCP server                │
│       ↓                                             │
│  5. Resultado se reinyecta en contexto              │
│       ↓                                             │
│  6. Volver a paso 2 (máx 5 iteraciones)            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Ejemplo de flujo real:**

```
Usuario: "¿Qué tareas tengo?"

ITERATION 1:
  LLM: "Voy a recuperar tus tareas. {"tool": "get_todos", "params": {}}"
  ↓
  callTool("get_todos", {}) → MCP Server
  ↓
  Resultado: [{id: 1, title: "Buy milk"}, ...]
  ↓

ITERATION 2:
  LLM: "Tienes 2 tareas: Buy milk, Study React"
  parseToolCall() → null (no hay más herramientas)
  ↓
  ✓ Retorna respuesta final
```

---

## 📋 Nuevos Métodos del MCPService

### `async listTools(): Promise<MCPTool[]>`

Obtiene la lista de herramientas disponibles del servidor MCP.

```typescript
const tools = await mcpService.listTools();
// Devuelve: [{name: "get_todos", description: "...", inputSchema: {...}}]
```

### `async callTool(toolName: string, params: object): Promise<MCPToolResult>`

**CRÍTICO:** Ejecuta una herramienta en el servidor MCP.

```typescript
const result = await mcpService.callTool("get_todos", {});
// Devuelve: {type: "text", text: "...", data: {...}}
```

### `parseToolCall(content: string): {toolName, params} | null`

Detecta si el LLM intentó usar una herramienta en su respuesta.

```typescript
const response = 'Voy a usar esto: {"tool": "get_todos", "params": {}}';
const call = mcpService.parseToolCall(response);
// Devuelve: {toolName: "get_todos", params: {}}
```

### `formatToolsForPrompt(tools: MCPTool[]): string`

Formatea la lista de herramientas para inyectar en el prompt del sistema.

```typescript
const prompt = mcpService.formatToolsForPrompt(tools);
// Devuelve: "[Available MCP Tools]\n- get_todos: ...\n- create_task: ..."
```

---

## 🔧 Cómo Configurar tu LLM

En tu **System Prompt**, debes instruir a Qwen cómo usar las herramientas:

```
Tienes acceso a herramientas externas. Cuando necesites usarlas,
responde con un bloque JSON indicando cuál herramienta usar:

{"tool": "nombre_herramienta", "params": {"param1": "valor1"}}

Después de usar la herramienta, continuaré con el resultado y
podrás dar una respuesta final.
```

---

## 🧪 Testing

Para verificar que todo funciona:

1. **Verifica que se cargan las herramientas:**

   ```
   En la consola deberías ver: "✓ Loaded 3 tools from MCP"
   ```

2. **Verifica la ejecución:**

   ```
   En la consola: "🔧 Executing tool: get_todos with params: {}"
   Luego: "↻ Tool executed, continuing conversation..."
   ```

3. **Verifica la respuesta final:**
   ```
   En la consola: "✓ Conversation complete"
   ```

---

## 📊 Diagrama de Arquitectura

```
React Component (ChatInterface)
    ↓
useChat Hook
    ├─→ MCPService.initialize()
    ├─→ MCPService.getContext() {tools, resources}
    ├─→ MCPService.formatToolsForPrompt()
    │
    └─→ executionLoop()
            ├─→ OllamaService.streamChat()
            ├─→ MCPService.parseToolCall()
            ├─→ MCPService.callTool() ← CRITICAL PART
            └─→ [Repeat until no more tool calls]

MCP Server (tu backend)
    ├─ tools/list → Devuelve disponibles
    ├─ tools/call → Ejecuta herramienta
    └─ resources/list → Devuelve recursos
```

---

## ⚠️ Notas Importantes

1. **JSON-RPC es stateless**: No hay sesiones persistentes, cada request es independiente
2. **Timeout de herramientas**: El límite es 5 iteraciones para evitar bucles infinitos
3. **Formato de tool call**: El parser espera exactamente: `{"tool": "name", "params": {}}`
4. **Errores**: Si un tool call falla, el resultado se reinyecta y el LLM puede manejo el error

---

## 🚀 Próximos Pasos

1. Asegúrate que tu servidor MCP devuelva la lista correcta de herramientas
2. Verifica que `tools/call` devuelva resultados en formato JSON válido
3. Ajusta el `System Prompt` en `public/system-prompt.txt` para instruir bien a Qwen
4. Prueba con herramientas simples primero (ej: `get_todos`)
