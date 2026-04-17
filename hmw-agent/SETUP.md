# HMW Prefeasibility Agent — Setup Guide

## Estructura del proyecto
```
hmw-agent/
├── api/
│   └── analyze.js        ← Serverless function (Claude + Airtable)
├── public/
│   └── index.html        ← Frontend dashboard
├── vercel.json           ← Routing config
└── package.json
```

---

## 1. Campos que debes crear en Airtable

Abre tu tabla de HMWs y agrega estos campos con exactamente estos nombres:

| Nombre del campo         | Tipo en Airtable     |
|--------------------------|----------------------|
| `HMW`                    | Long text (ya existe)|
| `Análisis_Cualitativo`   | Long text            |
| `Market_Size_Score`      | Number (decimal)     |
| `Competencia_Score`      | Number (decimal)     |
| `Crecimiento_Score`      | Number (decimal)     |
| `Ocean_Recomendacion`    | Single line text     |
| `Score_Rationale`        | Long text            |
| `Fecha_Análisis`         | Date (ISO format)    |

---

## 2. Obtener credenciales

### Airtable API Key
1. Ve a https://airtable.com/create/tokens
2. Crea un Personal Access Token
3. Scopes necesarios: `data.records:read`, `data.records:write`
4. Agrega tu base específica en "Access"

### Airtable Base ID
- Abre tu base en el browser
- La URL es: `https://airtable.com/appXXXXXXXXXXXXXX/...`
- El Base ID es la parte `appXXXXXXXXXXXXXX`

### Anthropic API Key
- https://console.anthropic.com/settings/keys

---

## 3. Deploy en Vercel

```bash
# Instala Vercel CLI si no lo tienes
npm i -g vercel

# Desde la carpeta hmw-agent/
cd hmw-agent
vercel

# Sigue el wizard:
# - Set up and deploy? Yes
# - Which scope? (tu cuenta)
# - Link to existing project? No
# - Project name: hmw-agent-innovarise
# - Directory: ./
```

### Agregar environment variables en Vercel

En el dashboard de Vercel → tu proyecto → Settings → Environment Variables:

```
ANTHROPIC_API_KEY     = sk-ant-...
AIRTABLE_API_KEY      = pat...
AIRTABLE_BASE_ID      = app...
AIRTABLE_TABLE_NAME   = HMWs
```

Luego re-deploy:
```bash
vercel --prod
```

---

## 4. Usar la app

1. Abre la URL de Vercel
2. En el primer acceso, ingresa:
   - Tu Airtable API Key
   - Tu Airtable Base ID
   - El nombre exacto de tu tabla (ej: `HMWs`)
3. Verás todos los registros de la tabla
4. Haz click en **"Analizar →"** en cualquier fila
5. El agente tarda ~30-60 segundos (hace web search real)
6. Los resultados aparecen directamente en Airtable y en la tabla

---

## Notas importantes

- Las credenciales de Airtable se guardan en tu navegador (localStorage), nunca pasan por el servidor
- El análisis usa Claude con web search habilitado — busca datos reales de mercado
- Costo estimado por análisis: ~$0.05–0.15 USD (depende del tamaño de la respuesta)
- El campo `Ocean_Recomendacion` tiene 3 valores posibles: `BLUE OCEAN`, `RED OCEAN`, `PURPLE OCEAN`
