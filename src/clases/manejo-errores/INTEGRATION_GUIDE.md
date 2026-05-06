# Integración de ManejoErrores en Jison

## Resumen
La clase `ManejoErrores` captura errores **léxicos**, **sintácticos** y **semánticos** desde los parsers Jison. Todos los errores se centralizan y se muestran en la UI del componente.

## Flujo de integración

### 1. **Inicialización en el servicio de compilación** (`codigo-compilado.service.ts`)

```typescript
import { ManejoErrores } from '../../clases/manejo-errores/errores.js';

async ejecutar(arbol: NodoArchivo[]): Promise<'console' | 'errors'> {
  const manejador = new ManejoErrores();
  manejador.reset(); // Limpiar errores previos
  
  // Antes de parsear, inicializar cada parser con el manejador
  this.inicializarParserConManejador(parserStyle, manejador);
  this.inicializarParserConManejador(parserComponent, manejador);
  // ... etc para otros parsers
  
  // Parsear archivos...
  
  // Recolectar errores capturados
  const errores = manejador.getErrores();
  // → Se añaden a this.errores[] para mostrar en la UI
}
```

### 2. **En archivos Jison (.jison y .jisonlex)**

Ya están configurados para usar `yy.manejador.errorXxx()` en sus acciones.

#### **Errores Léxicos** (en `.jisonlex`)

```jison
%lex
%%

[a-zA-Z_][a-zA-Z0-9_-]*  {
  // si no es una palabra reservada válida:
  if (!isValidProperty(yytext)) {
    yy.manejador.errorPropiedadDesconocida(yytext, yylloc.first_line, yylloc.first_column);
  }
  return 'IDENTIFICADOR';
}

// catch-all para caracteres no reconocidos
.   { 
  yy.manejador.errorLexico(yytext, yylloc.first_line, yylloc.first_column);
}

/lex
```

#### **Errores Sintácticos** (sobrescrito automáticamente en el servicio)

El servicio ahora sobreescribe `parser.parseError()` para capturar automáticamente cualquier error de análisis sintáctico:

```typescript
parser.parser.parseError = function(str: any, hash: any) {
  const line = (hash && hash.loc && hash.loc.first_line) || 0;
  const col = (hash && hash.loc && hash.loc.first_column) || 0;
  const token = (hash && hash.token) || '';
  manejador.errorSintactico(token, line, col, String(str));
};
```

#### **Errores Semánticos** (en acciones de la gramática)

Si necesitas validar semántica dentro de una producción Jison, usa `yy.manejador.errorXxx()`:

```jison
%%

definicion_clase
  : IDENTIFICADOR EXTENDS IDENTIFICADOR LLAVE_A lista_declaraciones LLAVE_C
    {
      // Validación semántica: el padre debe estar definido
      if (!estiloDefinido($3)) {
        yy.manejador.errorEstiloNoDefinido($3, @3.first_line, @3.first_column);
      }
      $$ = { tipo: 'clase', nombre: $1, propiedades: $5, extiende: $3 };
    }
  ;
```

### 3. **Métodos disponibles en `ManejoErrores`**

#### **Para .styles:**
- `errorPropiedadDesconocida(prop, linea, col)`
- `errorColorInvalido(color, linea, col)`
- `errorUnidadInvalida(unidad, linea, col)`
- `errorEstiloSinLlave(nombre, linea, col)`
- `errorForStyleSintaxis(linea, col)`
- `errorEstiloNoDefinido(nombre, linea, col)`
- Y más...

#### **Para .comp:**
- `errorComponenteSinParentesis(nombre, linea, col)`
- `errorSeccionSinCierre(linea, col)`
- `errorComponenteDuplicado(nombre, linea, col)`
- `errorVariableNoDeclaradaComp(variable, linea, col)`
- Y más...

#### **Para .y (lenguaje principal):**
- `errorImportMalFormado(ruta, linea, col)`
- `errorImportSinPuntoComa(linea, col)`
- `errorVariableNoDeclarada(nombre, linea, col)`
- `errorVariableYaDeclarada(nombre, linea, col)`
- `errorFuncionNoDeclarada(nombre, linea, col)`
- Y más...

#### **Para .dba:**
- `errorTablaCreacionSintaxis(linea, col)`
- `errorTablaNoExiste(nombre, linea, col)`
- `errorColumnaNoExiste(columna, tabla, linea, col)`
- Y más...

### 4. **Recuperación de errores en la UI**

Los errores se recolectan automáticamente en `codigo-compilado.service.ts`:

```typescript
// Después de parsear todo
const erroresManejoErrores = manejador.getErrores();
for (const err of erroresManejoErrores) {
  this.errores.push({
    lexema: err.lexema,
    linea: err.line,
    columna: err.column,
    tipo: err.type,
    descripcion: err.description
  });
}
```

El componente `page-principal.ts` mostrará estos errores en la pestaña de "errors" (si se propaga correctamente).

## Ejemplo de flujo completo

### Entrada (usuario escribe código):
```styles
// archivo: main.styles
.btn extends .noExiste {
  color = #FF0000;
}
```

### Procesamiento:
1. `codigo-compilado.service.ts` crea `new ManejoErrores()` e inicializa parsers.
2. El lexer de `.styles` detecta tokens válidos.
3. El parser detecta la regla `definicion_clase` con `extends .noExiste`.
4. En la acción, se valida que `.noExiste` esté definido → NO → se llama:
   ```typescript
   yy.manejador.errorEstiloNoDefinido('noExiste', linea, columna);
   ```
5. El error se añade a `manejador.getErrores()`.
6. En `codigo-compilado.service.ts`, se recolecta y se añade a `this.errores[]`.
7. El componente muestra los errores en la UI (pestaña "errors").

## Tips de implementación

1. **Siempre resetea antes de parsear:**
   ```typescript
   const manejador = new ManejoErrores();
   manejador.reset();
   ```

2. **Asegúrate de que el lexer tenga locations habilitadas** (`%locations` en .jison):
   ```jison
   %locations
   ```
   Esto permite acceder a `yylloc.first_line`, `yylloc.first_column`, etc.

3. **Para errores semánticos detectados fuera del parser**, pasa la instancia de `manejador`:
   ```typescript
   // En tu intérprete/traductor
   if (!variableDeclarada(nombre)) {
     manejador.errorVariableNoDeclarada(nombre, linea, col);
   }
   ```

4. **Si necesitas pasar el manejador a otros servicios**, inyectalo:
   ```typescript
   constructor(private manejador: ManejoErrores) {}
   ```

## Arquitectura de errores en Token

```typescript
export class Token {
  lexema!: string;        // texto del token o error
  line!: number;          // número de línea (1-indexed)
  column!: number;        // número de columna (0 o 1-indexed)
  description!: string;   // mensaje descriptivo del error
  type!: string;          // 'Léxico' | 'Sintáctico' | 'Semántico'
}
```

## Prueba rápida

Para verificar que todo funciona:

1. Abre la UI del compilador.
2. Crea un archivo `.styles` con un error (ej: propiedad desconocida).
3. Haz clic en "Ejecutar".
4. Los errores deben aparecer en la pestaña "Errores" con la línea y descripción.
