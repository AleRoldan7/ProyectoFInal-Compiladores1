%lex
%%

\s+                                 /* ignorar */
"/*"[\s\S]*?"*/"                    /* comentarios */

"TABLE"         return 'TABLE';
"COLUMNS"       return 'COLUMNS';
"DELETE"        return 'DELETE';
"IN"            return 'IN';

\"[^\"]*\"      return 'STRING_LIT';
[0-9]+\.[0-9]+  return 'DECIMAL';
[0-9]+          return 'ENTERO';

"["             return 'CORCH_A';
"]"             return 'CORCH_C';
"."             return 'PUNTO';
","             return 'COMA';
"="             return 'IGUAL';
";"             return 'PUNTO_COMA';

[a-zA-Z][a-zA-Z0-9_]*  return 'IDENTIFICADOR';

<<EOF>>     return 'EOF';
. { yy.manejador.errorLexico(yytext, yylloc.first_line, yylloc.first_column+1); }

/lex

%start inicio
%%

inicio
    : lista_sentencias EOF  { return $1; }
    ;

lista_sentencias
    : lista_sentencias sentencia  { $$ = $1; $$.push($2); }
    | sentencia                   { $$ = [$1]; }
    ;

sentencia
    : crear_tabla
    | seleccionar
    | insertar
    | actualizar
    | eliminar
    ;

crear_tabla
    : TABLE IDENTIFICADOR COLUMNS lista_columnas PUNTO_COMA
        { $$ = { tipo:'create', tabla:$2, columnas:$4 }; }
    ;

lista_columnas
    : lista_columnas COMA columna_def  { $$ = $1; $$.push($3); }
    | columna_def                      { $$ = [$1]; }
    ;

columna_def
    : IDENTIFICADOR IGUAL tipo_columna
        { $$ = { nombre:$1, tipo:$3 }; }
    ;

/* AHORA ACEPTA TODOS LOS TIPOS */
tipo_columna
    : IDENTIFICADOR  { $$ = $1; }
    ;

seleccionar
    : IDENTIFICADOR PUNTO IDENTIFICADOR PUNTO_COMA
        { $$ = { tipo:'select', tabla:$1, columna:$3 }; }
    ;

/* INSERTAR — ahora con PUNTO_COMA al final */
insertar
    : IDENTIFICADOR CORCH_A lista_asignaciones_db CORCH_C PUNTO_COMA
        { $$ = { tipo:'insert', tabla:$1, valores:$3 }; }
    ;

actualizar
    : IDENTIFICADOR CORCH_A lista_asignaciones_db CORCH_C IN valor_id PUNTO_COMA
        { $$ = { tipo:'update', tabla:$1, valores:$3, id:$6 }; }
    ;

eliminar
    : IDENTIFICADOR DELETE valor_id PUNTO_COMA
        { $$ = { tipo:'delete', tabla:$1, id:$3 }; }
    ;

lista_asignaciones_db
    : lista_asignaciones_db COMA asignacion_db  { $$ = $1; $$.push($3); }
    | asignacion_db                             { $$ = [$1]; }
    ;

asignacion_db
    : IDENTIFICADOR IGUAL STRING_LIT  { $$ = { col:$1, val:$3.replace(/"/g,'') }; }
    | IDENTIFICADOR IGUAL DECIMAL     { $$ = { col:$1, val:parseFloat($3) }; }
    | IDENTIFICADOR IGUAL ENTERO      { $$ = { col:$1, val:parseInt($3) }; }
    | IDENTIFICADOR IGUAL IDENTIFICADOR { $$ = { col:$1, val:$3 }; }
    ;

valor_id
    : ENTERO    { $$ = parseInt($1); }
    | DECIMAL   { $$ = parseFloat($1); }
    ;