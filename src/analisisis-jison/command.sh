#!/bin/bash

echo "Generando analizadores con Jison..."

GRAMMAR_PRINCIPAL="analisis-lenguaje-principal.jison"
GRAMMAR_STYLE="analisis-style.jison"
GRAMMAR_COMPONENT="analisis-component.jison"
GRAMMAR_DBA="analisis-DBA.jison"

OUTPUT_PRINCIPAL="analizador-lenguaje-principal.js"
OUTPUT_STYLE="analizador-style.js"
OUTPUT_COMPONENT="analizador-component.js"
OUTPUT_DBA="analizador-dba.js"

generar_analizador() {
    local input=$1
    local output=$2
    local nombre=$3

    if [ ! -f "$input" ]; then
        echo "Error: No se encontró el archivo $input"
        return 1
    fi

    echo "Generando $nombre..."

    node -e "
        const jison = require('jison');
        const fs = require('fs');
        
        try {
            const grammar = fs.readFileSync('$input', 'utf8');
            const parser = new jison.Generator(grammar, { type: 'lalr' });
            const source = parser.generate();
            
            fs.writeFileSync('$output', source);
            console.log('$nombre generado correctamente → $output');
        } catch (e) {
            console.error('Error al generar $nombre:');
            console.error(e.message);
            process.exit(1);
        }
    "
}

generar_analizador "$GRAMMAR_PRINCIPAL" "$OUTPUT_PRINCIPAL" "Analizador Principal"
generar_analizador "$GRAMMAR_STYLE"    "$OUTPUT_STYLE"    "Analizador Style"
generar_analizador "$GRAMMAR_COMPONENT" "$OUTPUT_COMPONENT" "Analizador Component"
generar_analizador "$GRAMMAR_DBA"       "$OUTPUT_DBA"      "Analizador DBA"

echo ""
echo "Generación completada"
echo "Archivos generados:"
echo "   - $OUTPUT_PRINCIPAL"
echo "   - $OUTPUT_STYLE"
echo "   - $OUTPUT_COMPONENT"
echo "   - $OUTPUT_DBA"
