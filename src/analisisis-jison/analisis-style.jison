%lex
%%

\s+                             /* ignorar */
"/*"[\s\S]*?"*/"                    /* comentario bloque */

/* PALABRAS RESERVADAS — las de varias palabras PRIMERO */
"background color"              return 'BACKGROUND_COLOR';
"text align"                    return 'TEXT_ALIGN';
"text size"                     return 'TEXT_SIZE';
"text font"                     return 'TEXT_FONT';
"padding left"                  return 'PADDING_LEFT';
"padding right"                 return 'PADDING_RIGHT';
"padding top"                   return 'PADDING_TOP';
"padding bottom"                return 'PADDING_BOTTOM';
"padding"                       return 'PADDING';
"margin left"                   return 'MARGIN_LEFT';
"margin top"                    return 'MARGIN_TOP';
"margin right"                  return 'MARGIN_RIGHT';
"margin bottom"                 return 'MARGIN_BOTTOM';
"margin"                        return 'MARGIN';
"min-height"                    return 'MIN_HEIGHT';
"max-height"                    return 'MAX_HEIGHT';
"min-width"                     return 'MIN_WIDTH';
"max-width"                     return 'MAX_WIDTH';
"height"                        return 'HEIGHT';
"width"                         return 'WIDTH';
"border top style"              return 'BORDER_TOP_STYLE';
"border top"                    return 'BORDER_TOP';
"border bottom style"           return 'BORDER_BOTTOM_STYLE';
"border bottom"                 return 'BORDER_BOTTOM';
"border left style"             return 'BORDER_LEFT_STYLE';
"border left"                   return 'BORDER_LEFT';
"border right style"            return 'BORDER_RIGHT_STYLE';
"border right"                  return 'BORDER_RIGHT';
"border radius"                 return 'BORDER_RADIUS';
"border style"                  return 'BORDER_STYLE';
"border width"                  return 'BORDER_WIDTH';
"border color"                  return 'BORDER_COLOR';
"border"                        return 'BORDER';
"color"                         return 'COLOR';
"extends"                       return 'EXTENDS';
"@for"                          return 'FOR';
"from"                          return 'FROM';
"through"                       return 'THROUGH';
"to"                            return 'TO';
"lightgray"                     return 'LIGHTGRAY';
"DOTTED"                        return 'DOTTED';
"LINE"                          return 'LINE';
"DOUBLE"                        return 'DOUBLE';
"solid"                         return 'SOLID';
"CENTER"                        return 'CENTER';
"RIGHT"                         return 'RIGHT';
"LEFT"                          return 'LEFT';
"HELVETICA"                     return 'HELVETICA';
"SANS SERIF"                    return 'SANS_SERIF';
"SANS"                          return 'SANS';
"MONO"                          return 'MONO';
"CURSIVE"                       return 'CURSIVE';

/* LITERALES */
[0-9]+\.[0-9]+"px"              return 'PIXEL';
[0-9]+"px"                      return 'PIXEL';
"#"[0-9a-fA-F]{3,8}            return 'COLOR_VALUE';
[0-9]+\.[0-9]+"%"               return 'PORCENTAJE';
[0-9]+"%"                       return 'PORCENTAJE';
[0-9]+\.[0-9]+                  return 'DECIMAL';
[0-9]+                          return 'ENTERO';
"$"[a-zA-Z][a-zA-Z0-9_]*       return 'CONTADOR';

/* SIMBOLOS */
"+"                             return 'MAS';
"-"                             return 'MENOS';
"*"                             return 'MULT';
"/"                             return 'DIV';
"{"                             return 'LLAVE_A';
"}"                             return 'LLAVE_C';
";"                             return 'PUNTO_COMA';
"="                             return 'IGUAL';

[a-zA-Z][a-zA-Z0-9_\-]*        return 'IDENTIFICADOR';

<<EOF>>                         return 'EOF';
.   { 
        yy.manejador.errorLexico
        (
                yytext, 
                yylloc.first_line, 
                yylloc.first_column + 1
        ); 
    }

/lex

%left MAS MENOS
%left MULT DIV
%right UMENOS

%start inicio
%%

inicio
    : lista_estilos EOF   
    { 
        return $1; 
    }
    ;

lista_estilos
    : lista_estilos estilo_o_for  
    { 
        $$ = $1; $$.push($2); 
    }
    | estilo_o_for                
    { 
        $$ = [$1]; 
    }
    ;

estilo_o_for
    : definicion_clase
    | bucle_for
    ;

definicion_clase
    : IDENTIFICADOR LLAVE_A lista_declaraciones LLAVE_C
        { 
            $$ = { 
                    tipo:'clase', 
                    nombre:$1, 
                    propiedades:$3, 
                    extiende:null 
                }; 
        }
    | IDENTIFICADOR EXTENDS IDENTIFICADOR LLAVE_A lista_declaraciones LLAVE_C
        { 
            $$ = { 
                    tipo:'clase', 
                    nombre:$1, 
                    propiedades:$5, 
                    extiende:$3 
                }; 
        }
    ;

lista_declaraciones
    : lista_declaraciones declaracion  
    { 
        $$ = $1; $$.push($2); 
    }
    | /* vacío */                      
    { 
        $$ = []; 
    }
    ;

declaracion
    : propiedad IGUAL valor PUNTO_COMA
        { 
            $$ = { 
                    propiedad:$1, 
                    valor:$3, 
                    linea:@1.first_line 
                }; 
        }
    | propiedad IGUAL valor_borde PUNTO_COMA
        { 
            $$ = { 
                    propiedad:$1, 
                    valor:$3, 
                    linea:@1.first_line 
                }; 
        }
    ;

propiedad
    : HEIGHT            { $$ = 'height'; }
    | WIDTH             { $$ = 'width'; }
    | MIN_HEIGHT        { $$ = 'min-height'; }
    | MAX_HEIGHT        { $$ = 'max-height'; }
    | MIN_WIDTH         { $$ = 'min-width'; }
    | MAX_WIDTH         { $$ = 'max-width'; }
    | BACKGROUND_COLOR  { $$ = 'background-color'; }
    | COLOR             { $$ = 'color'; }
    | TEXT_ALIGN        { $$ = 'text-align'; }
    | TEXT_SIZE         { $$ = 'font-size'; }
    | TEXT_FONT         { $$ = 'font-family'; }
    | PADDING           { $$ = 'padding'; }
    | PADDING_LEFT      { $$ = 'padding-left'; }
    | PADDING_RIGHT     { $$ = 'padding-right'; }
    | PADDING_TOP       { $$ = 'padding-top'; }
    | PADDING_BOTTOM    { $$ = 'padding-bottom'; }
    | MARGIN            { $$ = 'margin'; }
    | MARGIN_LEFT       { $$ = 'margin-left'; }
    | MARGIN_RIGHT      { $$ = 'margin-right'; }
    | MARGIN_TOP        { $$ = 'margin-top'; }
    | MARGIN_BOTTOM     { $$ = 'margin-bottom'; }
    | BORDER_RADIUS     { $$ = 'border-radius'; }
    | BORDER_STYLE      { $$ = 'border-style'; }
    | BORDER_WIDTH      { $$ = 'border-width'; }
    | BORDER_COLOR      { $$ = 'border-color'; }
    | BORDER            { $$ = 'border'; }
    | BORDER_TOP        { $$ = 'border-top'; }
    | BORDER_BOTTOM     { $$ = 'border-bottom'; }
    | BORDER_LEFT       { $$ = 'border-left'; }
    | BORDER_RIGHT      { $$ = 'border-right'; }
    | BORDER_TOP_STYLE  { $$ = 'border-top-style'; }
    | BORDER_BOTTOM_STYLE { $$ = 'border-bottom-style'; }
    | BORDER_LEFT_STYLE { $$ = 'border-left-style'; }
    | BORDER_RIGHT_STYLE{ $$ = 'border-right-style'; }
    ;

valor
    : expresion           { $$ = $1; }
    | COLOR_VALUE         { $$ = $1; }
    | LIGHTGRAY           { $$ = 'lightgray'; }
    | alineacion          { $$ = $1; }
    | estilo_borde_simple { $$ = $1; }
    | fuente              { $$ = $1; }
    | IDENTIFICADOR       { $$ = $1; }
    ;

valor_borde
    : expresion estilo_borde_simple color_val
        { 
            $$ = { 
                    tipo:'borde', 
                    ancho:$1, 
                    estilo:$2, 
                    color:$3 
                }; 
        }
    ;

color_val
    : COLOR_VALUE   { $$ = $1; }
    | IDENTIFICADOR { $$ = $1; }
    | LIGHTGRAY     { $$ = 'lightgray'; }
    ;

alineacion
    : CENTER    { $$ = 'center'; }
    | RIGHT     { $$ = 'right'; }
    | LEFT      { $$ = 'left'; }
    ;

estilo_borde_simple
    : DOTTED    { $$ = 'dotted'; }
    | LINE      { $$ = 'solid'; }
    | DOUBLE    { $$ = 'double'; }
    | SOLID     { $$ = 'solid'; }
    ;

fuente
    : HELVETICA     { $$ = 'Helvetica, sans-serif'; }
    | SANS_SERIF    { $$ = 'sans-serif'; }
    | SANS          { $$ = 'sans-serif'; }
    | MONO          { $$ = 'monospace'; }
    | CURSIVE       { $$ = 'cursive'; }
    ;

expresion
    : expresion MAS expresion    
    { 
        $$ = { 
                op:'+', 
                izq:$1, 
                der:$3 
            }; 
    }
    | expresion MENOS expresion  
    { 
        $$ = { 
                op:'-', 
                izq:$1, 
                der:$3 
            }; 
    }
    | expresion MULT expresion   
    { 
        $$ = { 
                op:'*', 
                izq:$1, 
                der:$3 
            };
    }
    | expresion DIV expresion    
    { 
        $$ = { 
                op:'/', 
                izq:$1, 
                der:$3 
            }; 
    }
    | MENOS expresion %prec UMENOS 
    { 
        $$ = { 
                op:'neg', 
                val:$2 
            }; 
    }
    | ENTERO       
    { 
        $$ = parseInt($1); 
    }
    | DECIMAL      
    { 
        $$ = parseFloat($1); 
    }
    | PIXEL        
    { 
        $$ = $1; 
    }
    | PORCENTAJE   
    { 
        $$ = $1; 
    }
    | CONTADOR     
    { 
        $$ = { 
                tipo:'contador', 
                nombre:$1.substring(1) 
            }; 
    }
    ;

bucle_for
    : FOR CONTADOR FROM expresion THROUGH expresion LLAVE_A cuerpo_for LLAVE_C
    { 
        $$ = { 
                tipo:'for', 
                var:$2.substring(1), 
                inicio:$4, 
                fin:$6, 
                inclusivo:true, 
                cuerpo:$8 
            }; 
    }
    | FOR CONTADOR FROM expresion TO expresion LLAVE_A cuerpo_for LLAVE_C
        { 
            $$ = { 
                    tipo:'for', 
                    var:$2.substring(1), 
                    inicio:$4, 
                    fin:$6, 
                    inclusivo:false, 
                    cuerpo:$8 
                }; 
        }
    ;

cuerpo_for
    : cuerpo_for clase_for  
    { 
        $$ = $1; $$.push($2);
    }
    | clase_for             
    { 
        $$ = [$1]; 
    }
    ;

clase_for
    : nombre_for LLAVE_A lista_declaraciones LLAVE_C
        { 
            $$ = { 
                    tipo:'clase_for', 
                    nombre:$1, 
                    propiedades:$3 
                }; 
        }
    ;

nombre_for
    : IDENTIFICADOR CONTADOR  
    { 
        $$ = $1 + '-' + $2.substring(1); 
    }
    | IDENTIFICADOR           
    { 
        $$ = $1; 
    }
    ;